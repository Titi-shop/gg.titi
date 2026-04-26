
  import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import {
  upsertShippingRates,
  getShippingRatesByProducts,
} from "@/lib/db/shipping";

import {
  createProduct,
  updateProductBySeller,
  getAllProducts,
  getProductsByIds,
  deleteProductBySeller,
  type ProductRecord,
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

  console.log("🧪 [NORMALIZE] INPUT:", input);

  const result = input
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const v: any = item;

      const option1 = (v.option1 ?? v.optionValue ?? "").toString().trim();
      const option2 = (v.option2 ?? "").toString().trim() || null;
      const option3 = (v.option3 ?? "").toString().trim() || null;

      if (!option1) {
        console.warn(`⚠️ [NORMALIZE] SKIP EMPTY option1 index=${index}`);
        return null;
      }

      const price = Number(v.price ?? 0);
      const salePrice =
        v.salePrice !== null &&
        v.salePrice !== undefined &&
        v.salePrice !== ""
          ? Number(v.salePrice)
          : null;

      const saleEnabled = Boolean(v.saleEnabled);

      const normalized: ProductVariant = {
        id: typeof v.id === "string" ? v.id : undefined,

        option1,
        option2,
        option3,

        optionLabel1: v.optionLabel1 ?? null,
        optionLabel2: v.optionLabel2 ?? null,
        optionLabel3: v.optionLabel3 ?? null,

        name:
          v.name ??
          [option1, option2, option3].filter(Boolean).join(" - "),

        sku: v.sku ?? null,

        price,
        salePrice,

        finalPrice:
          saleEnabled &&
          salePrice !== null &&
          salePrice > 0 &&
          salePrice < price
            ? salePrice
            : price,

        saleEnabled,
        saleStock: Number(v.saleStock ?? 0),
        saleSold: Number(v.saleSold ?? 0),

        stock: Number(v.stock ?? 0),
        isUnlimited: Boolean(v.isUnlimited),

        image: v.image ?? "",

        isActive: v.isActive !== false,
        sortOrder:
          typeof v.sortOrder === "number" ? v.sortOrder : index,

        sold: Number(v.sold ?? 0),
      };

      console.log(`✅ [NORMALIZE][${index}]`, normalized);

      return normalized;
    })
    .filter(Boolean) as ProductVariant[];

  console.log("🎯 [NORMALIZE] OUTPUT:", result);

  return result;
}
/* =========================================================
   GET PRODUCTS
========================================================= */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");

    let products: ProductRecord[] = [];

    if (ids) {
      const idArray = ids.split(",").filter(Boolean);
      if (!idArray.length) return NextResponse.json([]);
      products = await getProductsByIds(idArray);
    } else {
      products = await getAllProducts();
    }

    const productIds = products.map((p) => p.id);

    /* ================= SHIPPING ================= */
    const shippingRows =
      productIds.length > 0
        ? await getShippingRatesByProducts(productIds)
        : [];

    const shippingMap = new Map<string, any[]>();

    for (const r of shippingRows) {
      if (!shippingMap.has(r.product_id)) {
        shippingMap.set(r.product_id, []);
      }
      shippingMap.get(r.product_id)!.push({
  zone: r.zone,
  price: r.price,
  domesticCountryCode: r.domestic_country_code,
  });
    }

    const now = Date.now();

    const enriched = await Promise.all(
      products.map(async (p) => {
        const variants = await getVariantsByProductId(p.id);

        const start = p.sale_start
          ? new Date(p.sale_start).getTime()
          : null;

        const end = p.sale_end
          ? new Date(p.sale_end).getTime()
          : null;

        /* ================= PRODUCT SALE ================= */
        const isProductSale =
          p.sale_enabled === true &&
          typeof p.sale_price === "number" &&
          start !== null &&
          end !== null &&
          now >= start &&
          now <= end &&
          (p.sale_stock === 0 || p.sale_sold < p.sale_stock);

        /* ================= VARIANTS ================= */
        const enrichedVariants = variants
          .filter((v) => v.isActive !== false)
          .map((v) => {
            const isSale =
              v.saleEnabled === true &&
              typeof v.salePrice === "number" &&
              v.salePrice < v.price &&
              start !== null &&
              end !== null &&
              now >= start &&
              now <= end &&
              (v.saleStock === 0 || v.saleSold < v.saleStock);

            const finalPrice = isSale
              ? v.salePrice!
              : v.price;

            return {
              ...v,
              finalPrice,
              isSale,
              saleStock: v.saleStock ?? 0,
              saleSold: v.saleSold ?? 0,
              saleLeft: Math.max(
                0,
                (v.saleStock ?? 0) - (v.saleSold ?? 0)
              ),
            };
          });

        const hasVariants = enrichedVariants.length > 0;

        /* ================= STOCK ================= */
        const stock = hasVariants
          ? enrichedVariants.reduce((s, v) => {
              if (v.isSale && v.saleStock > 0) {
                return (
                  s + Math.max(0, v.saleStock - v.saleSold)
                );
              }
              return s + v.stock;
            }, 0)
          : p.stock ?? 0;

        /* ================= PRICE ================= */
        const productFinalPrice = isProductSale
          ? p.sale_price
          : p.price;

        /* ================= PRICE RANGE ================= */
        let minPrice: number | null = null;
        let maxPrice: number | null = null;

        if (hasVariants) {
          const prices = enrichedVariants
            .map((v) => v.finalPrice)
            .filter((n) => typeof n === "number" && n > 0);

          if (prices.length) {
            minPrice = Math.min(...prices);
            maxPrice = Math.max(...prices);
          }
        }

        /* ================= FINAL SALE FLAG ================= */
        const isSale = hasVariants
          ? enrichedVariants.some((v) => v.isSale)
          : isProductSale;

        return {
          id: p.id,
          sellerId: p.seller_id,
          name: p.name,

          /* PRICE */
          price: p.price,
          salePrice: p.sale_price,
          finalPrice: hasVariants
            ? minPrice // 🔥 FIX QUAN TRỌNG
            : productFinalPrice,

          minPrice,
          maxPrice,
          hasVariants,

          /* SALE */
          isSale,
          saleEnd: p.sale_end,

          /* 🔥 ADD THIẾU */
          saleStock: p.sale_stock ?? 0,
          saleSold: p.sale_sold ?? 0,
          saleLeft:
            p.sale_stock > 0
              ? Math.max(0, p.sale_stock - p.sale_sold)
              : null,

          /* STOCK */
          stock,
          sold: p.sold ?? 0,

          /* MEDIA */
          thumbnail: p.thumbnail,
          images: p.images ?? [],

          /* OTHER */
          categoryId: p.category_id,
          variants: enrichedVariants,
          shippingRates: shippingMap.get(p.id) ?? [],
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "FAILED_TO_FETCH_PRODUCTS" },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST (CREATE)
========================================================= */

export async function POST(req: Request) {
  const auth = await requireSeller();

  if (!auth.ok) {
    console.warn("❌ AUTH FAILED");
    return auth.response;
  }

  const userId = auth.userId;

  /* =========================================================
     HELPER DEBUG
  ========================================================= */

  const bad = (msg: string, extra?: any) => {
    console.error("❌ BAD REQUEST:", msg, extra);
    return NextResponse.json({ error: msg }, { status: 400 });
  };

  try {
    const body = await req.json();

    console.log("📥 BODY:", JSON.stringify(body, null, 2));

    /* =========================================================
       VALIDATE BASIC
    ========================================================= */

    if (!body.name || typeof body.name !== "string") {
      return bad("INVALID_NAME", body.name);
    }

    /* =========================================================
       VARIANTS
    ========================================================= */

    const variants = normalizeVariants(body.variants);
const hasVariants = variants.length > 0;

/* ================= PRICE ================= */

let price = 0;

if (hasVariants) {
  const prices = variants
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!prices.length) {
    return bad("INVALID_VARIANT_PRICE", variants);
  }

  price = Math.min(...prices);
} else {
  price = Number(body.price);

  if (!Number.isFinite(price) || price <= 0) {
    return bad("INVALID_PRICE", price);
  }
}

/* =========================================================
   SALE
========================================================= */

const saleEnabled = body.saleEnabled === true;

const saleStock = saleEnabled
  ? Number(body.saleStock ?? 0)
  : 0;

const salePrice =
  !hasVariants && typeof body.salePrice === "number"
    ? body.salePrice
    : null;

console.log("🏷 saleEnabled:", saleEnabled);
console.log("📦 saleStock:", saleStock);
console.log("🏷 salePrice:", salePrice);

/* ================= STOCK ================= */

const stock = hasVariants
  ? variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
  : Number(body.stock) || 0;

    /* =========================================================
       CREATE PRODUCT
    ========================================================= */

    console.log("🚀 Creating product...");

    const product = await createProduct(userId, {
      name: body.name.trim(),

      description: body.description ?? "",
      detail: body.detail ?? "",

      images: Array.isArray(body.images) ? body.images : [],
      thumbnail: body.thumbnail ?? "",

      category_id: body.categoryId
        ? Number(body.categoryId)
        : null,

      price,
      sale_price: hasVariants ? null : salePrice,
      sale_start: body.saleStart || null,
      sale_end: body.saleEnd || null,

      stock,
      is_active: true,

      /* 🔥 SALE */
      sale_enabled: saleEnabled,
      sale_stock: saleStock,

      views: 0,
      sold: 0,
    });

    console.log("✅ PRODUCT CREATED:", product.id);

    /* =========================================================
       VARIANTS
    ========================================================= */

    if (hasVariants) {
      console.log("🚀 Inserting variants...");

      await replaceVariantsByProductId(product.id, variants);

      console.log("✅ VARIANTS INSERTED");
    }

    /* =========================================================
       SHIPPING
    ========================================================= */

    if (Array.isArray(body.shippingRates)) {
      console.log("🚀 Shipping rates:", body.shippingRates);

      await upsertShippingRates({
  productId: product.id,
  rates: body.shippingRates.map((r: any) => ({
    zone: r.zone,
    price: Number(r.price || 0),

    rates: body.shippingRates.map((r: any) => ({
  zone: r.zone,
  price: Number(r.price || 0),
})),
});
      console.log("✅ SHIPPING SAVED");
    }

    /* =========================================================
       SUCCESS
    ========================================================= */

    console.log("🎉 SUCCESS CREATE PRODUCT:", product.id);

    return NextResponse.json({
      success: true,
      data: { id: product.id },
    });

  } catch (err: any) {
    console.error("💥 API ERROR:", err);

    /* 🔥 LOG DETAIL DB ERROR */
    if (err?.code) {
      console.error("🧨 DB CODE:", err.code);
    }

    if (err?.message) {
      console.error("🧨 DB MESSAGE:", err.message);
    }

    return NextResponse.json(
      {
        error: "FAILED_TO_CREATE_PRODUCT",
        message: err?.message ?? null,
      },
      { status: 500 }
    );
  }
}
/* =========================================================
   PUT (UPDATE)
========================================================= */

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

    const variants = normalizeVariants(body.variants);
const hasVariants = variants.length > 0;

let price = 0;

if (hasVariants) {
  const prices = variants.map(v => v.price).filter(n => n > 0);
  price = Math.min(...prices);
} else {
  price = Number(body.price) || 0;
}

const salePrice =
  typeof body.salePrice === "number"
    ? body.salePrice
    : null;

if (salePrice !== null && salePrice >= price) {
  return NextResponse.json(
    { error: "INVALID_SALE_PRICE" },
    { status: 400 }
  );
}

const stock = hasVariants
  ? variants.reduce((s, v) => s + v.stock, 0)
  : Number(body.stock) || 0;

    const saleEnabled = body.saleEnabled === true;

const saleStock = saleEnabled
  ? Number(body.saleStock) || 0
  : 0;

const updated = await updateProductBySeller(
  userId,
  body.id,
  {
    name: body.name,
    price,
    sale_price: hasVariants ? null : salePrice,
    sale_enabled: saleEnabled,
    sale_stock: saleStock,

    stock,

    description: body.description ?? "",
    detail: body.detail ?? "",
    images: body.images ?? [],
    thumbnail: body.thumbnail ?? "",
    category_id: body.categoryId ?? null,

    sale_start: body.saleStart || null,
    sale_end: body.saleEnd || null,

    is_active: body.isActive ?? true,
  }
);

    if (!updated) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await replaceVariantsByProductId(body.id, variants);

    if (Array.isArray(body.shippingRates)) {
      await upsertShippingRates({
  productId: body.id,
  rates: (body.shippingRates || []).map((r: any) => ({
    zone: r.zone,
    price: Number(r.price || 0),
    domesticCountryCode:
      r.zone === "domestic"
        ? r.countryCode || r.domesticCountryCode || null
        : null,
  })),
});
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "FAILED_TO_UPDATE_PRODUCT" },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE
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
        { error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "FAILED_TO_DELETE_PRODUCT" },
      { status: 500 }
    );
  }
}

