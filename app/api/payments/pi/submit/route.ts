
import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { markPaymentVerifying } from "@/lib/db/payments.submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
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

    console.log("🟡 [SUBMIT] RAW_BODY", raw);

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
     * 🔥 FIX: KHÔNG DÙNG process.env.APP_URL + KHÔNG FETCH
     * =====================================================
     */
    const runReconcile = async () => {
      try {
        console.log("🟡 [SUBMIT] AUTO_RECONCILE_TRIGGER");

        const { POST: reconcile } = await import(
          "@/app/api/payments/pi/reconcile/route"
        );

        const fakeReq = new Request("http://internal/reconcile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: req.headers.get("authorization") || "",
          },
          body: JSON.stringify({
            payment_intent_id: paymentIntentId,
            pi_payment_id: piPaymentId,
            txid,
          }),
        });

        await reconcile(fakeReq as any);

        console.log("🟢 [SUBMIT] AUTO_RECONCILE_DONE");
      } catch (e) {
        console.error("🔥 [SUBMIT] AUTO_RECONCILE_FAIL", e);
      }
    };

    queueMicrotask(runReconcile);

    return NextResponse.json({
      success: true,
      status: "verifying",
      paymentIntentId,
    });
  } catch (err) {
    console.error("🔥 [SUBMIT] CRASH", err);

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "SUBMIT_FAILED" },
      { status: 400 }
    );
  }
}
