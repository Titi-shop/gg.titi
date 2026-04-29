import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { withTransaction } from "@/lib/db";
import { verifyPiUser, fetchPiPayment, bindPiPaymentToIntent } from "@/lib/db/payments.verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

function isUUID(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function callPiApprove(piPaymentId: string) {
  const res = await fetch(`${PI_API}/payments/${piPaymentId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok && data?.error !== "already_approved") {
    throw new Error("PI_APPROVE_FAILED");
  }

  return true;
}

export async function POST(req: Request) {
  try {
    const auth = await getUserFromBearer();
    if (!auth) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const userId = auth.userId;
    const body = await req.json();

    const paymentIntentId = body.payment_intent_id;
    const piPaymentId = body.pi_payment_id;

    if (!isUUID(paymentIntentId) || !piPaymentId) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const piUid = await verifyPiUser(req.headers.get("authorization") || "");
    const payment = await fetchPiPayment(piPaymentId);

    if (payment.user_uid !== piUid) {
      return NextResponse.json({ error: "PI_USER_MISMATCH" }, { status: 400 });
    }

    await withTransaction(async (client) => {
      await bindPiPaymentToIntent(client, {
        userId,
        paymentIntentId,
        piPaymentId,
        piUid,
        verifiedAmount: Number(payment.amount),
        piPayload: payment,
      });
    });

    if (!payment.status?.developer_approved) {
      await callPiApprove(piPaymentId);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AUTHORIZE_FAILED" },
      { status: 400 }
    );
  }
}
