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
    const rawVariants = await getVariantsByProductId(id);

const variants = rawVariants.map((v) => {
  const finalPrice =
    isSale
      ? (v.salePrice ?? v.price)
      : v.price;

  return {
    ...v,
    finalPrice,
  };
});

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
console.log("[API] product:", p);
    const hasVariants = variants.length > 0;

const totalStock = hasVariants
  ? variants.reduce((s, v) => s + (v.stock || 0), 0)
  : p.stock ?? 0;
    const hasVariants = variants.length > 0;
  const totalStock = hasVariants
  ? variants.reduce((s, v) => s + (v.stock || 0), 0)
  : p.stock ?? 0;
    const variantPrices = variants.map((v) =>
  typeof v.price === "number" ? v.price : 0
);

const minPrice =
  variantPrices.length > 0 ? Math.min(...variantPrices) : null;

const maxPrice =
  variantPrices.length > 0 ? Math.max(...variantPrices) : null;
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
  price: hasVariants ? null : p.price ?? 0,
  salePrice: hasVariants ? null : p.sale_price ?? null,
  stock: totalStock,
  minPrice: hasVariants ? minPrice : null,
  maxPrice: hasVariants ? maxPrice : null,
  currency: p.currency ?? "PI",
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
  console.error("[PRODUCT][GET] ERROR:", err);

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
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const id = params.id;

    /* ================= VALIDATE ID ================= */
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const body = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    /* ================= VALIDATE PRICE ================= */
    const price =
      typeof body.price === "number" && !Number.isNaN(body.price)
        ? body.price
        : undefined;

    const salePrice =
      typeof body.salePrice === "number" && !Number.isNaN(body.salePrice)
        ? body.salePrice
        : null;

    if (
      price !== undefined &&
      salePrice !== null &&
      salePrice >= price
    ) {
      return NextResponse.json(
        { error: "INVALID_SALE_PRICE" },
        { status: 400 }
      );
    }

    /* ================= NORMALIZE DATE ================= */
    const saleStart =
      typeof body.saleStart === "string" && body.saleStart
        ? body.saleStart
        : null;

    const saleEnd =
      typeof body.saleEnd === "string" && body.saleEnd
        ? body.saleEnd
        : null;

    /* ================= VARIANTS ================= */
    const normalizedVariants = normalizeVariants(body.variants);
    const hasVariants = normalizedVariants.length > 0;


    if (hasVariants) {
  if (body.stock !== undefined) {
    return NextResponse.json(
      { error: "DO_NOT_USE_PRODUCT_STOCK_WITH_VARIANTS" },
      { status: 400 }
    );
  }

  if (body.price !== undefined) {
    return NextResponse.json(
      { error: "DO_NOT_USE_PRODUCT_PRICE_WITH_VARIANTS" },
      { status: 400 }
    );
  }

  if (body.salePrice !== undefined) {
    return NextResponse.json(
      { error: "DO_NOT_USE_PRODUCT_SALE_WITH_VARIANTS" },
      { status: 400 }
    );
  }
}
    /* ================= CATEGORY ================= */
    const categoryId =
      typeof body.categoryId === "string"
        ? Number(body.categoryId)
        : typeof body.categoryId === "number"
        ? body.categoryId
        : null;

    /* ================= UPDATE ================= */
    const updated = await updateProductBySeller(userId, id, {
      name:
        typeof body.name === "string"
          ? body.name.trim()
          : undefined,

      description:
        typeof body.description === "string"
          ? body.description
          : undefined,

      detail:
        typeof body.detail === "string"
          ? body.detail
          : undefined,

      images: Array.isArray(body.images)
        ? body.images.filter((i: unknown): i is string => typeof i === "string")
        : undefined,

      thumbnail:
        body.thumbnail !== undefined
          ? typeof body.thumbnail === "string"
            ? body.thumbnail
            : null
          : undefined,

      category_id: categoryId,

      price: hasVariants ? 0 : price,
sale_price: hasVariants ? null : salePrice,
stock: hasVariants ? 0 : (
  typeof body.stock === "number" && body.stock >= 0
    ? body.stock
    : undefined
),

      sale_start: saleStart,
      sale_end: saleEnd,

      is_active:
        typeof body.isActive === "boolean"
          ? body.isActive
          : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    /* ================= PARALLEL ================= */
    await Promise.all([
      Array.isArray(body.shippingRates)
        ? upsertShippingRates({
            productId: id,
            rates: body.shippingRates,
          })
        : Promise.resolve(),

      Array.isArray(body.variants)
        ? replaceVariantsByProductId(id, normalizedVariants)
        : Promise.resolve(),
    ]);

    /* ================= FINAL PRICE ================= */
    const now = Date.now();

    const start = saleStart
      ? new Date(saleStart).getTime()
      : null;

    const end = saleEnd
      ? new Date(saleEnd).getTime()
      : null;

    const isSale =
      typeof salePrice === "number" &&
      start !== null &&
      end !== null &&
      now >= start &&
      now <= end;

    const totalStock = hasVariants
  ? normalizedVariants.reduce((s, v) => s + (v.stock || 0), 0)
  : updated.stock ?? 0;

    /* ================= RESPONSE ================= */
    return NextResponse.json({
  success: true,
  data: {
    id,
    name: updated.name,
    price: hasVariants ? null : updated.price,
    salePrice: hasVariants ? null : updated.sale_price,
    stock: totalStock,
  },
});

  } catch (err) {
    console.error("[PRODUCT][PATCH] ERROR:", err);

    return NextResponse.json(
      { error: "FAILED_TO_UPDATE_PRODUCT" },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE
========================================================= */

import { deleteProductById } from "@/lib/db/products";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log("[PRODUCT][DELETE] start");

  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;
  const id = params.id;

  try {
    /* ================= VALIDATE ================= */
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    /* ================= DB DELETE ================= */
    const result = await deleteProductById(id, userId);

    if (!result.ok) {
      console.warn("[PRODUCT][DELETE] failed:", result.error);

      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log("[PRODUCT][DELETE] paths:", result.paths.length);

    /* ================= STORAGE DELETE ================= */
    if (result.paths.length > 0) {
      const { error } = await supabaseAdmin.storage
        .from("products")
        .remove(result.paths);

      if (error) {
        console.error("[PRODUCT][DELETE] storage error:", error.message);
        // ❗ KHÔNG throw → tránh rollback DB
      } else {
        console.log("[PRODUCT][DELETE] storage cleaned");
      }
    }

    console.log("[PRODUCT][DELETE] success");

    return NextResponse.json({
      success: true,
    });

  } catch (err) {
    console.error("[PRODUCT][DELETE] ERROR:", err);

    return NextResponse.json(
      { error: "FAILED_TO_DELETE_PRODUCT" },
      { status: 500 }
    );
  }
}
