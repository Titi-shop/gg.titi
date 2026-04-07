import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { upsertShippingRates, getShippingRatesByProduct } from "@/lib/db/shipping";
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
   NORMALIZE VARIANTS
========================================================= */

function normalizeVariants(input: unknown): ProductVariant[] {
  console.log("[PRODUCT][VARIANT] normalize start");

  if (!Array.isArray(input)) {
    console.log("[PRODUCT][VARIANT] not array");
    return [];
  }

  const result = input
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
          typeof row.sortOrder === "number"
            ? row.sortOrder
            : index,
        isActive:
          typeof row.isActive === "boolean"
            ? row.isActive
            : true,
      };
    })
    .filter((i): i is ProductVariant => i !== null);

  console.log("[PRODUCT][VARIANT] normalized:", result.length);

  return result;
}

function getTotalVariantStock(variants: ProductVariant[]) {
  const total = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  console.log("[PRODUCT][STOCK] variant total:", total);
  return total;
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const id = context?.params?.id;

    console.log("[PRODUCT][GET] start", { id });

    if (!id) {
      console.warn("[PRODUCT][GET] missing id");
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const p = await getProductById(id);

    if (!p) {
      console.log("[PRODUCT][GET] not found");
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    console.log("[PRODUCT][GET] product found");

    const variants = await getVariantsByProductId(id);
    console.log("[PRODUCT][GET] variants:", variants.length);

    let shippingRates: { zone: string; price: number }[] = [];

    try {
      shippingRates = await getShippingRatesByProduct(p.id);
      console.log("[PRODUCT][GET] shipping:", shippingRates.length);
    } catch {
      console.warn("[PRODUCT][GET] shipping failed");
      shippingRates = [];
    }

    console.log("[PRODUCT][GET] done");
    const now = Date.now();

const start = p.sale_start
  ? new Date(p.sale_start).getTime()
  : null;

const end = p.sale_end
  ? new Date(p.sale_end).getTime()
  : null;

const isSale =
  typeof p.sale_price === "number" &&
  start !== null &&
  end !== null &&
  now >= start &&
  now <= end;

    return NextResponse.json({
  id: p.id,
  sellerId: p.seller_id,
  name: p.name,
  slug: p.slug ?? "",
  shortDescription: p.short_description ?? "",
  description: p.description ?? "",
  detail: p.detail ?? "",
  thumbnail: p.thumbnail ?? "",
  images: p.images ?? [],
  detailImages: p.detail_images ?? [],
  videoUrl: p.video_url ?? "",
  price: p.price ?? 0,
  salePrice: p.sale_price ?? null,
  finalPrice: isSale ? p.sale_price ?? p.price : p.price,
  currency: p.currency ?? "PI",
  stock: p.stock ?? 0,
  isUnlimited: p.is_unlimited ?? false,
  sold: p.sold ?? 0,
  views: p.views ?? 0,
  ratingAvg: p.rating_avg ?? 0,
  ratingCount: p.rating_count ?? 0,
  isActive: p.is_active ?? true,
  isFeatured: p.is_featured ?? false,
  isDigital: p.is_digital ?? false,
  status: p.status ?? "active",
  categoryId: p.category_id ?? null,
  saleStart: p.sale_start ?? null,
  saleEnd: p.sale_end ?? null,
  metaTitle: p.meta_title ?? "",
  metaDescription: p.meta_description ?? "",
  createdAt: p.created_at,
  updatedAt: p.updated_at,
  deletedAt: p.deleted_at ?? null,

  variants,
  shippingRates,
});
  } catch (err) {
    console.error("[PRODUCT][GET] ERROR");

    return NextResponse.json(
      { error: "FAILED_TO_FETCH_PRODUCT" },
      { status: 500 }
    );
  }
}

/* =========================================================
   PATCH
========================================================= */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log("[PRODUCT][PATCH] start");

  const auth = await requireSeller();
  if (!auth.ok) {
    console.warn("[PRODUCT][PATCH] auth failed");
    return auth.response;
  }

  const userId = auth.userId;

  try {
    const id = params.id;

    console.log("[PRODUCT][PATCH] productId:", id);

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const body = await req.json();

    console.log("[PRODUCT][PATCH] body received", {
      hasVariants: Array.isArray(body?.variants),
      hasShipping: Array.isArray(body?.shippingRates),
    });

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    /* ================= VARIANTS ================= */
    const normalizedVariants = normalizeVariants(body.variants);

    const hasVariants = normalizedVariants.length > 0;

    const finalStock = hasVariants
      ? getTotalVariantStock(normalizedVariants)
      : typeof body.stock === "number" && body.stock >= 0
      ? body.stock
      : 0;

    console.log("[PRODUCT][PATCH] finalStock:", finalStock);

    /* ================= UPDATE ================= */
    const updated = await updateProductBySeller(
      userId,
      id,
      {
        name: typeof body.name === "string" ? body.name.trim() : undefined,
        description: body.description,
        detail: body.detail,
        images: Array.isArray(body.images)
          ? body.images.filter((i: unknown): i is string => typeof i === "string")
          : undefined,
        thumbnail:
          body.thumbnail !== undefined
            ? typeof body.thumbnail === "string"
              ? body.thumbnail
              : null
            : undefined,
        category_id:
  typeof body.categoryId === "number"
    ? body.categoryId
    : null,
        price:
          typeof body.price === "number" ? body.price : undefined,
        sale_price:
          typeof body.salePrice === "number"
            ? body.salePrice
            : null,
        sale_start: body.saleStart,
        sale_end: body.saleEnd,
        stock: finalStock,
        is_active:
  typeof body.isActive === "boolean"
    ? body.isActive
    : undefined,
      }
    );

    console.log("[PRODUCT][PATCH] updated:", updated);

    if (!updated) {
      console.warn("[PRODUCT][PATCH] not found");
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    const now = Date.now();

const start = p.sale_start
  ? new Date(p.sale_start).getTime()
  : null;

const end = p.sale_end
  ? new Date(p.sale_end).getTime()
  : null;

const isSale =
  typeof p.sale_price === "number" &&
  start !== null &&
  end !== null &&
  now >= start &&
  now <= end;
    /* ================= SHIPPING ================= */
    if (Array.isArray(body.shippingRates)) {
      console.log("[PRODUCT][PATCH] upsert shipping:", body.shippingRates.length);

      await upsertShippingRates({
        productId: id,
        rates: body.shippingRates,
      });
    }

    /* ================= VARIANTS ================= */
    if (Array.isArray(body.variants)) {
      console.log("[PRODUCT][PATCH] replace variants");

      await replaceVariantsByProductId(id, normalizedVariants);
    }

    /* ================= REFRESH ================= */
    const p = await getProductById(id);

    if (!p) {
      console.warn("[PRODUCT][PATCH] product missing after update");
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const variants = await getVariantsByProductId(id);

    let shippingRates: { zone: string; price: number }[] = [];

    try {
      shippingRates = await getShippingRatesByProduct(id);
    } catch {
      console.warn("[PRODUCT][PATCH] shipping reload failed");
      shippingRates = [];
    }

    console.log("[PRODUCT][PATCH] done");

    return NextResponse.json({
  id: p.id,
  sellerId: p.seller_id,

  name: p.name,
  slug: p.slug ?? "",

  shortDescription: p.short_description ?? "",
  description: p.description ?? "",
  detail: p.detail ?? "",

  thumbnail: p.thumbnail ?? "",
  images: p.images ?? [],
  detailImages: p.detail_images ?? [],

  videoUrl: p.video_url ?? "",

  price: p.price ?? 0,
  salePrice: p.sale_price ?? null,
  finalPrice: isSale ? p.sale_price ?? p.price : p.price,

  currency: p.currency ?? "PI",

  stock: p.stock ?? 0,
  isUnlimited: p.is_unlimited ?? false,

  sold: p.sold ?? 0,
  views: p.views ?? 0,

  ratingAvg: p.rating_avg ?? 0,
  ratingCount: p.rating_count ?? 0,

  isActive: p.is_active ?? true,
  isFeatured: p.is_featured ?? false,
  isDigital: p.is_digital ?? false,
  status: p.status ?? "active",

  categoryId: p.category_id ?? null,
  saleStart: p.sale_start ?? null,
  saleEnd: p.sale_end ?? null,
  metaTitle: p.meta_title ?? "",
  metaDescription: p.meta_description ?? "",
  createdAt: p.created_at,
  updatedAt: p.updated_at,
  deletedAt: p.deleted_at ?? null,
  variants,
  shippingRates,
});
  } catch (err) {
  console.error("[PRODUCT][PATCH] ERROR:", err);

  return NextResponse.json(
    { error: "FAILED_TO_UPDATE_PRODUCT" },
    { status: 500 }

    );
  }
}
