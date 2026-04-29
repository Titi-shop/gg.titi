import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { createPiPaymentIntent } from "@/lib/db/payments.intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUUID(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function safeQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return 1;
  return Math.min(n, 10);
}

export async function POST(req: Request) {
  try {
    console.log("🟡 [CREATE_INTENT] START");

    const auth = await getUserFromBearer();

    if (!auth) {
      console.warn("🟠 [CREATE_INTENT] UNAUTHORIZED");
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = auth.userId;

    console.log("🟡 [CREATE_INTENT] AUTH_OK", { userId });

    const raw = await req.json().catch(() => null);

    console.log("🟡 [CREATE_INTENT] RAW_BODY", raw);

    if (!raw || typeof raw !== "object") {
      console.warn("🟠 [CREATE_INTENT] INVALID_BODY");
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const body = raw as {
      product_id?: unknown;
      variant_id?: unknown;
      quantity?: unknown;
      country?: unknown;
      zone?: unknown;
      shipping?: unknown;
    };

    const productId =
      typeof body.product_id === "string"
        ? body.product_id.trim()
        : "";

    const variantId =
      typeof body.variant_id === "string" && body.variant_id.trim()
        ? body.variant_id.trim()
        : null;

    const quantity = safeQty(body.quantity);

    const country =
      typeof body.country === "string"
        ? body.country.trim().toUpperCase()
        : "";

    const zone =
      typeof body.zone === "string"
        ? body.zone.trim()
        : "";

    const shipping =
      body.shipping && typeof body.shipping === "object"
        ? body.shipping
        : null;

    console.log("🟡 [CREATE_INTENT] NORMALIZED", {
      userId,
      productId,
      variantId,
      quantity,
      country,
      zone,
      hasShipping: !!shipping,
    });

    if (!isUUID(productId)) {
      console.warn("🟠 [CREATE_INTENT] INVALID_PRODUCT_ID", { productId });
      return NextResponse.json({ error: "INVALID_PRODUCT_ID" }, { status: 400 });
    }

    if (!country) {
      console.warn("🟠 [CREATE_INTENT] INVALID_COUNTRY");
      return NextResponse.json({ error: "INVALID_COUNTRY" }, { status: 400 });
    }

    if (!zone) {
      console.warn("🟠 [CREATE_INTENT] INVALID_ZONE");
      return NextResponse.json({ error: "INVALID_ZONE" }, { status: 400 });
    }

    if (!shipping) {
      console.warn("🟠 [CREATE_INTENT] INVALID_SHIPPING");
      return NextResponse.json({ error: "INVALID_SHIPPING" }, { status: 400 });
    }

    console.log("🟡 [CREATE_INTENT] CALL_DB_CREATE");

    const intent = await createPiPaymentIntent({
      userId,
      productId,
      variantId,
      quantity,
      country,
      zone,
      shipping: shipping as {
        name: string;
        phone: string;
        address_line: string;
        ward?: string | null;
        district?: string | null;
        region?: string | null;
        postal_code?: string | null;
      },
    });

    console.log("🟢 [CREATE_INTENT] DB_CREATE_OK", intent);

    console.log("🟢 [CREATE_INTENT] SUCCESS");

    return NextResponse.json(intent);
  } catch (err) {
    console.error("🔥 [CREATE_INTENT] CRASH", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "CREATE_INTENT_FAILED",
      },
      { status: 400 }
    );
  }
}
