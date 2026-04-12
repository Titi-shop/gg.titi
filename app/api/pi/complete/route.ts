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

function safeQuantity(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n)) return 1;
  if (n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

/* ================= TYPES ================= */

type Body = {
  paymentId?: unknown;
  txid?: unknown;
  product_id?: unknown;
  variant_id?: unknown;
  quantity?: unknown;
  shipping?: {
  name?: string;
  phone?: string;
  address_line?: string;
  ward?: string;
  district?: string;
  region?: string;
  country?: string;
  postal_code?: string | null;
  };
  zone?: unknown;
};

/* ================= API ================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PAYMENT][START]");

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

    const productId =
      typeof body.product_id === "string" ? body.product_id : "";

    const variantId =
      typeof body.variant_id === "string" && body.variant_id
        ? body.variant_id
        : null;

    const quantity = safeQuantity(body.quantity);

    const zone =
      typeof body.zone === "string"
        ? body.zone.trim().toLowerCase()
        : "";

    const country =
      typeof body.shipping?.country === "string"
        ? body.shipping.country.trim().toUpperCase()
        : "";
    const shipping = body.shipping || {};

const shippingName =
  typeof shipping.name === "string" ? shipping.name.trim() : "";

const shippingPhone =
  typeof shipping.phone === "string" ? shipping.phone.trim() : "";

const shippingAddressLine =
  typeof shipping.address_line === "string"
    ? shipping.address_line.trim()
    : "";

const shippingRegion =
  typeof shipping.region === "string" ? shipping.region.trim() : "";

const shippingDistrict =
  typeof shipping.district === "string"
    ? shipping.district.trim()
    : null;

const shippingWard =
  typeof shipping.ward === "string"
    ? shipping.ward.trim()
    : null;

const shippingPostalCode =
  typeof shipping.postal_code === "string"
    ? shipping.postal_code.trim()
    : null;

    console.log("🟢 [PAYMENT][PARSED]", {
      paymentId,
      txid,
      productId,
      variantId,
      quantity,
      zone,
      country,
    });
    console.log("🟣 [PAYMENT][SHIPPING_FULL]", {
  shippingName,
  shippingPhone,
  shippingAddressLine,
  shippingRegion,
  shippingDistrict,
  shippingWard,
  shippingPostalCode,
});

    /* ================= VALIDATE ================= */

    if (!paymentId || !txid || !productId) {
      console.error("❌ [PAYMENT][INVALID_REQUIRED_FIELDS]");
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    if (!isUUID(productId)) {
      console.error("❌ [PAYMENT][INVALID_PRODUCT_ID]", productId);
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    if (variantId && !isUUID(variantId)) {
      console.error("❌ [PAYMENT][INVALID_VARIANT_ID]", variantId);
      return NextResponse.json(
        { error: "INVALID_VARIANT_ID" },
        { status: 400 }
      );
    }

    if (!country || !zone) {
      console.error("❌ [PAYMENT][INVALID_SHIPPING]", {
        country,
        zone,
      });
      return NextResponse.json(
        { error: "INVALID_SHIPPING" },
        { status: 400 }
      );
    }

    if (!shippingName || !shippingPhone || !shippingAddressLine) {
  console.error("❌ [PAYMENT][INVALID_SHIPPING_INFO]");

  return NextResponse.json(
    { error: "INVALID_SHIPPING_INFO" },
    { status: 400 }
  );
}
    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PAYMENT][UNAUTHORIZED]");
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    console.log("🟢 [PAYMENT][AUTH_OK]", { userId });

    /* ================= VERIFY PI ================= */

    console.log("🟡 [PAYMENT][VERIFY_PI]");

    const piRes = await fetch(`${PI_API}/payments/${paymentId}`, {
      headers: { Authorization: `Key ${PI_KEY}` },
      cache: "no-store",
    });

    if (!piRes.ok) {
      console.error("❌ [PAYMENT][PI_NOT_FOUND]", paymentId);
      return NextResponse.json(
        { error: "PI_PAYMENT_NOT_FOUND" },
        { status: 400 }
      );
    }

    const payment = await piRes.json();
    console.log("🟡 [PAYMENT][AMOUNT_CHECK]", {
  amount: payment.amount,
});
    if (!payment.amount || payment.amount <= 0) {
  return NextResponse.json(
    { error: "INVALID_AMOUNT" },
    { status: 400 }
  );
}

    console.log("🟢 [PAYMENT][PI_DATA]", {
      status: payment.status,
      user_uid: payment.user_uid,
    });

    const status = payment.status;

    if (
      !status?.developer_approved ||
      !status?.transaction_verified
    ) {
      console.error("❌ [PAYMENT][NOT_APPROVED]", status);

      return NextResponse.json(
        { error: "PAYMENT_NOT_APPROVED" },
        { status: 400 }
      );
    }

   if (status?.developer_completed) {
  console.log("🟡 [PAYMENT][ALREADY_COMPLETED]");
} else {
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

  console.log("🟡 [PAYMENT][COMPLETE_RESPONSE]", completeData);

  if (!completeRes.ok) {
    console.error("❌ [PAYMENT][PI_COMPLETE_FAIL]", completeData);

    if (
      completeData?.error?.includes?.("already") ||
      completeData?.message?.includes?.("completed")
    ) {
      console.log("🟡 [PAYMENT][ALREADY_COMPLETED]");
    } else {
      return NextResponse.json(
        { error: "PI_COMPLETE_FAILED" },
        { status: 400 }
      );
    }
  }
}

    /* ================= DB ================= */

    console.log("🟡 [PAYMENT][DB_PROCESS]");

    const result = await processPiPayment({
  userId,
  productId,
  variantId,
  quantity,
  paymentId,
  txid,

  country,
  zone,

  shipping: {
    name: shippingName,
    phone: shippingPhone,
    address_line: shippingAddressLine,
    ward: shippingWard,
    district: shippingDistrict,
    region: shippingRegion,
    postal_code: shippingPostalCode,
  },
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
