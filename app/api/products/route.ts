  import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import {
  upsertShippingRates,
  getShippingRatesByProducts,
} from "@/lib/db/shipping";
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
  replaceVariantsByProductId,
  type ProductVariant,
} from "@/lib/db/variants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= NORMALIZE ================= */


    function normalizeVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  const result: ProductVariant[] = [];

  input.forEach((item, index) => {
    if (typeof item !== "object" || item === null) return;
    const row = item as Record<string, unknown>;
    const raw = typeof row.optionValue === "string"
      ? row.optionValue.trim()
      : "";

    /* 🔥 HARD VALIDATION */
    if (!raw || raw.length === 0) {
      console.warn("⚠️ INVALID VARIANT SKIPPED:", row);
      return;
    }

    result.push({
      id: typeof row.id === "string" ? row.id : undefined,

      optionName:
        typeof row.optionName === "string" && row.optionName.trim()
          ? row.optionName.trim()
          : "option",

      optionValue: raw, // ✅ ALWAYS VALID STRING

      price:
        typeof row.price === "number" &&
        !Number.isNaN(row.price)
          ? row.price
          : 0,

      salePrice:
        typeof row.salePrice === "number"
          ? row.salePrice
          : null,

      stock:
        typeof row.stock === "number" && row.stock >= 0
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
    });
  });

  console.log("🧩 VALID VARIANTS:", result);

  return result;
}

/* ================= GET ================= */

export async function GET(req: Request) {
  try {
    console.log("🚀 [API][PRODUCTS] START");

    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");

    let products: ProductRecord[] = [];

    /* ================= LOAD PRODUCTS ================= */
    if (ids) {
      const idArray = ids.split(",").map((i) => i.trim()).filter(Boolean);

      console.log("📦 IDS:", idArray);

      if (!idArray.length) return NextResponse.json([]);

      products = await getProductsByIds(idArray);
    } else {
      products = await getAllProducts();
    }

    console.log("📦 PRODUCTS:", products.length);

    const productIds = products.map((p) => p.id);

    /* ================= SHIPPING ================= */
    const shippingRows =
      productIds.length > 0
        ? await getShippingRatesByProducts(productIds)
        : [];

    console.log("🚚 SHIPPING ROWS:", shippingRows);

    const shippingMap = new Map<
      string,
      { zone: string; price: number }[]
    >();

    for (const r of shippingRows) {
      if (!shippingMap.has(r.product_id)) {
        shippingMap.set(r.product_id, []);
      }

      shippingMap.get(r.product_id)!.push({
        zone: r.zone,
        price: r.price,
      });
    }

    console.log("🚚 SHIPPING MAP:", shippingMap.size);

    const now = Date.now();

    /* ================= ENRICH ================= */
    const enriched = await Promise.all(
      products.map(async (p) => {
        console.log("🔍 PRODUCT:", p.id);

        const variants = await getVariantsByProductId(p.id);

        console.log("🧩 VARIANTS:", variants.length);

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
        /* ================= VARIANT FIX (FULL) ================= */

/* ✅ 1. chỉ lấy variant active */
const activeVariants = variants.filter(
  (v) => v.isActive !== false
);

/* ✅ 2. tính giá variant theo sale time product */
const enrichedVariants = activeVariants.map((v) => {
  const basePrice =
    typeof v.price === "number" && v.price > 0
      ? v.price
      : p.price;

  const finalPrice =
    typeof v.salePrice === "number" &&
    v.salePrice > 0 &&
    start !== null &&
    end !== null &&
    now >= start &&
    now <= end
      ? v.salePrice
      : basePrice;

  return {
    ...v,
    finalPrice,
  };
});

/* ================= STOCK ================= */
const finalStock =
  enrichedVariants.length > 0
    ? enrichedVariants.reduce((s, v) => s + (v.stock || 0), 0)
    : p.stock ?? 0;

/* ================= PRODUCT PRICE ================= */
const productFinalPrice =
  typeof p.sale_price === "number" && isSale
    ? p.sale_price
    : p.price;

/* ================= PRICE RANGE ================= */
let minPrice: number | null = null;
let maxPrice: number | null = null;

if (enrichedVariants.length > 0) {
  const prices = enrichedVariants
    .map((v) => v.finalPrice)
    .filter((p) => typeof p === "number" && p > 0);

  if (prices.length) {
    minPrice = Math.min(...prices);
    maxPrice = Math.max(...prices);
  }
}

/* ================= HAS VARIANTS ================= */
const hasVariants = enrichedVariants.length > 0;
        
        return {
          id: p.id,
          sellerId: p.seller_id,
          name: p.name,

          price: p.price ?? 0,
          salePrice: p.sale_price ?? null,
          finalPrice: hasVariants ? null : productFinalPrice,
          hasVariants,

          minPrice,
          maxPrice,

          stock: finalStock,

          thumbnail: p.thumbnail ?? "",
          images: p.images ?? [],
          categoryId: p.category_id ?? null,

          variants: enrichedVariants,

          shippingRates: shippingMap.get(p.id) ?? [],
        };
      })
    );

    console.log("🎉 [API][PRODUCTS] SUCCESS");

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("💥 [API][PRODUCTS] ERROR:", err);

    return NextResponse.json(
      { error: "FAILED_TO_FETCH_PRODUCTS" },
      { status: 500 }
    );
  }
}

/* ================= POST ================= */

export async function POST(req: Request) {
  console.log("🚀 [PRODUCT][POST] START");

  /* ================= AUTH ================= */
  const auth = await requireSeller();

  if (!auth.ok) {
    console.error("❌ [AUTH FAILED]");
    return auth.response;
  }

  const userId = auth.userId;

  try {
    const body = await req.json();

    console.log("📦 BODY:", body);

    /* ================= IDEMPOTENCY ================= */
    const key =
      typeof body.idempotencyKey === "string"
        ? body.idempotencyKey
        : null;

    if (!key) {
      return NextResponse.json(
        { error: "MISSING_IDEMPOTENCY_KEY" },
        { status: 400 }
      );
    }

    globalThis.__PRODUCT_KEYS__ =
      globalThis.__PRODUCT_KEYS__ || new Map();

    if (globalThis.__PRODUCT_KEYS__.has(key)) {
      console.warn("⚠️ DUPLICATE REQUEST BLOCKED");

      return NextResponse.json({
        success: true,
        duplicate: true,
      });
    }

    /* ================= VALIDATE INPUT ================= */
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "INVALID_NAME" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json(
        { error: "IMAGE_REQUIRED" },
        { status: 400 }
      );
    }

   /* ================= VARIANTS ================= */
const variants = normalizeVariants(body.variants);

console.log("🧩 VALID VARIANTS:", variants);

const hasVariants = variants.length > 0;

/* ================= PRICE ================= */
const price = hasVariants
  ? 1 // hoặc 0 nếu DB cho phép
  : typeof body.price === "number"
  ? body.price
  : 0;

const salePrice =
  typeof body.salePrice === "number" ? body.salePrice : null;

if (salePrice !== null && salePrice >= price) {
  return NextResponse.json(
    { error: "INVALID_SALE_PRICE" },
    { status: 400 }
  );
}

/* ================= STOCK ================= */
const finalStock = hasVariants
  ? variants.reduce((s, v) => s + v.stock, 0)
  : typeof body.stock === "number"
  ? body.stock
  : 0;

    /* ================= STOCK VALIDATION ================= */
    if (hasVariants) {
  if (body.stock) {
    return NextResponse.json(
      { error: "DO_NOT_USE_PRODUCT_STOCK_WITH_VARIANTS" },
      { status: 400 }
    );
  }

  if (body.price !== undefined){
    return NextResponse.json(
      { error: "DO_NOT_USE_PRODUCT_PRICE_WITH_VARIANTS" },
      { status: 400 }
    );
  }

  if (body.salePrice) {
    return NextResponse.json(
      { error: "DO_NOT_USE_PRODUCT_SALE_WITH_VARIANTS" },
      { status: 400 }
    );
  }
}

    /* ================= CATEGORY ================= */
    const categoryId =
      typeof body.categoryId === "string" &&
      !Number.isNaN(Number(body.categoryId))
        ? Number(body.categoryId)
        : null;

    /* ================= CREATE PRODUCT ================= */
    let product;

    try {
      product = await createProduct(userId, {
        name: body.name.trim(),
        price,
        description: body.description ?? "",
        detail: body.detail ?? "",
        images: body.images,
        thumbnail:
          typeof body.thumbnail === "string"
            ? body.thumbnail
            : body.images[0],
        category_id: categoryId,
        sale_price: salePrice,
        sale_start: body.saleStart || null,
        sale_end: body.saleEnd || null,
        stock: finalStock,
        is_active:
          typeof body.isActive === "boolean"
            ? body.isActive
            : true,
        views: 0,
        sold: 0,
      });

    } catch (err: any) {
      console.error("💥 CREATE PRODUCT ERROR:", err?.code);

      /* 🔥 RETRY SLUG */
      if (err?.code === "23505") {
        console.warn("⚠️ DUPLICATE SLUG → RETRY");

        product = await createProduct(userId, {
          name:
            body.name.trim() +
            "-" +
            Date.now() +
            "-" +
            Math.random().toString(36).slice(2, 6),
          
          description: body.description ?? "",
          price: hasVariants ? 0 : price,
          detail: body.detail ?? "",
          images: body.images,
          thumbnail:
            typeof body.thumbnail === "string"
              ? body.thumbnail
              : body.images[0],
          category_id: categoryId,
          sale_price: hasVariants ? null : salePrice,
         stock: hasVariants ? 0 : finalStock,
          sale_start: body.saleStart || null,
          sale_end: body.saleEnd || null,
        
          is_active:
            typeof body.isActive === "boolean"
              ? body.isActive
              : true,
          views: 0,
          sold: 0,
        });
      } else {
        throw err;
      }
    }

    console.log("✅ PRODUCT CREATED:", product.id);

    /* ================= SHIPPING ================= */
    if (Array.isArray(body.shippingRates)) {
      await upsertShippingRates({
        productId: product.id,
        rates: body.shippingRates,
      });
    }

    /* ================= VARIANTS ================= */
    if (hasVariants) {
      await replaceVariantsByProductId(product.id, variants);
    }

    /* ================= IDEMPOTENCY SAVE ================= */
    globalThis.__PRODUCT_KEYS__.set(key, true);

    setTimeout(() => {
      globalThis.__PRODUCT_KEYS__.delete(key);
    }, 60 * 1000);

    console.log("🎉 [PRODUCT][POST] SUCCESS");

    return NextResponse.json({
      success: true,
      data: { id: product.id },
    });

  } catch (err) {
    console.error("💥 [PRODUCT][POST ERROR]:", err);

    return NextResponse.json(
      { error: "FAILED_TO_CREATE_PRODUCT" },
      { status: 500 }
    );
  }
}
/* ================= PUT ================= */

export async function PUT(req: Request) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const productId = String(body.id);

    const variants = normalizeVariants(body.variants);

    const finalStock =
      variants.length > 0
        ? variants.reduce((s, v) => s + v.stock, 0)
        : typeof body.stock === "number"
        ? body.stock
        : 0;

    const price =
      typeof body.price === "number" ? body.price : 0;

    const salePrice =
      typeof body.salePrice === "number" ? body.salePrice : null;

    if (salePrice !== null && salePrice >= price) {
      return NextResponse.json(
        { error: "INVALID_SALE_PRICE" },
        { status: 400 }
      );
    }

    const updated = await updateProductBySeller(userId, productId, {
      name: String(body.name || "").trim(),
      price: hasVariants ? 0 : price,
      description: body.description ?? "",
      detail: body.detail ?? "",
      images: Array.isArray(body.images)
        ? body.images.filter((i: unknown): i is string => typeof i === "string")
        : [],
      thumbnail:
        typeof body.thumbnail === "string" ? body.thumbnail : null,
      category_id:
        typeof body.categoryId === "string"
          ? Number(body.categoryId)
          : null,
      sale_price: hasVariants ? null : salePrice,
      stock: hasVariants ? 0 : finalStock,
      sale_start: body.saleStart || null,
      sale_end: body.saleEnd || null,
      is_active:
        typeof body.isActive === "boolean" ? body.isActive : true,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    await Promise.all([
      replaceVariantsByProductId(productId, variants),
      Array.isArray(body.shippingRates)
        ? upsertShippingRates({
            productId,
            rates: body.shippingRates,
          })
        : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "FAILED_TO_UPDATE_PRODUCT" },
      { status: 500 }
    );
  }
}

/* ================= DELETE ================= */

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
