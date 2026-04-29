import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import {
  verifyPiUser,
  fetchPiPayment,
  assertPiPaymentReady,
} from "@/lib/db/payments.verify";
import { verifyRpcTransaction } from "@/lib/db/payments.rpc";
import { submitPiPayment } from "@/lib/db/payments.submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  payment_intent_id?: unknown;
  pi_payment_id?: unknown;
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

export async function POST(req: Request) {
  try {
    console.log("🟡 [PI_SUBMIT] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const raw = await req.json().catch(() => null);

    console.log("🟡 [PI_SUBMIT] RAW_BODY", raw);

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

    if (!isUUID(paymentIntentId)) {
      return NextResponse.json({ error: "INVALID_PAYMENT_INTENT" }, { status: 400 });
    }

    if (!piPaymentId) {
      return NextResponse.json({ error: "INVALID_PI_PAYMENT_ID" }, { status: 400 });
    }

    const piUid = await verifyPiUser(req.headers.get("authorization") || "");

    const payment = await fetchPiPayment(piPaymentId);

    assertPiPaymentReady({
      payment,
      piUid,
    });

    const txid = payment.transaction.txid as string;

    const rpc = await verifyRpcTransaction({
      txid,
      expectedAmount: Number(payment.amount),
    });

    const result = await submitPiPayment({
      paymentIntentId,
      userId,
      piPaymentId,
      txid,
      verifiedAmount: Number(payment.amount),
      rpcRaw: rpc.raw,
    });

    console.log("🟢 [PI_SUBMIT] SUCCESS", result);

    return NextResponse.json({
      ok: true,
      order_id: result.orderId,
      txid,
    });
  } catch (err) {
    console.error("🔥 [PI_SUBMIT] CRASH", err);

    return NextResponse.json(
      { error: (err as Error).message || "SUBMIT_FAILED" },
      { status: 400 }
    );
  }
}
