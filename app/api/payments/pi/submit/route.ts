
import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";
import { runReconcileJob } from "@/lib/services/payments/reconcile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   TYPES
========================= */

type SubmitBody = {
  payment_intent_id?: string;
  pi_payment_id?: string;
  txid?: string;
};

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

/* =========================
   MAIN
========================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [SUBMIT] START");

    const auth = await getUserFromBearer();
    if (!auth) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    const raw: unknown = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as SubmitBody;

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

    /* =========================
       CLEAN ARCHITECTURE FIX
       → NO API CALL INSIDE API
       → USE SERVICE LAYER
    ========================= */

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
