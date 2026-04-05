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
    country?: string;
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

    console.log("🟢 [PAYMENT][PARSED]", {
      paymentId,
      txid,
      productId,
      variantId,
      quantity,
      zone,
      country,
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

      if (!country || !zone){
      console.error("❌ [PAYMENT][INVALID_SHIPPING]", {
        country,
        zone,
      });
      return NextResponse.json(
        { error: "INVALID_SHIPPING" },
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

    console.log("🟢 [PAYMENT][PI_DATA]", {
      status: payment.status,
      user_uid: payment.user_uid,
    });

  
    /* ================= COMPLETE PI ================= */

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
