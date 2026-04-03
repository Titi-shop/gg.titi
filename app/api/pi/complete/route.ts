import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { processPiPayment, validateShippingRegion } from "@/lib/db/orders";

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
  selectedRegion?: unknown;
};

/* ================= API ================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PAYMENT][COMPLETE] START");

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
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
  typeof body.variant_id === "string" ? body.variant_id : null;
    const quantity = safeQuantity(body.quantity);

    const selectedRegion =
      typeof body.selectedRegion === "string"
        ? body.selectedRegion
        : "";

    const country =
      typeof body.shipping?.country === "string"
        ? body.shipping.country
        : "";

    console.log("🟢 PARSED", {
      paymentId,
      txid,
      productId,
      variantId,
      quantity,
      selectedRegion,
      country,
    });

    /* ================= VALIDATE ================= */

    if (!paymentId || !txid || !productId) {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    if (!isUUID(productId)) {
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    if (!country || !selectedRegion) {
      return NextResponse.json(
        { error: "INVALID_SHIPPING" },
        { status: 400 }
      );
    }

    if (variantId && !isUUID(variantId)) {
  return NextResponse.json(
    { error: "INVALID_VARIANT_ID" },
    { status: 400 }
  );
}
    /* ================= AUTH ================= */

    const authUser = await getUserFromBearer(req);

    if (!authUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = authUser.id; // ✅ FIX đúng kiến trúc

    /* ================= VERIFY SHIPPING ================= */

    await validateShippingRegion({
      country,
      selectedRegion,
    });

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

    if (payment.user_uid !== authUser.pi_uid) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_OWNER" },
        { status: 403 }
      );
    }

    if (payment.status !== "approved") {
      return NextResponse.json(
        { error: "PAYMENT_NOT_APPROVED" },
        { status: 400 }
      );
    }

    /* ================= COMPLETE PI ================= */

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
      if (
        completeData?.error?.includes?.("already") ||
        completeData?.message?.includes?.("completed")
      ) {
        console.log("🟡 ALREADY COMPLETED");
      } else {
        return NextResponse.json(
          { error: "PI_COMPLETE_FAILED" },
          { status: 400 }
        );
      }
    }

    /* ================= DB ================= */

    const result = await processPiPayment({
      userId,
      productId,
      variantId,
      quantity,
      paymentId,
      txid,
      country,
      selectedRegion,
    });

    return NextResponse.json({
      success: true,
      order_id: result.orderId,
    });

  } catch (err) {
    console.error("🔥 [PAYMENT][COMPLETE] ERROR", err);

    return NextResponse.json(
      { error: "PAYMENT_FAILED" },
      { status: 400 }
    );
  }
}
