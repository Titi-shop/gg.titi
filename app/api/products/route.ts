import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { upsertShippingRates, getShippingRatesByProduct } from "@/lib/db/shipping";

import type { ProductRecord } from "@/lib/db/products";
import {
  createProduct,
  updateProductBySeller,
  getAllProducts,
  getProductsByIds,
  deleteProductBySeller,
} from "@/lib/db/products";

import {
  getVariantsByProductId,
  createVariantsForProduct,
  replaceVariantsByProductId,
} from "@/lib/db/variants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type ProductVariantInput = {
  id?: string;
  optionName?: string;
  optionValue: string;
  stock: number;
  sku?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

/* =========================================================
   NORMALIZE VARIANTS
========================================================= */

function normalizeVariants(input: unknown): ProductVariantInput[] {
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
    .filter((i): i is ProductVariantInput => i !== null);
}

/* =========================================================
   GET — PUBLIC PRODUCTS
========================================================= */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");

    let products: ProductRecord[] = [];

    /* ================= DB ================= */
    if (ids) {
      const idArray = ids
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (!idArray.length) return NextResponse.json([]);

      products = await getProductsByIds(idArray);
    } else {
      products = await getAllProducts();
    }

    const now = Date.now();

    /* ================= ENRICH ================= */
    const enriched = await Promise.all(
  products.map(async (p) => {
    let variants: ProductVariantInput[] = [];

    try {
      variants = await getVariantsByProductId(p.id);
    } catch {
      // ignore
    }

    /* ================= SHIPPING ================= */
    let shipping_rates: ShippingRateFE[] = [];

    try {
      shipping_rates = await getShippingRatesByProduct(p.id);
    } catch {
      // ignore
    }

    /* ================= SALE ================= */
    const start = p.sale_start ? new Date(p.sale_start).getTime() : null;
    const end = p.sale_end ? new Date(p.sale_end).getTime() : null;

    const isSale =
      typeof p.sale_price === "number" &&
      start !== null &&
      end !== null &&
      now >= start &&
      now <= end;

    /* ================= STOCK ================= */
    const baseStock =
      typeof p.stock === "number" ? p.stock : 0;

    const hasVariants = variants.length > 0;

    const totalVariantStock = hasVariants
      ? variants.reduce((s, v) => s + (v.stock || 0), 0)
      : 0;

    const finalStock = hasVariants ? totalVariantStock : baseStock;

    const isActive = p.is_active !== false;

    /* ================= RETURN ================= */
    return {
      id: p.id,
      name: p.name,

      description: p.description ?? "",
      detail: p.detail ?? "",

      images: Array.isArray(p.images) ? p.images : [],
      thumbnail: p.thumbnail ?? p.images?.[0] ?? "",

      categoryId: p.category_id ?? null,

      price: typeof p.price === "number" ? p.price : 0,
      salePrice:
        typeof p.sale_price === "number" ? p.sale_price : null,

      isSale,
      finalPrice:
        isSale && typeof p.sale_price === "number"
          ? p.sale_price
          : p.price,

      stock: finalStock,
      isActive,
      isOutOfStock: finalStock <= 0 || !isActive,

      views: p.views ?? 0,
      sold: p.sold ?? 0,
      rating_avg: p.rating_avg ?? 0,
      rating_count: p.rating_count ?? 0,

      variants,

      /* ✅ QUAN TRỌNG */
      shipping_rates,
    };
  })
);

    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json(
      { error: "FAILED_TO_FETCH_PRODUCTS" },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST — CREATE PRODUCT
========================================================= */

export async function POST(req: Request) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const normalizedVariants = normalizeVariants(body.variants);

    const hasVariants = normalizedVariants.length > 0;

    const finalStock = hasVariants
      ? normalizedVariants.reduce((s, v) => s + v.stock, 0)
      : typeof body.stock === "number" && body.stock >= 0
      ? body.stock
      : 0;

    const product = await createProduct(userId, {
      name: String(body.name).trim(),
      price: Number(body.price),

      description: body.description ?? "",
      detail: body.detail ?? "",

      images: Array.isArray(body.images)
        ? body.images.filter((i: unknown): i is string => typeof i === "string")
        : [],

      thumbnail:
        typeof body.thumbnail === "string" ? body.thumbnail : null,

      category_id:
        typeof body.categoryId === "string" ? body.categoryId : null,

      sale_price:
        typeof body.salePrice === "number" ? body.salePrice : null,

      sale_start:
        typeof body.saleStart === "string" ? body.saleStart : null,

      sale_end:
        typeof body.saleEnd === "string" ? body.saleEnd : null,

      stock: finalStock,
      is_active:
        typeof body.is_active === "boolean" ? body.is_active : true,

      views: 0,
      sold: 0,
    });
    if (Array.isArray(body.shipping_rates)) {
  await upsertShippingRates({
    productId: product.id,
    rates: body.shipping_rates,
  });
}

    if (hasVariants) {
      await createVariantsForProduct(product.id, normalizedVariants);
    }

    return NextResponse.json({ success: true, data: product });
  } catch (err) {
  console.error("❌ CREATE PRODUCT ERROR:", err);

  return NextResponse.json(
    { error: "FAILED_TO_CREATE_PRODUCT" },
    { status: 500 }
  );
}
}

/* =========================================================
   PUT — UPDATE PRODUCT
========================================================= */

export async function PUT(req: Request) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const productId = String(body.id);

    const normalizedVariants = normalizeVariants(body.variants);

    const hasVariants = normalizedVariants.length > 0;

    const finalStock = hasVariants
      ? normalizedVariants.reduce((s, v) => s + v.stock, 0)
      : typeof body.stock === "number" && body.stock >= 0
      ? body.stock
      : 0;

    const updated = await updateProductBySeller(
      userId,
      productId,
      {
        name: String(body.name).trim(),
        price: Number(body.price),

        description: body.description ?? "",
        detail: body.detail ?? "",

        images: Array.isArray(body.images)
          ? body.images.filter((i: unknown): i is string => typeof i === "string")
          : [],

        thumbnail:
          typeof body.thumbnail === "string" ? body.thumbnail : null,

        category_id:
          typeof body.categoryId === "string" ? body.categoryId : null,

        sale_price:
          typeof body.salePrice === "number" ? body.salePrice : null,

        sale_start:
          typeof body.saleStart === "string" ? body.saleStart : null,

        sale_end:
          typeof body.saleEnd === "string" ? body.saleEnd : null,

        stock: finalStock,
        is_active:
          typeof body.is_active === "boolean" ? body.is_active : true,
      }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    await replaceVariantsByProductId(productId, normalizedVariants);

    if (Array.isArray(body.shipping_rates)) {
  await upsertShippingRates({
    productId: productId,
    rates: body.shipping_rates,
  });
}
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "FAILED_TO_UPDATE_PRODUCT" },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE — DELETE PRODUCT
========================================================= */

export async function DELETE(req: Request) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const deleted = await deleteProductBySeller(userId, id);

    if (!deleted) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "FAILED_TO_DELETE_PRODUCT" },
      { status: 500 }
    );
  }
}
