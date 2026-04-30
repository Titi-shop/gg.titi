import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import { verifyPiPaymentForReconcile } from "@/lib/db/payments.verify";
import { verifyRpcPaymentForReconcile } from "@/lib/db/payments.rpc";
import { finalizePaidOrderFromIntent } from "@/lib/db/orders.payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   CONFIG
========================================================= */

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* =========================================================
   TYPES
========================================================= */

type Body = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
  txid?: unknown;
};

/* =========================================================
   VALIDATION
========================================================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

/* =========================================================
   PI COMPLETE
========================================================= */

async function callPiComplete(piPaymentId: string, txid: string) {
  try {
    const res = await fetch(`${PI_API}/payments/${piPaymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    });

    const text = await res.text();

    if (!res.ok) {
      try {
        const json = JSON.parse(text);
        if (json?.error === "already_completed") return true;
      } catch {}
      throw new Error("PI_COMPLETE_FAILED");
    }

    return true;
  } catch (err) {
    console.error("🔥 [PI_COMPLETE] ERROR", err);
    return false;
  }
}

/* =========================================================
   MAIN
========================================================= */

export async function POST(req: Request) {
  console.log("🟡 [RECONCILE] START");

  try {
    const auth = await getUserFromBearer();
    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as {
      payment_intent_id?: string;
      pi_payment_id?: string;
      txid?: string;
    };

    const paymentIntentId = body.payment_intent_id?.trim() ?? "";
    const piPaymentId = body.pi_payment_id?.trim() ?? "";
    const txid = body.txid?.trim() ?? "";

    if (!isUUID(paymentIntentId)) {
      return NextResponse.json({ error: "INVALID_PAYMENT_INTENT" }, { status: 400 });
    }

    if (!piPaymentId || !txid) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    /* =========================
       STEP 1 PI VERIFY
    ========================= */

    console.log("🟡 [STEP_1_PI_VERIFY]");

    const piVerified = await verifyPiPaymentForReconcile({
      paymentIntentId,
      piPaymentId,
      userId,
      txid,
    });

    console.log("🟢 [PI_OK]", {
      ok: piVerified.ok,
      amount: piVerified.verifiedAmount,
    });

    /* =========================
       STEP 2 RPC VERIFY (SAFE AUDIT)
    ========================= */

    console.log("🟡 [STEP_2_RPC_VERIFY]");

    let rpcVerified: any;

    try {
      rpcVerified = await verifyRpcPaymentForReconcile({
        paymentIntentId,
        txid,
      });

      console.log("🟢 [RPC_OK]");
    } catch (err) {
      console.error("⚠️ [RPC_FAIL_IGNORE]", {
        paymentIntentId,
        txid,
        message: err instanceof Error ? err.message : String(err),
      });

      rpcVerified = {
        skipped: true,
        reason: "RPC_FAILED",
      };
    }

    /* =========================
       STEP 3 FINALIZE
    ========================= */

    if (!piVerified?.ok) {
      throw new Error("PI_NOT_VERIFIED");
    }

    console.log("🟡 [STEP_3_FINALIZE]");

    const paid = await finalizePaidOrderFromIntent({
      paymentIntentId,
      piPaymentId,
      txid,
      verifiedAmount: piVerified.verifiedAmount,
      receiverWallet: piVerified.receiverWallet,
      piPayload: piVerified.piPayload,
      rpcPayload: rpcVerified,
    });

    console.log("🟢 [DB_OK]", paid);

    /* =========================
       STEP 4 COMPLETE
    ========================= */

    console.log("🟡 [STEP_4_PI_COMPLETE]");

    await callPiComplete(piPaymentId, txid);

    return NextResponse.json({
      success: true,
      order_id: paid.orderId,
      rpc_verified: !rpcVerified?.skipped,
    });
  } catch (err) {
    console.error("🔥 [RECONCILE_CRASH]", err);

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RECONCILE_FAILED" },
      { status: 400 }
    );
  }
}
