

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

      // 🔥 FIX: lấy cả option1 OR optionValue
      const option1 =
        (v.option1 ?? v.optionValue ?? "").toString().trim();

      const option2 = (v.option2 ?? "").toString().trim();
      const option3 = (v.option3 ?? "").toString().trim();

      if (!option1 && !option2) return null;

      return {
        id: typeof v.id === "string" ? v.id : undefined,

        optionName: v.optionLabel1 ?? "option",
        optionValue: option1,

        option_1: option1,
        option_2: option2 || null,
        option_3: option3 || null,

        option_label_1: v.optionLabel1 ?? null,
        option_label_2: v.optionLabel2 ?? null,
        option_label_3: v.optionLabel3 ?? null,

        price: Number(v.price) || 0,

        // 🔥 FIX CONSISTENT SALE FIELDS
        salePrice:
          v.salePrice !== undefined && v.salePrice !== null
            ? Number(v.salePrice)
            : null,

        stock: Number(v.stock) || 0,

        saleEnabled: !!v.saleEnabled,

        saleStock: Number(v.saleStock ?? v.sale_stock ?? 0),

        sku: v.sku ?? null,
        image: v.image ?? "",

        sortOrder: v.sortOrder ?? index,
        isActive: v.isActive ?? true,
      };
    })
    .filter(Boolean) as ProductVariant[];

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

    console.log("🔥 SALE STATUS:", { isSale, start, end });

    /* ================= VARIANTS ================= */
    const rawVariants = await getVariantsByProductId(id);

    const variants = rawVariants.map((v) => {
  const salePrice = Number(v.sale_price ?? 0);
  const saleStock = Number(v.sale_stock ?? 0);
  const saleSold = Number(v.sale_sold ?? 0);
  const price = Number(v.price ?? 0);

  const isVariantSale =
    Boolean(v.sale_enabled) &&
    salePrice > 0 &&
    start !== null &&
    end !== null &&
    now >= start &&
    now <= end;

  return {
    id: v.id,

    /* ================= OPTIONS ================= */
    option1: v.option_1 ?? "",
    option2: v.option_2 ?? null,
    option3: v.option_3 ?? null,

    optionLabel1: v.option_label_1 ?? null,
    optionLabel2: v.option_label_2 ?? null,
    optionLabel3: v.option_label_3 ?? null,

    /* ================= CORE ================= */
    name: v.name ?? "",

    sku: v.sku ?? null,

    /* ================= PRICE (FIXED) ================= */
    price,
    salePrice,
    finalPrice: isVariantSale ? salePrice : price,

    /* ================= SALE (FIXED) ================= */
    saleEnabled: Boolean(v.sale_enabled),
    saleStock,
    saleSold,
    saleLeft: saleStock > 0 ? Math.max(0, saleStock - saleSold) : null,

    /* ================= STOCK ================= */
    stock: Number(v.stock ?? 0),
    isUnlimited: Boolean(v.is_unlimited),

    /* ================= MEDIA ================= */
    image: v.image ?? null,

    /* ================= STATUS ================= */
    isActive: Boolean(v.is_active),

    sortOrder: Number(v.sort_order ?? 0),

    sold: Number(v.sold ?? 0),

    /* ================= COMPUTED ================= */
    isSale: isVariantSale,
  };
});

    

    console.log("🧩 VARIANTS:", variants.length);

    const hasVariants = variants.length > 0;

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

  isSale,

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

  if (!auth.ok) {
    console.error("❌ [PATCH][AUTH FAILED]");
    return auth.response;
  }

  const userId = auth.userId;

  try {
    const id = params.id;

    console.log("📌 [PATCH] PARAM ID:", id);

    /* ================= VALIDATE ID ================= */
    if (!id || typeof id !== "string") {
      console.error("❌ INVALID PRODUCT ID");
      return NextResponse.json(
        { error: "INVALID_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const body = await req.json();

    console.log("📦 [PATCH] BODY:", body);

    if (!body || typeof body !== "object") {
      console.error("❌ INVALID BODY");
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }
/* ================= SALE INPUT ================= */

const saleEnabled =
  typeof body.saleEnabled === "boolean"
    ? body.saleEnabled
    : undefined;

const saleStock =
  typeof body.saleStock === "number" && body.saleStock >= 0
    ? body.saleStock
    : undefined;

    /* ================= VARIANTS ================= */
    const normalizedVariants = normalizeVariants(body.variants);
    console.log("🧩 [PATCH] VARIANTS:", normalizedVariants);
    const hasVariants = normalizedVariants.length > 0;
    console.log("🧠 [PATCH] HAS VARIANTS:", hasVariants);

    /* ================= PRICE INPUT ================= */
    const price =
      typeof body.price === "number" && !Number.isNaN(body.price)
        ? body.price
        : undefined;

    const salePrice =
      typeof body.salePrice === "number" && !Number.isNaN(body.salePrice)
        ? body.salePrice
        : null;

    console.log("💰 [PATCH] INPUT PRICE:", { price, salePrice });

    if (
      price !== undefined &&
      salePrice !== null &&
      salePrice >= price
    ) {
      console.error("❌ INVALID SALE PRICE");
      return NextResponse.json(
        { error: "INVALID_SALE_PRICE" },
        { status: 400 }
      );
    }

    /* ================= DERIVE FROM VARIANTS ================= */
    let finalPrice = price;
    let finalSalePrice = salePrice;
    let finalStock: number | undefined = undefined;

    if (hasVariants) {
      console.log("🧠 [PATCH] CALCULATE FROM VARIANTS");

      const prices = normalizedVariants
  .map((v) => v.price)
  .filter(
    (p): p is number =>
      typeof p === "number" && !Number.isNaN(p) && p > 0
  );

const salePrices = normalizedVariants
  .map(v => Number(v.salePrice))
  .filter(v => !Number.isNaN(v) && v > 0);

finalPrice = prices.length > 0 ? Math.min(...prices) : 1;

finalSalePrice =
  salePrices.length > 0 ? Math.min(...salePrices) : null;
  if (
  finalSalePrice !== null &&
  finalSalePrice >= finalPrice
) {
  console.warn("⚠️ AUTO FIX SALE PRICE");

  finalSalePrice = null;
}
      finalStock = normalizedVariants.reduce(
  (s, v) => s + (Number(v.stock) || 0),
  0
);

      console.log("💰 [PATCH] DERIVED:", {
        finalPrice,
        finalSalePrice,
        finalStock,
      });
    }

    /* ================= DATE ================= */
    const saleStart =
      typeof body.saleStart === "string" && body.saleStart
        ? body.saleStart
        : null;

    const saleEnd =
      typeof body.saleEnd === "string" && body.saleEnd
        ? body.saleEnd
        : null;

    console.log("📅 [PATCH] SALE TIME:", { saleStart, saleEnd });

    /* ================= CATEGORY ================= */
    const categoryId =
      typeof body.categoryId === "string"
        ? Number(body.categoryId)
        : typeof body.categoryId === "number"
        ? body.categoryId
        : null;

    console.log("📂 [PATCH] CATEGORY:", categoryId);

    /* ================= UPDATE ================= */
    console.log("🛠️ [PATCH] UPDATE START");

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
    ? body.images.filter(
        (i: unknown): i is string => typeof i === "string"
      )
    : undefined,

  thumbnail:
    body.thumbnail !== undefined
      ? typeof body.thumbnail === "string"
        ? body.thumbnail
        : null
      : undefined,

  category_id: categoryId,

  /* 🔥 PRICE */
  price: finalPrice,
  sale_price: finalSalePrice,

  stock:
    hasVariants
      ? finalStock
      : typeof body.stock === "number" && body.stock >= 0
      ? body.stock
      : undefined,

  /* 🔥 SALE SYSTEM */
  sale_enabled: saleEnabled,
  sale_stock: saleStock,

  sale_start: saleStart,
  sale_end: saleEnd,

  is_active:
    typeof body.isActive === "boolean"
      ? body.isActive
      : undefined,
});

    console.log("🧾 [PATCH] UPDATED RESULT:", updated);

    if (!updated) {
      console.error("❌ PRODUCT NOT FOUND OR FORBIDDEN");
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    /* ================= SHIPPING + VARIANTS ================= */
    console.log("🚚 [PATCH] UPSERT SHIPPING & VARIANTS");

    await Promise.all([
      Array.isArray(body.shippingRates)
        ? upsertShippingRates({
            productId: id,
            rates: body.shippingRates,
          })
        : Promise.resolve(),

      hasVariants
        ? replaceVariantsByProductId(id, normalizedVariants)
        : Promise.resolve(),
    ]);

    console.log("✅ [PATCH] RELATIONS UPDATED");

    /* ================= RESPONSE ================= */
    console.log("🎉 [PATCH] SUCCESS");

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
    console.error("💥 [PRODUCT][PATCH ERROR FULL]:", err);

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
