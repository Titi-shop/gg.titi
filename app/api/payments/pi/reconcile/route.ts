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
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

/* =========================================================
   PI COMPLETE (SAFE)
========================================================= */

async function callPiComplete(piPaymentId: string, txid: string) {
  try {
    const res = await fetch(
      `${PI_API}/payments/${piPaymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (text.includes("already_completed")) return true;
      return false;
    }

    return true;
  } catch (err) {
    console.error("🔥 [PI_COMPLETE_FAIL]", err);
    return false;
  }
}

/* =========================================================
   MAIN FLOW
========================================================= */

export async function POST(req: Request) {
  console.log("🟡 [RECONCILE] START");

  try {
    /* =========================
       AUTH (PI UID → USER UUID)
    ========================= */

    const auth = await getUserFromBearer();
    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* =========================
       BODY
    ========================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const paymentIntentId =
      typeof raw.payment_intent_id === "string"
        ? raw.payment_intent_id.trim()
        : "";

    const piPaymentId =
      typeof raw.pi_payment_id === "string"
        ? raw.pi_payment_id.trim()
        : "";

    const txid =
      typeof raw.txid === "string"
        ? raw.txid.trim()
        : "";

    if (!isUUID(paymentIntentId)) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_INTENT" },
        { status: 400 }
      );
    }

    if (!piPaymentId || !txid) {
      return NextResponse.json(
        { error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    /* =========================================================
       STEP 1: PI VERIFY (SOURCE OF TRUTH)
    ========================================================= */

    console.log("🟡 [STEP_1_PI_VERIFY]");

    const piVerified =
      await verifyPiPaymentForReconcile({
        paymentIntentId,
        piPaymentId,
        userId,
        txid,
      });

    if (!piVerified?.ok) {
      return NextResponse.json(
        { error: "PI_NOT_VERIFIED" },
        { status: 400 }
      );
    }

    console.log("🟢 [PI_OK]", {
      amount: piVerified.verifiedAmount,
    });

    /* =========================================================
       STEP 2: RPC VERIFY (NON-BLOCKING AUDIT ONLY)
    ========================================================= */

    console.log("🟡 [STEP_2_RPC_VERIFY]");

    let rpcVerified: any = null;

    try {
      rpcVerified =
        await verifyRpcPaymentForReconcile({
          paymentIntentId,
          txid,
        });

      console.log("🟢 [RPC_OK]");
    } catch (err) {
      console.warn("⚠️ [RPC_FAIL_IGNORE]", {
        paymentIntentId,
        txid,
        message:
          err instanceof Error
            ? err.message
            : String(err),
      });

      rpcVerified = {
        skipped: true,
        reason: "RPC_FAILED",
      };
    }

    /* =========================================================
       STEP 3: FINALIZE ORDER (ATOMIC DB)
    ========================================================= */

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

    console.log("🟢 [DB_OK]", {
      orderId: paid.orderId,
    });

    /* =========================================================
       STEP 4: PI COMPLETE
    ========================================================= */

    console.log("🟡 [STEP_4_PI_COMPLETE]");

    await callPiComplete(piPaymentId, txid);

    /* =========================================================
       RESPONSE
    ========================================================= */

    return NextResponse.json({
      success: true,
      order_id: paid.orderId,
      amount: piVerified.verifiedAmount,
      rpc_verified: !rpcVerified?.skipped,
    });
  } catch (err) {
    console.error("🔥 [RECONCILE_CRASH]", err);

    return NextResponse.json(
      { error: "RECONCILE_FAILED" },
      { status: 400 }
    );
  }
}
