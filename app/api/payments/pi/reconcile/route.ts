import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import {
  verifyPiPaymentForReconcile,
} from "@/lib/db/payments.verify";

import {
  verifyRpcPaymentForReconcile,
} from "@/lib/db/payments.rpc";

import {
  finalizePaidOrderFromIntent,
} from "@/lib/db/orders.payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

type Body = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
  txid?: unknown;
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

async function callPiComplete(piPaymentId: string, txid: string) {
  console.log("🟡 [RECONCILE] PI_COMPLETE", piPaymentId);

  const res = await fetch(`${PI_API}/payments/${piPaymentId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txid }),
    cache: "no-store",
  });

  const raw = await res.text();

  console.log("🟡 [RECONCILE] PI_COMPLETE_STATUS", res.status);
  console.log("🟡 [RECONCILE] PI_COMPLETE_BODY", raw);

  if (!res.ok) {
    let parsed: { error?: string } | null = null;

    try {
      parsed = JSON.parse(raw) as { error?: string };
    } catch {
      parsed = null;
    }

    if (parsed?.error === "already_completed") {
      console.log("🟢 [RECONCILE] PI_ALREADY_COMPLETED");
      return true;
    }

    throw new Error("PI_COMPLETE_FAILED");
  }

  return true;
}

export async function POST(req: Request) {
  try {
    console.log("🟡 [RECONCILE] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const raw = await req.json().catch(() => null);

    console.log("🟡 [RECONCILE] RAW_BODY", raw);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as Body;

    const paymentIntentId =
      typeof body.payment_intent_id === "string"
        ? body.payment_intent_id.trim()
        : "";

    const piPaymentId =
      typeof body.pi_payment_id === "string"
        ? body.pi_payment_id.trim()
        : "";

    const txid =
      typeof body.txid === "string"
        ? body.txid.trim()
        : "";

    if (!isUUID(paymentIntentId)) {
      return NextResponse.json({ error: "INVALID_PAYMENT_INTENT" }, { status: 400 });
    }

    if (!piPaymentId) {
      return NextResponse.json({ error: "INVALID_PI_PAYMENT_ID" }, { status: 400 });
    }

    if (!txid) {
      return NextResponse.json({ error: "INVALID_TXID" }, { status: 400 });
    }

    console.log("🟡 [RECONCILE] STEP_1_VERIFY_PI");

    const piVerified = await verifyPiPaymentForReconcile({
      paymentIntentId,
      piPaymentId,
      userId,
      txid,
    });

    console.log("🟢 [RECONCILE] PI_OK", piVerified);

    console.log("🟡 [RECONCILE] STEP_2_VERIFY_RPC");

    const rpcVerified = await verifyRpcPaymentForReconcile({
      paymentIntentId,
      piPaymentId,
      txid,
    });

    console.log("🟢 [RECONCILE] RPC_OK", rpcVerified);

    console.log("🟡 [RECONCILE] STEP_3_FINALIZE_DB");

    const paid = await finalizePaidOrderFromIntent({
      paymentIntentId,
      piPaymentId,
      txid,
      userId,
      verifiedAmount: piVerified.verifiedAmount,
    });

    console.log("🟢 [RECONCILE] DB_OK", paid);

    console.log("🟡 [RECONCILE] STEP_4_PI_COMPLETE");

    await callPiComplete(piPaymentId, txid);

    console.log("🟢 [RECONCILE] SUCCESS");

    return NextResponse.json({
      success: true,
      order_id: paid.orderId,
    });
  } catch (err) {
    console.error("🔥 [RECONCILE] CRASH", err);

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RECONCILE_FAILED" },
      { status: 400 }
    );
  }
}
