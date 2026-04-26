import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { previewOrder } from "@/lib/db/orders";
import { getShippingRatesByProductId } from "@/lib/db/shippingRates";

export const runtime = "nodejs";

/* ================= TYPES ================= */

type PreviewItem = {
  product_id: string;
  quantity: number;
  variant_id?: string | null;
};

type PreviewBody = {
  country?: string;
  zone?: string;
  items?: PreviewItem[];
};

/* ================= UTILS ================= */

function isUUID(value: string): boolean {
  if (typeof value !== "string") return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

/* ================= API ================= */

export async function POST(req: NextRequest) {
  try {
    console.log("🟡 [ORDER][PREVIEW] START");

    /* ================= AUTH ================= */

    const auth = await requireAuth();

    if (!auth.ok) {
      console.log("🔴 [ORDER][PREVIEW] AUTH FAILED");
      return auth.response;
    }

    const userId = auth.userId;
    console.log("🟢 [ORDER][PREVIEW] USER:", userId);

    /* ================= BODY ================= */

    const body = (await req.json().catch(() => null)) as PreviewBody | null;

    console.log("🟡 [ORDER][PREVIEW] BODY:", body);

    if (!body || typeof body !== "object") {
      console.log("🔴 [ORDER][PREVIEW] INVALID BODY");
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const { country, items } = body;

    /* ================= COUNTRY ================= */

    if (!country || typeof country !== "string") {
      console.log("🔴 [ORDER][PREVIEW] INVALID COUNTRY:", country);
      return NextResponse.json({ error: "INVALID_COUNTRY" }, { status: 400 });
    }

    console.log("🟢 [ORDER][PREVIEW] COUNTRY:", country);

    /* ================= REGION ================= */

    const zone =
      typeof body.zone === "string"
        ? body.zone.trim().toLowerCase()
        : "";

    if (!zone) {
      console.log("🔴 [ORDER][PREVIEW] MISSING REGION");
      return NextResponse.json({ error: "MISSING_REGION" }, { status: 400 });
    }

    console.log("🟢 [ORDER][PREVIEW] ZONE:", zone);

    /* ================= ITEMS ================= */

    if (!Array.isArray(items) || items.length === 0) {
      console.log("🔴 [ORDER][PREVIEW] EMPTY ITEMS");
      return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
    }

    console.log("🟡 [ORDER][PREVIEW] RAW ITEMS:", items);

    const cleanItems: PreviewItem[] = [];

    for (const item of items) {
      if (!item || typeof item !== "object") {
        console.log("⚠️ [ORDER][PREVIEW] SKIP INVALID ITEM:", item);
        continue;
      }

      const productId =
        typeof item.product_id === "string"
          ? item.product_id.trim()
          : "";

      const quantity =
        typeof item.quantity === "number" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
          ? item.quantity
          : 0;

      const variantId =
        typeof item.variant_id === "string"
          ? item.variant_id.trim()
          : null;

      if (!productId || !isUUID(productId)) {
        console.log("🔴 INVALID PRODUCT ID:", productId);
        continue;
      }

      if (variantId && !isUUID(variantId)) {
        console.log("🔴 INVALID VARIANT ID:", variantId);
        continue;
      }

      if (quantity <= 0) {
        console.log("🔴 INVALID QUANTITY:", quantity);
        continue;
      }

      cleanItems.push({
        product_id: productId,
        quantity,
        variant_id: variantId,
      });
    }

    console.log("🟢 [ORDER][PREVIEW] CLEAN ITEMS:", cleanItems);

    if (cleanItems.length === 0) {
      console.log("🔴 [ORDER][PREVIEW] NO VALID ITEMS");
      return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
    }

    console.log("🧾 [ORDER][PREVIEW] FINAL ITEMS:", cleanItems);

    /* ================= VERIFY DOMESTIC SHIPPING ================= */

    for (const item of cleanItems) {
      const shippingRates = await getShippingRatesByProductId(item.product_id);

      const domesticRate = shippingRates.find((r) => r.zone === "domestic");

      if (
        zone === "domestic" &&
        domesticRate?.domesticCountryCode &&
        domesticRate.domesticCountryCode.toUpperCase() !== country.toUpperCase()
      ) {
        console.log("🔴 [ORDER][PREVIEW] DOMESTIC COUNTRY NOT MATCH", {
          userCountry: country,
          sellerDomestic: domesticRate.domesticCountryCode,
        });

        return NextResponse.json(
          { error: "DOMESTIC_NOT_AVAILABLE" },
          { status: 400 }
        );
      }
    }

    /* ================= CALL DB ================= */

    console.log("🟡 [ORDER][PREVIEW] CALL previewOrder");

    const result = await previewOrder({
      userId,
      country,
      zone,
      items: cleanItems,
    });

    console.log("🟢 [ORDER][PREVIEW] RESULT:", result);

    /* ================= RESPONSE ================= */

    return NextResponse.json(result);
  } catch (err) {
    console.error("🔥 [ORDER][PREVIEW] ERROR:", err);

    return NextResponse.json(
      { error: "PREVIEW_FAILED" },
      { status: 500 }
    );
  }
}
