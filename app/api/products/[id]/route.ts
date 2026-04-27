
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
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const v: any = item;

      const option1 = (v.option1 ?? v.optionValue ?? "").toString().trim();
      const option2 = (v.option2 ?? "").toString().trim() || null;
      const option3 = (v.option3 ?? "").toString().trim() || null;

      if (!option1) return null;

      const price = Number(v.price) || 0;

      const salePrice =
        v.salePrice != null && !Number.isNaN(Number(v.salePrice))
          ? Number(v.salePrice)
          : null;

      const saleEnabled = Boolean(v.saleEnabled); // ✅ CHỈ LƯU DATA

      const finalPrice =
        saleEnabled &&
        salePrice !== null &&
        salePrice > 0 &&
        salePrice < price
          ? salePrice
          : price;

      return {
        id: typeof v.id === "string" ? v.id : undefined,

        option1,
        option2,
        option3,

        optionLabel1: v.optionLabel1 ?? null,
        optionLabel2: v.optionLabel2 ?? null,
        optionLabel3: v.optionLabel3 ?? null,

        optionName: v.optionLabel1 ?? "option",
        optionValue: option1,

        name: v.name ?? [option1, option2, option3].filter(Boolean).join(" - "),

        sku: v.sku ?? null,

        price,
        salePrice,
        finalPrice,

        stock: Number(v.stock) || 0,
        isUnlimited: Boolean(v.isUnlimited),

        saleEnabled, // ✅ đúng

        saleStock: Number(v.saleStock ?? 0),
        saleSold: Number(v.saleSold ?? 0),

        image: v.image ?? "",

        sortOrder: Number(v.sortOrder ?? index),
        isActive: v.isActive !== false,

        sold: Number(v.sold ?? 0),
      };
    })
    .filter(Boolean) as ProductVariant[];
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

    console.log("🚀 [PRODUCT][GET] START", { id });

    /* ================= VALIDATE ================= */
    if (!id) {
      console.warn("❌ MISSING PRODUCT ID");
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    /* ================= PRODUCT ================= */
    const p = await getProductById(id);

    if (!p) {
      console.warn("❌ PRODUCT NOT FOUND");
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    console.log("✅ PRODUCT FOUND");

    /* ================= SALE LOGIC ================= */
    const rawVariants = await getVariantsByProductId(id);
const hasVariants = rawVariants.length > 0;
    const now = Date.now();

const start = p.sale_start ? new Date(p.sale_start).getTime() : null;
const end = p.sale_end ? new Date(p.sale_end).getTime() : null;

const isProductSale =
  !hasVariants &&
  typeof p.sale_price === "number" &&
  start !== null &&
  end !== null &&
  now >= start &&
  now <= end;

    console.log("🔥 SALE STATUS:", { isProductSale, start, end });

    /* ================= VARIANTS ================= */

console.log("🧩 [API][GET] RAW VARIANTS FROM DB:", rawVariants);

const variants = rawVariants.map((v, i) => {
  console.log(`🔎 [API][GET][VARIANT ${i}] INPUT:`, v);

  const price = Number(v.price ?? 0);
  const salePrice = v.salePrice != null ? Number(v.salePrice) : null;
  const saleStock = Number(v.saleStock ?? 0);
  const saleSold = Number(v.saleSold ?? 0);

  const saleLeft = saleStock - saleSold;

  const isVariantSale =
    Boolean(v.saleEnabled) &&
    salePrice !== null &&
    salePrice > 0 &&
    start !== null &&
    end !== null &&
    now >= start &&
    now <= end;

  const finalVariant = {
    id: v.id,

    option1: v.option1 ?? null,
    option2: v.option2 ?? null,
    option3: v.option3 ?? null,

    optionLabel1: v.optionLabel1 ?? null,
    optionLabel2: v.optionLabel2 ?? null,
    optionLabel3: v.optionLabel3 ?? null,

    name: v.name ?? "",
    sku: v.sku ?? null,

    price,
    salePrice,
    finalPrice: Number(v.finalPrice ?? price),

    saleEnabled: Boolean(v.saleEnabled),
    saleStock,
    saleSold,
    saleLeft: Math.max(0, saleLeft),

    stock: Number(v.stock ?? 0),
    isUnlimited: Boolean(v.isUnlimited),

    image: v.image ?? "",

    isActive: Boolean(v.isActive),

    sortOrder: Number(v.sortOrder ?? 0),

    sold: Number(v.sold ?? 0),

    isSale: isVariantSale,
  };

  console.log(`✅ [API][GET][VARIANT ${i}] OUTPUT:`, finalVariant);

  return finalVariant;
});

    console.log("🧩 VARIANTS:", variants.length);

    

    /* ================= STOCK ================= */
    const totalStock = hasVariants
      ? variants.reduce((s, v) => s + (v.stock || 0), 0)
      : p.stock ?? 0;

    console.log("📦 TOTAL STOCK:", totalStock);

    /* ================= PRICE RANGE ================= */
    let minPrice: number | null = null;
    let maxPrice: number | null = null;

    if (hasVariants) {
      const prices = variants.map((v) =>
        typeof v.finalPrice === "number" ? v.finalPrice : 0
      );

      minPrice = prices.length ? Math.min(...prices) : null;
      maxPrice = prices.length ? Math.max(...prices) : null;
    }

    console.log("💰 PRICE RANGE:", { minPrice, maxPrice });

    /* ================= SHIPPING ================= */
    let shippingRates: { zone: string; price: number }[] = [];

try {
  shippingRates = await getShippingRatesByProduct(p.id);

  console.log("🚚 [API] SHIPPING RAW:", shippingRates);

  if (!shippingRates.length) {
    console.warn("⚠️ [API] SHIPPING EMPTY");
  }

} catch (err) {
  console.error("💥 [API] SHIPPING ERROR:", err);
}

    /* ================= FINAL PRICE ================= */
    const finalPrice = isSale
      ? (p.sale_price ?? p.price)
      : p.price;

    console.log("💵 FINAL PRODUCT PRICE:", finalPrice);

    /* ================= RESPONSE ================= */
    console.log("🎉 [PRODUCT][GET] SUCCESS");

    return NextResponse.json({
  id: p.id,
  sellerId: p.seller_id,
  name: p.name,

  selectedPrice: null,

  slug: p.slug ?? "",
  shortDescription: p.short_description ?? "",
  description: p.description ?? "",
  detail: p.detail ?? "",

  thumbnail: p.thumbnail ?? "",
  images: p.images ?? [],
  detailImages: p.detail_images ?? [],
  videoUrl: p.video_url ?? "",

  hasVariants,
  price: hasVariants ? null : p.price ?? 0,
  salePrice: hasVariants ? null : p.sale_price ?? null,
  finalPrice: hasVariants ? minPrice : finalPrice,

  minPrice,
  maxPrice,

  /* 🔥 STOCK */
  stock: totalStock,

  /* 🔥 SALE CORE */
  saleEnabled: p.sale_enabled === true,
  saleStock: p.sale_stock ?? 0,
  saleSold: p.sale_sold ?? 0,
  saleLeft:
    p.sale_stock > 0
      ? Math.max(0, p.sale_stock - p.sale_sold)
      : null,

  isProductSale,

  /* 🔥 META */
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
    console.error("💥 [PRODUCT][GET ERROR FULL]:", err);

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
  console.log("🚀 [PRODUCT][PATCH] START");

  /* ================= AUTH ================= */
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const id = params.id;

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

    console.log("📦 [PATCH] BODY OK");

    /* =========================================================
       SALE INPUT
    ========================================================= */

    const saleEnabled =
      typeof body.saleEnabled === "boolean" ? body.saleEnabled : false;

    const salePrice =
      typeof body.salePrice === "number" && !Number.isNaN(body.salePrice)
        ? body.salePrice
        : null;

    const saleStart =
      typeof body.saleStart === "string" && body.saleStart
        ? body.saleStart
        : null;

    const saleEnd =
      typeof body.saleEnd === "string" && body.saleEnd
        ? body.saleEnd
        : null;

    const hasSalePrice = salePrice !== null && salePrice > 0;

    const hasSaleTime = !!saleStart && !!saleEnd;

    /* ================= VALIDATION (STRICT) ================= */

    if (saleEnabled && !hasSalePrice) {
      return NextResponse.json(
        { error: "SALE_PRICE_REQUIRED" },
        { status: 400 }
      );
    }

    if (hasSalePrice && !hasSaleTime) {
      return NextResponse.json(
        { error: "SALE_TIME_REQUIRED" },
        { status: 400 }
      );
    }

    if (saleEnabled && !hasSaleTime) {
      return NextResponse.json(
        { error: "SALE_TIME_REQUIRED" },
        { status: 400 }
      );
    }

    /* ================= VARIANTS ================= */

    const normalizedVariants = normalizeVariants(body.variants);
    const hasVariants = normalizedVariants.length > 0;

    console.log("🧠 HAS VARIANTS:", hasVariants);

    /* ================= PRICE ================= */

    const price =
      typeof body.price === "number" && !Number.isNaN(body.price)
        ? body.price
        : undefined;

    let finalPrice = price;
    let finalSalePrice = salePrice;
    let finalStock: number | undefined;

    /* ================= VARIANT OVERRIDE LOGIC ================= */

    if (hasVariants) {
      const prices = normalizedVariants
        .map((v) => v.price)
        .filter((p): p is number => typeof p === "number" && p > 0);

      const salePrices = normalizedVariants
        .map((v) => Number(v.salePrice))
        .filter((p) => !Number.isNaN(p) && p > 0);

      finalPrice = prices.length ? Math.min(...prices) : 1;

      finalSalePrice = salePrices.length ? Math.min(...salePrices) : null;

      if (finalSalePrice !== null && finalSalePrice >= finalPrice) {
        finalSalePrice = null;
      }

      finalStock = normalizedVariants.reduce(
        (sum, v) => sum + (Number(v.stock) || 0),
        0
      );
    }

    /* ================= CATEGORY ================= */

    const categoryId =
      typeof body.categoryId === "string"
        ? Number(body.categoryId)
        : typeof body.categoryId === "number"
        ? body.categoryId
        : null;

    /* =========================================================
       FINAL SALE RULE
       (VARIANT ALWAYS OVERRIDES PRODUCT SALE)
    ========================================================= */

    const finalSaleEnabled = hasVariants ? false : saleEnabled;
    const finalSaleStart = hasVariants ? null : saleStart;
    const finalSaleEnd = hasVariants ? null : saleEnd;

    /* ================= UPDATE PRODUCT ================= */

    console.log("🛠️ UPDATE START");

    const updated = await updateProductBySeller(userId, id, {
      name:
        typeof body.name === "string" ? body.name.trim() : undefined,

      description:
        typeof body.description === "string" ? body.description : undefined,

      detail:
        typeof body.detail === "string" ? body.detail : undefined,

      images: Array.isArray(body.images)
        ? body.images.filter((i): i is string => typeof i === "string")
        : undefined,

      thumbnail:
        body.thumbnail !== undefined
          ? typeof body.thumbnail === "string"
            ? body.thumbnail
            : null
          : undefined,

      category_id: categoryId,

      /* PRICE */
      price: finalPrice,
      sale_price: finalSalePrice,

      /* STOCK */
      stock: hasVariants
        ? finalStock
        : typeof body.stock === "number"
        ? body.stock
        : undefined,

      /* SALE */
      sale_enabled: finalSaleEnabled,
      sale_stock:
        typeof body.saleStock === "number" ? body.saleStock : undefined,
      sale_start: finalSaleStart,
      sale_end: finalSaleEnd,

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

    /* ================= RELATIONS ================= */

    const domesticCountryCode = body.domesticCountryCode ?? null;

    await Promise.all([
      Array.isArray(body.shippingRates)
        ? upsertShippingRates({
            productId: id,
            rates: body.shippingRates.map((r: any) => ({
              zone: r.zone,
              price: Number(r.price || 0),
              domesticCountryCode:
                r.zone === "domestic"
                  ? domesticCountryCode || null
                  : null,
            })),
          })
        : Promise.resolve(),

      hasVariants
        ? replaceVariantsByProductId(id, normalizedVariants)
        : Promise.resolve(),
    ]);

    console.log("🎉 PATCH SUCCESS");

    return NextResponse.json({
      success: true,
      data: {
        id,
        name: updated.name,
        price: finalPrice,
        salePrice: finalSalePrice,
        stock: hasVariants ? finalStock : updated.stock,
      },
    });
  } catch (err) {
    console.error("💥 PATCH ERROR:", err);

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
