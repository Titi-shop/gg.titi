import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { upsertShippingRates, getShippingRatesBySeller } from "@/lib/db/shipping";
import {
  updateProductBySeller,
  getProductById,
} from "@/lib/db/products";

import {
  getVariantsByProductId,
  replaceVariantsByProductId,
  type ProductVariant,
} from "@/lib/db/variants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type PatchBody = {
  name?: string;
  description?: string;
  detail?: string;
  images?: string[];
  thumbnail?: string | null;
  categoryId?: string | null;
  price?: number;
  salePrice?: number | null;
  saleStart?: string | null;
  saleEnd?: string | null;
  stock?: number;
  is_active?: boolean;
  variants?: ProductVariant[];
  shipping_rates?: {
  zone: string;
  price: number;
}[];
};

/* =========================================================
   NORMALIZE VARIANTS
========================================================= */

function normalizeVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index) => {
      if (typeof item !== "object" || item === null) return null;

      const row = item as Record<string, unknown>;

      const optionValue =
        typeof row.optionValue === "string"
          ? row.optionValue.trim()
          : "";

      if (!optionValue) return null;

      return {
        id: typeof row.id === "string" ? row.id : undefined,
        optionName:
          typeof row.optionName === "string" && row.optionName.trim()
            ? row.optionName.trim()
            : "size",
        optionValue,
        stock:
          typeof row.stock === "number" &&
          !Number.isNaN(row.stock) &&
          row.stock >= 0
            ? row.stock
            : 0,
        sku:
          typeof row.sku === "string" && row.sku.trim()
            ? row.sku.trim()
            : null,
        sortOrder:
          typeof row.sortOrder === "number" &&
          !Number.isNaN(row.sortOrder)
            ? row.sortOrder
            : index,
        isActive:
          typeof row.isActive === "boolean"
            ? row.isActive
            : true,
      };
    })
    .filter((i): i is ProductVariant => i !== null);
}

function getTotalVariantStock(variants: ProductVariant[]) {
  return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
}

/* =========================================================
   GET — PRODUCT DETAIL
========================================================= */

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const id = context?.params?.id;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }
console.log("[PRODUCT][GET] start", { id });
    const p = await getProductById(id);

if (!p) {
  console.log("[PRODUCT][GET] not found");
  return NextResponse.json(
    { error: "PRODUCT_NOT_FOUND" },
    { status: 404 }
  );
}

const variants = await getVariantsByProductId(id);
const shippingRates = await getShippingRatesBySeller(p.seller_id);
console.log("[PRODUCT][GET] done", {
    variantCount: variants.length,
    shippingCount: shippingRates.length,
  });
return NextResponse.json({
  id: p.id,
  name: p.name,
  price: p.price,
  salePrice: p.sale_price ?? null,
  saleStart: p.sale_start ?? null,
  saleEnd: p.sale_end ?? null,
  description: p.description ?? "",
  detail: p.detail ?? "",
  images: p.images ?? [],
  thumbnail: p.thumbnail ?? (p.images?.[0] ?? ""),
  categoryId: p.category_id ?? null,
  stock: p.stock ?? 0,
  is_active: p.is_active ?? true,
  views: p.views ?? 0,
  sold: p.sold ?? 0,
  rating_avg: p.rating_avg ?? 0,
  rating_count: p.rating_count ?? 0,
  variants,
  shipping_rates: shippingRates,
});
  } catch (err) {
  console.error("[PRODUCT][GET] ERROR", err);

  return NextResponse.json(
    { error: "FAILED_TO_FETCH_PRODUCT" },
    { status: 500 }
  );
}
}

/* =========================================================
   PATCH — UPDATE PRODUCT
========================================================= */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }
console.log("[PRODUCT][PATCH] start", { userId, productId: id });
    const body = (await req.json()) as PatchBody;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    /* ================= VARIANTS ================= */
    console.log("[PRODUCT][PATCH] body", {
    hasShipping: Array.isArray(body.shipping_rates),
    variantCount: Array.isArray(body.variants) ? body.variants.length : 0,
  });
    const normalizedVariants = normalizeVariants(body.variants);
    console.log("[PRODUCT][PATCH] normalizedVariants", normalizedVariants.length);
    const hasVariants = normalizedVariants.length > 0;

    const finalStock = hasVariants
      ? getTotalVariantStock(normalizedVariants)
      : typeof body.stock === "number" && body.stock >= 0
      ? body.stock
      : 0;

    /* ================= SAFE PAYLOAD ================= */
    const payload: {
      name?: string;
      description?: string;
      detail?: string;
      images?: string[];
      thumbnail?: string | null;
      category_id?: string | null;
      price?: number;
      sale_price?: number | null;
      sale_start?: string | null;
      sale_end?: string | null;
      stock?: number;
      is_active?: boolean;

    } = {};

    if (typeof body.name === "string") payload.name = body.name.trim();

    if (body.description !== undefined)
      payload.description = body.description;

    if (body.detail !== undefined) payload.detail = body.detail;

    if (Array.isArray(body.images)) {
      payload.images = body.images.filter(
        (i): i is string => typeof i === "string"
      );
    }

    if (body.thumbnail !== undefined) {
      payload.thumbnail =
        typeof body.thumbnail === "string" ? body.thumbnail : null;
    }

    if (body.categoryId !== undefined) {
      payload.category_id =
        typeof body.categoryId === "string" &&
        body.categoryId.trim()
          ? body.categoryId
          : null;
    }

    if (
  typeof body.price === "number" &&
  !Number.isNaN(body.price)
) {
  payload.price = body.price;
}

/* ================= SHIPPING ================= */

    if (body.salePrice !== undefined) {
      payload.sale_price =
        typeof body.salePrice === "number"
          ? body.salePrice
          : null;
    
    }

    if (body.saleStart !== undefined)
      payload.sale_start = body.saleStart;

    if (body.saleEnd !== undefined)
      payload.sale_end = body.saleEnd;

    payload.stock = finalStock;

    if (body.is_active !== undefined)
      payload.is_active = body.is_active;

    /* ================= UPDATE ================= */
    const updated = await updateProductBySeller(
      userId,
      id,
      payload
    );
    console.log("[PRODUCT][PATCH] updated", updated);
    if (Array.isArray(body.shipping_rates)) {
  await upsertShippingRates({
    sellerId: userId,
    rates: body.shipping_rates,
  });
}

    if (!updated) {
      console.log("[PRODUCT][PATCH] NOT FOUND");
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    /* ================= VARIANTS ================= */
    if (Array.isArray(body.variants)) {
      console.log("[PRODUCT][PATCH] upsertShippingRates", body.shipping_rates);
      await replaceVariantsByProductId(id, normalizedVariants);
    }

    /* ================= REFRESH ================= */
    const p = await getProductById(id);
    const variants = await getVariantsByProductId(id);
    const shippingRates = await getShippingRatesBySeller(p.seller_id);
    if (!p) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: p.id,
      name: p.name,
      price: p.price,

      salePrice: p.sale_price ?? null,
      saleStart: p.sale_start ?? null,
      saleEnd: p.sale_end ?? null,

      description: p.description ?? "",
      detail: p.detail ?? "",

      images: p.images ?? [],
      thumbnail: p.thumbnail ?? (p.images?.[0] ?? ""),

      categoryId: p.category_id ?? null,
      stock: p.stock ?? 0,
      is_active: p.is_active ?? true,

      views: p.views ?? 0,
      sold: p.sold ?? 0,
      rating_avg: p.rating_avg ?? 0,
      rating_count: p.rating_count ?? 0,
      variants,
      shipping_rates: shippingRates,
    });
  } catch {
    console.error("[PRODUCT][PATCH] ERROR", err);
    return NextResponse.json(
      { error: "FAILED_TO_UPDATE_PRODUCT" },
      { status: 500 }
    );
  }
}
