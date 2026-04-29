import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   VALIDATION
========================= */

function isUUID(v: unknown): v is string {
  return typeof v === "string" && v.length > 10;
}

/* =========================
   API
========================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [SUBMIT] START");

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.log("❌ [SUBMIT] UNAUTHORIZED");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    /* ================= BODY ================= */

    const body = await req.json().catch(() => null);

    console.log("🟡 [SUBMIT] RAW_BODY", body);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const paymentIntentId = body.payment_intent_id;
    const piPaymentId = body.pi_payment_id;

    if (!isUUID(paymentIntentId) || !piPaymentId) {
      console.log("❌ [SUBMIT] INVALID_INPUT");
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    console.log("🟡 [SUBMIT] CALL_DB", {
      paymentIntentId,
      userId,
    });

    /* ================= DB LAYER (NO TRANSACTION HERE) ================= */

    const result = await markPaymentVerifying({
      paymentIntentId,
      userId,
      piPaymentId,
    });

    console.log("🟢 [SUBMIT] SUCCESS", result);

    return NextResponse.json({
      ok: true,
      status: "verifying",
      payment_intent_id: paymentIntentId,
      pi_payment_id: piPaymentId,
    });
  } catch (err) {
    console.error("🔥 [SUBMIT] CRASH", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "SUBMIT_FAILED",
      },
      { status: 400 }
    );
  }
}
