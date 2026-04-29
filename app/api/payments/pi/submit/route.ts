import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   VALIDATION
========================= */

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
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
      console.error("❌ [SUBMIT] UNAUTHORIZED");
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    console.log("🟡 [SUBMIT] RAW_BODY", raw);

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

    /* ================= VALIDATION ================= */

    if (!isUUID(paymentIntentId)) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_INTENT" },
        { status: 400 }
      );
    }

    if (!piPaymentId) {
      return NextResponse.json(
        { error: "INVALID_PI_PAYMENT_ID" },
        { status: 400 }
      );
    }

    console.log("🟡 [SUBMIT] CALL_DB", {
      paymentIntentId,
      userId,
    });

    /* ================= DB LAYER ================= */

    const result = await markPaymentVerifying({
      paymentIntentId,
      userId,
      piPaymentId,
    });

    console.log("🟢 [SUBMIT] SUCCESS", result);

    return NextResponse.json(result);
  } catch (err) {
    console.error("🔥 [SUBMIT] CRASH", err);

    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "SUBMIT_FAILED",
      },
      { status: 400 }
    );
  }
}
