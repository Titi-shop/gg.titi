
import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

export async function POST(req: Request) {
  try {
    console.log("🟡 [SUBMIT] START");

    const auth = await getUserFromBearer();
    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const paymentIntentId =
      typeof (raw as any).payment_intent_id === "string"
        ? (raw as any).payment_intent_id.trim()
        : "";

    const piPaymentId =
      typeof (raw as any).pi_payment_id === "string"
        ? (raw as any).pi_payment_id.trim()
        : "";

    const txid =
      typeof (raw as any).txid === "string"
        ? (raw as any).txid.trim()
        : "";

    if (!isUUID(paymentIntentId) || !piPaymentId) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    console.log("🟡 [SUBMIT] CALL_DB");

    const result = await markPaymentVerifying({
      paymentIntentId,
      userId,
      piPaymentId,
      txid: txid || null,
    });

    console.log("🟢 [SUBMIT] MARKED_VERIFYING", result);

    /**
     * =====================================================
     * ASYNC TRIGGER (SAFE VERSION)
     * =====================================================
     */

    queueMicrotask(() => {
      void runReconcileJob({
        paymentIntentId,
        piPaymentId,
        txid: txid || null,
        authorization: req.headers.get("authorization") ?? "",
      });
    });

    return NextResponse.json({
      success: true,
      status: "verifying",
      paymentIntentId,
    });
  } catch (err: unknown) {
    console.error("🔥 [SUBMIT] CRASH", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "SUBMIT_FAILED",
      },
      { status: 400 }
    );
  }
}
