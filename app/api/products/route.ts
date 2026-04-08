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
}

/* ================= GET ================= */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");

    let products: ProductRecord[] = [];

    if (ids) {
      const idArray = ids.split(",").map((i) => i.trim()).filter(Boolean);
      if (!idArray.length) return NextResponse.json([]);
      products = await getProductsByIds(idArray);
    } else {
      products = await getAllProducts();
    }

    const productIds = products.map((p) => p.id);

    const shippingRows =
      productIds.length > 0
        ? await getShippingRatesByProducts(productIds)
        : [];

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

        const isSale =
          typeof p.sale_price === "number" &&
          start !== null &&
          end !== null &&
          now >= start &&
          now <= end;

        const finalStock =
          variants.length > 0
            ? variants.reduce((s, v) => s + (v.stock || 0), 0)
            : p.stock ?? 0;

        return {
          id: p.id,
          sellerId: p.seller_id,
          name: p.name,
          price: p.price ?? 0,
          salePrice: p.sale_price ?? null,
          finalPrice: isSale ? p.sale_price ?? p.price : p.price,
          stock: finalStock,
          thumbnail: p.thumbnail ?? "",
          images: p.images ?? [],
          categoryId: p.category_id ?? null,
          variants,
          shippingRates: shippingMap.get(p.id) ?? [],
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

/* ================= POST ================= */

export async function POST(req: Request) {
  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const body = await req.json();

    const price =
      typeof body.price === "number" && !Number.isNaN(body.price)
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

    const variants = normalizeVariants(body.variants);

    const finalStock =
      variants.length > 0
        ? variants.reduce((s, v) => s + v.stock, 0)
        : typeof body.stock === "number"
        ? body.stock
        : 0;

    const categoryId =
      typeof body.categoryId === "string"
        ? Number(body.categoryId)
        : null;

    const product = await createProduct(userId, {
      name: String(body.name || "").trim(),
      price,
      description: body.description ?? "",
      detail: body.detail ?? "",
      images: Array.isArray(body.images)
        ? body.images.filter((i: unknown): i is string => typeof i === "string")
        : [],
      thumbnail:
        typeof body.thumbnail === "string" ? body.thumbnail : null,
      category_id: categoryId,
      sale_price: salePrice,
      sale_start: body.saleStart || null,
      sale_end: body.saleEnd || null,
      stock: finalStock,
      is_active:
        typeof body.isActive === "boolean" ? body.isActive : true,
      views: 0,
      sold: 0,
    });

    await Promise.all([
      Array.isArray(body.shippingRates)
        ? upsertShippingRates({
            productId: product.id,
            rates: body.shippingRates,
          })
        : Promise.resolve(),

      variants.length > 0
        ? createVariantsForProduct(product.id, variants)
        : Promise.resolve(),
    ]);

    return NextResponse.json({
      success: true,
      data: { id: product.id },
    });
  } catch {
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
      price,
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
      sale_price: salePrice,
      sale_start: body.saleStart || null,
      sale_end: body.saleEnd || null,
      stock: finalStock,
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
