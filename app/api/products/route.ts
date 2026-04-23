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

  return input
    .map((item: any, index) => {
      if (!item || typeof item !== "object") return null;

      const value =
        typeof item.optionValue === "string"
          ? item.optionValue.trim()
          : "";

      if (!value) return null;

      return {
        id: typeof item.id === "string" ? item.id : undefined,
        optionName:
          typeof item.optionName === "string"
            ? item.optionName
            : "option",
        optionValue: value,
        price: Number(item.price) || 0,
        salePrice:
          typeof item.salePrice === "number"
            ? item.salePrice
            : null,
        stock: Number(item.stock) || 0,
        sku: item.sku ?? null,
        image: item.image ?? "",
        sortOrder: item.sortOrder ?? index,
        isActive: item.isActive ?? true,
      };
    })
    .filter(Boolean) as ProductVariant[];
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
      });
    }

    const now = Date.now();

    /* ================= ENRICH ================= */
    const enriched = await Promise.all(
      products.map(async (p) => {
        const variants = await getVariantsByProductId(p.id);

        /* ================= SALE TIME ================= */
        const start = p.sale_start
          ? new Date(p.sale_start).getTime()
          : null;

        const end = p.sale_end
          ? new Date(p.sale_end).getTime()
          : null;

        const isProductSale =
          typeof p.sale_price === "number" &&
          start &&
          end &&
          now >= start &&
          now <= end;

        /* ================= VARIANTS ================= */
        const activeVariants = variants.filter(
          (v) => v.isActive !== false
        );

        const enrichedVariants = activeVariants.map((v) => {
          const base = v.price;

          const isSale =
         v.saleEnabled &&
         typeof v.salePrice === "number" &&
         start &&
         end &&
        now >= start &&
        now <= end &&
         v.saleSold < v.saleStock;

          const finalPrice = isSale
            ? v.salePrice!
            : base;

          return {
  ...v,
  finalPrice,
  isSale,
  saleStock: v.saleStock,
  saleSold: v.saleSold,
  saleLeft: Math.max(0, v.saleStock - v.saleSold),
};
        });

        const hasVariants = enrichedVariants.length > 0;

        /* ================= STOCK ================= */
        const stock = hasVariants
          ? enrichedVariants.reduce((s, v) => s + v.stock, 0)
          : p.stock ?? 0;

        /* ================= PRODUCT PRICE ================= */
        const productFinalPrice = isProductSale
          ? p.sale_price
          : p.price;

        /* ================= PRICE RANGE ================= */
        let minPrice: number | null = null;
        let maxPrice: number | null = null;

        if (hasVariants) {
          const prices = enrichedVariants
         .map((v) => v.finalPrice)
         .filter((p) => typeof p === "number");
          minPrice = Math.min(...prices);
          maxPrice = Math.max(...prices);
        }

        return {
          id: p.id,
          sellerId: p.seller_id,
          name: p.name,
          price: p.price,
          salePrice: p.sale_price,
          finalPrice: hasVariants ? null : productFinalPrice,
          hasVariants,
          minPrice,
          maxPrice,
          stock,
          sold: p.sold ?? 0,

          thumbnail: p.thumbnail,
          images: p.images ?? [],
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
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "INVALID_NAME" },
        { status: 400 }
      );
    }

    const variants = normalizeVariants(body.variants);
    const hasVariants = variants.length > 0;

    const price = hasVariants ? 0 : Number(body.price) || 0;
    const salePrice =
      typeof body.salePrice === "number"
        ? body.salePrice
        : null;

    const stock = hasVariants
      ? variants.reduce((s, v) => s + v.stock, 0)
      : Number(body.stock) || 0;

    const product = await createProduct(userId, {
      name: body.name,
      price,
      sale_price: hasVariants ? null : salePrice,
      stock,
      description: body.description ?? "",
      detail: body.detail ?? "",
      images: body.images ?? [],
      thumbnail: body.thumbnail ?? "",
      category_id: body.categoryId ?? null,
      sale_start: body.saleStart || null,
      sale_end: body.saleEnd || null,
      is_active: true,
      views: 0,
      sold: 0,
    });

    if (hasVariants) {
      await replaceVariantsByProductId(product.id, variants);
    }

    if (Array.isArray(body.shippingRates)) {
      await upsertShippingRates({
        productId: product.id,
        rates: body.shippingRates,
      });
    }

    return NextResponse.json({
      success: true,
      data: { id: product.id },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "FAILED_TO_CREATE_PRODUCT" },
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

    const price = hasVariants ? 0 : Number(body.price) || 0;
    const salePrice =
      typeof body.salePrice === "number"
        ? body.salePrice
        : null;

    const stock = hasVariants
      ? variants.reduce((s, v) => s + v.stock, 0)
      : Number(body.stock) || 0;

    const updated = await updateProductBySeller(
      userId,
      body.id,
      {
        name: body.name,
        price,
        sale_price: hasVariants ? null : salePrice,
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
        rates: body.shippingRates,
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
