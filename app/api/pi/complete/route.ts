import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { processPiPayment } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

/* ================= HELPERS ================= */

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
/* ================= TYPES ================= */

type Body = {
  paymentId?: unknown;
  txid?: unknown;
};

/* ================= API ================= */

export async function POST(req: Request) {
  try {

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      console.error("❌ [PAYMENT][INVALID_BODY_RAW]", raw);
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const body = raw as Body;

    const paymentId =
  typeof body.paymentId === "string" ? body.paymentId : "";
const txid =
  typeof body.txid === "string" ? body.txid : "";
console.log("🟡 [PAYMENT][START]", {
  paymentId,
  txid,
});

    /* ================= VALIDATE BASIC ================= */

if (!paymentId || !txid) {
  return NextResponse.json(
    { error: "INVALID_BODY" },
    { status: 400 }
  );
}

/* ================= AUTH ================= */

const auth = await getUserFromBearer();

if (!auth) {
  return NextResponse.json(
    { error: "UNAUTHORIZED" },
    { status: 401 }
  );
}

const userId = auth.userId;
const piUidFromToken = auth.pi_uid;

/* ================= VERIFY PI ================= */

const piRes = await fetch(`${PI_API}/payments/${paymentId}`, {
  headers: { Authorization: `Key ${PI_KEY}` },
  cache: "no-store",
});

if (!piRes.ok) {
  return NextResponse.json(
    { error: "PI_PAYMENT_NOT_FOUND" },
    { status: 400 }
  );
}

const payment = await piRes.json();
if (!payment.amount || Number(payment.amount) <= 0) {
  return NextResponse.json(
    { error: "INVALID_AMOUNT" },
    { status: 400 }
  );
}
/* ================= VERIFY USER ================= */

if (payment.user_uid !== piUidFromToken) {
  return NextResponse.json(
    { error: "INVALID_USER_PAYMENT" },
    { status: 400 }
  );
}

/* ================= VERIFY TXID ================= */

if (payment.transaction?.txid !== txid) {
  return NextResponse.json(
    { error: "INVALID_TXID" },
    { status: 400 }
  );
}

/* ================= VERIFY STATUS ================= */

const status = payment.status;

if (
  !status?.developer_approved ||
  !status?.transaction_verified
) {
  return NextResponse.json(
    { error: "PAYMENT_NOT_APPROVED" },
    { status: 400 }
  );
}

/* ================= METADATA ================= */

const meta = payment.metadata || {};

const productId =
  typeof meta.product_id === "string" ? meta.product_id : "";

const variantId =
  typeof meta.variant_id === "string" ? meta.variant_id : null;
if (variantId && !isUUID(variantId)) {
  return NextResponse.json(
    { error: "INVALID_VARIANT_ID" },
    { status: 400 }
  );
}
const quantity =
  Number.isInteger(meta.quantity) &&
  meta.quantity > 0 &&
  meta.quantity <= 10
    ? meta.quantity
    : 1;

if (!productId || !isUUID(productId)) {
  return NextResponse.json(
    { error: "INVALID_METADATA_PRODUCT" },
    { status: 400 }
  );
}
/* ================= COMPLETE PI ================= */

if (!status?.developer_completed) {
  console.log("🟡 [PAYMENT][COMPLETE_PI]");

  const completeRes = await fetch(
    `${PI_API}/payments/${paymentId}/complete`,
    {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    }
  );

  const completeData = await completeRes.json().catch(() => null);

  if (!completeRes.ok) {
  console.warn("🟡 [PAYMENT][PI_COMPLETE_WARNING]", completeData);

  const isAlreadyCompleted =
    completeData?.error === "already_completed" ||
    completeData?.error_message?.includes("already");

  if (!isAlreadyCompleted) {
    return NextResponse.json(
      { error: "PI_COMPLETE_FAILED" },
      { status: 400 }
    );
  }

  // ✅ coi như SUCCESS
  console.log("🟢 [PAYMENT] ALREADY COMPLETED → CONTINUE");
}
}
/* ================= DB ================= */

console.log("🟡 [PAYMENT][DB_PROCESS]");

const result = await processPiPayment({
  userId,
  paymentId,
  txid,
  productId,
  variantId,
  quantity,
  verifiedAmount: Number(payment.amount),
});

    console.log("🟢 [PAYMENT][SUCCESS]", result);

    return NextResponse.json({
      success: true,
      order_id: result.orderId,
    });

  } catch (err) {
    console.error("🔥 [PAYMENT][CRASH]", err);

    return NextResponse.json(
      { error: "PAYMENT_FAILED" },
      { status: 400 }
    );
  }
}
