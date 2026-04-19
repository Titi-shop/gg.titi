import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { creditWallet } from "@/lib/db/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

export async function POST(req: Request) {
  try {
    console.log("🟡 [DEPOSIT][START]");

    /* ================= AUTH ================= */

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= BODY ================= */

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const paymentId =
      typeof body.paymentId === "string" ? body.paymentId : "";

    if (!paymentId) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_ID" },
        { status: 400 }
      );
    }

    console.log("🟢 [DEPOSIT][PAYMENT_ID]", paymentId);

    /* ================= VERIFY PI ================= */

    const piRes = await fetch(`${PI_API}/payments/${paymentId}`, {
      headers: {
        Authorization: `Key ${PI_KEY}`,
      },
      cache: "no-store",
    });

    if (!piRes.ok) {
      console.error("❌ [DEPOSIT][PI_NOT_FOUND]");
      return NextResponse.json(
        { error: "PI_PAYMENT_NOT_FOUND" },
        { status: 400 }
      );
    }

    const payment = await piRes.json();

    console.log("🟢 [DEPOSIT][PI_DATA]", {
      amount: payment.amount,
      status: payment.status,
    });

    /* ================= VALIDATE ================= */

    if (!payment.amount || payment.amount <= 0) {
      return NextResponse.json(
        { error: "INVALID_AMOUNT" },
        { status: 400 }
      );
    }

    if (
      !payment.status?.developer_approved ||
      !payment.status?.transaction_verified
    ) {
      return NextResponse.json(
        { error: "PAYMENT_NOT_APPROVED" },
        { status: 400 }
      );
    }

    /* ================= COMPLETE ================= */

    if (!payment.status?.developer_completed) {
      console.log("🟡 [DEPOSIT][COMPLETE]");

      const completeRes = await fetch(
        `${PI_API}/payments/${paymentId}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Key ${PI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            txid: payment.transaction?.txid,
          }),
        }
      );

      const completeData = await completeRes.json().catch(() => null);

      if (!completeRes.ok) {
        const already =
          completeData?.error === "already_completed" ||
          completeData?.error_message?.includes("already");

        if (!already) {
          console.error("❌ [DEPOSIT][COMPLETE_FAILED]");
          return NextResponse.json(
            { error: "PI_COMPLETE_FAILED" },
            { status: 400 }
          );
        }
      }
    }

    /* ================= CREDIT WALLET ================= */

    console.log("🟡 [DEPOSIT][CREDIT]");

    await creditWallet({
      userId,
      amount: Number(payment.amount),
      referenceId: paymentId,
      referenceType: "deposit",
    });

    console.log("🟢 [DEPOSIT][SUCCESS]", {
      userId,
      amount: payment.amount,
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("🔥 [DEPOSIT][CRASH]", err);

    return NextResponse.json(
      { error: "DEPOSIT_FAILED" },
      { status: 400 }
    );
  }
}
