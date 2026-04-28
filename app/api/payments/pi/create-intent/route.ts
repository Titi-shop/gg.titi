import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { createPiPaymentIntent } from "@/lib/db/payments.intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   TYPES
========================= */

type Body = {
  product_id?: unknown;
  variant_id?: unknown;
  quantity?: unknown;
  country?: unknown;
  zone?: unknown;
  shipping?: unknown;
};

type ShippingInput = {
  name: string;
  phone: string;
  address_line: string;
  ward?: string | null;
  district?: string | null;
  region?: string | null;
  postal_code?: string | null;
};

/* =========================
   HELPERS
========================= */

function isUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function safeQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return 1;
  if (n > 10) return 10;
  return n;
}

function normalizeShipping(v: unknown): ShippingInput | null {
  if (!v || typeof v !== "object") return null;

  const raw = v as Record<string, unknown>;

  const name =
    typeof raw.name === "string" ? raw.name.trim() : "";

  const phone =
    typeof raw.phone === "string" ? raw.phone.trim() : "";

  const address_line =
    typeof raw.address_line === "string" ? raw.address_line.trim() : "";

  if (!name || !phone || !address_line) return null;

  return {
    name,
    phone,
    address_line,
    ward: typeof raw.ward === "string" ? raw.ward.trim() : null,
    district: typeof raw.district === "string" ? raw.district.trim() : null,
    region: typeof raw.region === "string" ? raw.region.trim() : null,
    postal_code: typeof raw.postal_code === "string" ? raw.postal_code.trim() : null,
  };
}

/* =========================
   API
========================= */

export async function POST(req: Request) {
  try {
    console.log("🟡 [PAYMENT_INTENT] START");

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PAYMENT_INTENT] UNAUTHORIZED");
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      console.error("❌ [PAYMENT_INTENT] INVALID_BODY");
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const body = raw as Body;

    const productId = body.product_id;
    const variantId = body.variant_id;
    const quantity = safeQty(body.quantity);

    const country =
      typeof body.country === "string"
        ? body.country.trim().toUpperCase()
        : "";

    const zone =
      typeof body.zone === "string"
        ? body.zone.trim().toLowerCase()
        : "";

    const shipping = normalizeShipping(body.shipping);

    if (!isUUID(productId)) {
      console.error("❌ [PAYMENT_INTENT] INVALID_PRODUCT_ID", productId);
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    if (variantId !== null && variantId !== undefined && !isUUID(variantId)) {
      console.error("❌ [PAYMENT_INTENT] INVALID_VARIANT_ID", variantId);
      return NextResponse.json(
        { error: "INVALID_VARIANT_ID" },
        { status: 400 }
      );
    }

    if (!country) {
      return NextResponse.json(
        { error: "INVALID_COUNTRY" },
        { status: 400 }
      );
    }

    if (!zone) {
      return NextResponse.json(
        { error: "INVALID_ZONE" },
        { status: 400 }
      );
    }

    if (!shipping) {
      return NextResponse.json(
        { error: "INVALID_SHIPPING" },
        { status: 400 }
      );
    }

    console.log("🟡 [PAYMENT_INTENT] CALL_DB", {
      productId,
      variantId,
      quantity,
      country,
      zone,
      userId,
    });

    /* ================= DB LAYER ================= */

    const intent = await createPiPaymentIntent({
      userId,
      productId,
      variantId: variantId ?? null,
      quantity,
      country,
      zone,
      shipping,
    });

    console.log("🟢 [PAYMENT_INTENT] SUCCESS", {
      paymentIntentId: intent.paymentIntentId,
    });

    return NextResponse.json({
  paymentIntentId: intent.paymentIntentId,
  amount: intent.amount,
  memo: intent.memo,
  nonce: intent.nonce,
});
  } catch (err) {
    const code =
      err instanceof Error && err.message
        ? err.message
        : "CREATE_INTENT_FAILED";

    console.error("🔥 [PAYMENT_INTENT] CRASH", code);

    return NextResponse.json(
      { error: code },
      { status: 400 }
    );
  }
}
