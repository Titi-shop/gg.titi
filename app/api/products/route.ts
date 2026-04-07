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
  createVariantsForProduct,
  replaceVariantsByProductId,
} from "@/lib/db/variants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   NORMALIZE VARIANTS
========================================================= */

function normalizeVariants(input: unknown) {
  console.log("[PRODUCT_API] normalizeVariants start");

  if (!Array.isArray(input)) {
    console.log("[PRODUCT_API] variants not array");
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
     .filter((i) => i !== null);

  console.log("[PRODUCT_API] normalizeVariants done:", result.length);

  return result;
}

/* =========================================================
   GET
========================================================= */

export async function GET(req: Request) {
  console.log("[PRODUCT_API][GET] START");

  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");

    let products: ProductRecord[] = [];

    if (ids) {
      console.log("[PRODUCT_API][GET] ids:", ids);

      const idArray = ids
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      console.log("[PRODUCT_API][GET] idArray:", idArray.length);

      if (!idArray.length) return NextResponse.json([]);

      products = await getProductsByIds(idArray);
    } else {
      console.log("[PRODUCT_API][GET] load all products");
      products = await getAllProducts();
    }

    console.log("[PRODUCT_API][GET] products:", products.length);

    const now = Date.now();
    const productIds = products.map((p) => p.id);

    console.log("[PRODUCT_API][GET] productIds:", productIds.length);

    const shippingRows = await getShippingRatesByProducts(productIds);

    console.log(
      "[PRODUCT_API][GET] shippingRows:",
      shippingRows.length
    );

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

    console.log("[PRODUCT_API][GET] shippingMap ready");

    const enriched = await Promise.all(
      products.map(async (p) => {
        let variants = [];

        try {
          variants = await getVariantsByProductId(p.id);
        } catch {
          console.warn("[PRODUCT_API][GET] variant fail:", p.id);
        }

        const shippingRates = shippingMap.get(p.id) ?? [];

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

        const baseStock = typeof p.stock === "number" ? p.stock : 0;

        const totalVariantStock =
          variants.length > 0
            ? variants.reduce((s, v) => s + (v.stock || 0), 0)
            : 0;

        const finalStock =
          variants.length > 0 ? totalVariantStock : baseStock;

        return {
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

  isSale,
  finalPrice: isSale ? p.sale_price ?? p.price : p.price,
  currency: p.currency ?? "PI",

  stock: finalStock,
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
  shippingRates: shippingRates 
      };
      })
    );

    console.log("[PRODUCT_API][GET] DONE");

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("[PRODUCT_API][GET] ERROR");

    return NextResponse.json(
      { error: "FAILED_TO_FETCH_PRODUCTS" },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST
========================================================= */

export async function POST(req: Request) {
  console.log("[PRODUCT_API][POST] START");

  const auth = await requireSeller();
  if (!auth.ok) {
    console.warn("[PRODUCT_API][POST] auth failed");
    return auth.response;
  }

  const userId = auth.userId;
  console.log("[PRODUCT_API][POST] userId:", userId);

  try {
    const body = await req.json();
    console.log("[PRODUCT_API][POST] body received");

    const normalizedVariants = normalizeVariants(body.variants);

    const hasVariants = normalizedVariants.length > 0;

    const finalStock = hasVariants
      ? normalizedVariants.reduce((s, v) => s + v.stock, 0)
      : typeof body.stock === "number"
      ? body.stock
      : 0;

     const price =
  typeof body.price === "number" && !Number.isNaN(body.price)
    ? body.price
    : 0;

      const product = await createProduct(userId, {
      name: String(body.name).trim(),
      price,
      description: body.description ?? "",
      detail: body.detail ?? "",
      images: Array.isArray(body.images)
        ? body.images.filter((i: unknown): i is string => typeof i === "string")
        : [],
      thumbnail:
        typeof body.thumbnail === "string" ? body.thumbnail : null,
      category_id:
        typeof body.categoryId === "number" ? body.categoryId : null,
      sale_price:
        typeof body.salePrice === "number" ? body.salePrice : null,
      sale_start:
        typeof body.saleStart === "string" ? body.saleStart : null,
      sale_end:
        typeof body.saleEnd === "string" ? body.saleEnd : null,
      stock: finalStock,
      is_active:
        typeof body.isActive === "boolean" ? body.isActive : true,
      views: 0,
      sold: 0,
    });

    console.log("[PRODUCT_API][POST] product created:", product.id);

    if (Array.isArray(body.shippingRates)) {
      console.log("[PRODUCT_API][POST] upsert shipping");
     await upsertShippingRates({
  productId: product.id,
  rates: body.shippingRates,
   });
    }

    if (hasVariants) {
      console.log("[PRODUCT_API][POST] create variants");
      await createVariantsForProduct(product.id, normalizedVariants);
    }

    console.log("[PRODUCT_API][POST] DONE");

    return NextResponse.json({ success: true, data: product });
  } catch (err) {
    console.error("[PRODUCT_API][POST] ERROR");

    return NextResponse.json(
      { error: "FAILED_TO_CREATE_PRODUCT" },
      { status: 500 }
    );
  }
}

/* =========================================================
   PUT
========================================================= */

export async function PUT(req: Request) {
  console.log("[PRODUCT_API][PUT] START");

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
    console.log("[PRODUCT_API][PUT] productId:", productId);

    const normalizedVariants = normalizeVariants(body.variants);

    const hasVariants = normalizedVariants.length > 0;

    const finalStock = hasVariants
      ? normalizedVariants.reduce((s, v) => s + v.stock, 0)
      : typeof body.stock === "number"
      ? body.stock
      : 0;

    const price =
  typeof body.price === "number" && !Number.isNaN(body.price)
    ? body.price
    : 0;

   const updated = await updateProductBySeller(
       userId,
       productId,
       {
        name: String(body.name).trim(),
        price,
        description: body.description ?? "",
        detail: body.detail ?? "",
        images: Array.isArray(body.images)
          ? body.images.filter((i: unknown): i is string => typeof i === "string")
          : [],
        thumbnail:
          typeof body.thumbnail === "string" ? body.thumbnail : null,
        category_id:
          typeof body.categoryId === "number" ? body.categoryId : null,
        sale_price:
          typeof body.salePrice === "number" ? body.salePrice : null,
        sale_start:
          typeof body.saleStart === "string" ? body.saleStart : null,
        sale_end:
          typeof body.saleEnd === "string" ? body.saleEnd : null,
        stock: finalStock,
        is_active:
           typeof body.isActive === "boolean" ? body.isActive : true,
      }
    );

    if (!updated) {
      console.warn("[PRODUCT_API][PUT] not found");
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    await replaceVariantsByProductId(productId, normalizedVariants);

    if (Array.isArray(body.shippingRates)) {
      await upsertShippingRates({
        productId: productId,
        rates: body.shippingRates,
      });
    }

    console.log("[PRODUCT_API][PUT] DONE");

    return NextResponse.json({ success: true });
  } catch {
    console.error("[PRODUCT_API][PUT] ERROR");

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
  console.log("[PRODUCT_API][DELETE] START");

  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    console.log("[PRODUCT_API][DELETE] id:", id);

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const deleted = await deleteProductBySeller(userId, id);

    if (!deleted) {
      console.warn("[PRODUCT_API][DELETE] not found");
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND_OR_FORBIDDEN" },
        { status: 404 }
      );
    }

    console.log("[PRODUCT_API][DELETE] DONE");

    return NextResponse.json({ success: true });
  } catch {
    console.error("[PRODUCT_API][DELETE] ERROR");

    return NextResponse.json(
      { error: "FAILED_TO_DELETE_PRODUCT" },
      { status: 500 }
    );
  }
}
