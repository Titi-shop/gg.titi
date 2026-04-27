
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
   FORENSIC LOGGER
========================================================= */

function flog(step: string, data?: any) {
  console.log(`🧪 [API][PRODUCTS] ${step}`, data ?? "");
}

function ferr(step: string, data?: any) {
  console.error(`💥 [API][PRODUCTS] ${step}`, data ?? "");
}

function fwarn(step: string, data?: any) {
  console.warn(`⚠️ [API][PRODUCTS] ${step}`, data ?? "");
}

/* =========================================================
   NORMALIZE VARIANTS
========================================================= */

function normalizeVariants(input: unknown): ProductVariant[] {
  flog("NORMALIZE_VARIANTS_INPUT", input);

  if (!Array.isArray(input)) {
    fwarn("NORMALIZE_VARIANTS_NOT_ARRAY");
    return [];
  }

  const result = input
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        fwarn(`NORMALIZE_SKIP_INVALID_OBJECT_${index}`);
        return null;
      }

      const v: any = item;

      const option1 = (v.option1 ?? v.optionValue ?? "").toString().trim();
      const option2 = (v.option2 ?? "").toString().trim() || null;
      const option3 = (v.option3 ?? "").toString().trim() || null;

      if (!option1) {
        fwarn(`NORMALIZE_SKIP_EMPTY_OPTION1_${index}`, v);
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

      flog(`NORMALIZED_VARIANT_${index}`, normalized);

      return normalized;
    })
    .filter(Boolean) as ProductVariant[];

  flog("NORMALIZE_VARIANTS_OUTPUT", result);

  return result;
}

/* =========================================================
   GET PRODUCTS
========================================================= */

export async function GET(req: Request) {
  flog("GET_START");

  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");

    let products: ProductRecord[] = [];

    if (ids) {
      const idArray = ids.split(",").filter(Boolean);
      flog("GET_IDS_MODE", idArray);

      if (!idArray.length) return NextResponse.json([]);

      products = await getProductsByIds(idArray);
    } else {
      flog("GET_ALL_MODE");
      products = await getAllProducts();
    }

    flog("GET_PRODUCTS_FOUND", products.length);

    const productIds = products.map((p) => p.id);

    const shippingRows =
      productIds.length > 0
        ? await getShippingRatesByProducts(productIds)
        : [];

    flog("GET_SHIPPING_ROWS", shippingRows);

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
      products.map(async (p, index) => {
        flog(`GET_ENRICH_PRODUCT_${index}`, { id: p.id, name: p.name });

        const variants = await getVariantsByProductId(p.id);

        const start = p.sale_start ? new Date(p.sale_start).getTime() : null;
        const end = p.sale_end ? new Date(p.sale_end).getTime() : null;

        const isProductSale =
          p.sale_enabled === true &&
          typeof p.sale_price === "number" &&
          start !== null &&
          end !== null &&
          now >= start &&
          now <= end &&
          (p.sale_stock === 0 || (p.sale_sold ?? 0) < (p.sale_stock ?? 0));

        const enrichedVariants = variants
          .filter((v) => v.isActive !== false)
          .map((v, vi) => {
            const isSale =
              v.saleEnabled === true &&
              typeof v.salePrice === "number" &&
              v.salePrice < (v.price ?? 0) &&
              start !== null &&
              end !== null &&
              now >= start &&
              now <= end &&
              ((v.saleStock ?? 0) === 0 ||
                (v.saleSold ?? 0) < (v.saleStock ?? 0));

            const finalPrice = isSale ? v.salePrice! : v.price!;

            const obj = {
              ...v,
              finalPrice,
              isSale,
              saleLeft: Math.max(
                0,
                (v.saleStock ?? 0) - (v.saleSold ?? 0)
              ),
            };

            flog(`GET_VARIANT_ENRICH_${p.id}_${vi}`, obj);

            return obj;
          });

        const hasVariants = enrichedVariants.length > 0;

        const stock = hasVariants
          ? enrichedVariants.reduce((s, v) => s + (v.stock || 0), 0)
          : p.stock ?? 0;

        const productFinalPrice = isProductSale ? p.sale_price : p.price;

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

        return {
          id: p.id,
          sellerId: p.seller_id,
          name: p.name,

          price: p.price,
          salePrice: p.sale_price,
          finalPrice: hasVariants ? minPrice : productFinalPrice,

          minPrice,
          maxPrice,
          hasVariants,

          isSale: hasVariants
            ? enrichedVariants.some((v) => v.isSale)
            : isProductSale,

          saleEnd: p.sale_end,
          saleStock: p.sale_stock ?? 0,
          saleSold: p.sale_sold ?? 0,
          saleLeft:
            (p.sale_stock ?? 0) > 0
              ? Math.max(0, (p.sale_stock ?? 0) - (p.sale_sold ?? 0))
              : null,

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

    flog("GET_SUCCESS_RETURN", enriched.length);

    return NextResponse.json(enriched);
  } catch (err: any) {
    ferr("GET_ERROR", err);
    return NextResponse.json(
      { error: "FAILED_TO_FETCH_PRODUCTS" },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST CREATE PRODUCT
========================================================= */

export async function POST(req: Request) {
  flog("POST_START");

  const auth = await requireSeller();
  if (!auth.ok) {
    fwarn("POST_AUTH_FAIL");
    return auth.response;
  }

  const userId = auth.userId;

  try {
    const body = await req.json();
    flog("POST_BODY", body);

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
    }

    const variants = normalizeVariants(body.variants);
    const hasVariants = variants.length > 0;

    let price = 0;

    if (hasVariants) {
      const prices = variants.map((v) => Number(v.price)).filter((n) => n > 0);

      if (!prices.length) {
        return NextResponse.json(
          { error: "INVALID_VARIANT_PRICE" },
          { status: 400 }
        );
      }

      price = Math.min(...prices);
    } else {
      price = Number(body.price);

      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: "INVALID_PRICE" }, { status: 400 });
      }
    }

    const saleEnabled = body.saleEnabled === true;
    const saleStock = saleEnabled ? Number(body.saleStock ?? 0) : 0;
    const salePrice =
      !hasVariants && typeof body.salePrice === "number"
        ? body.salePrice
        : null;

    const stock = hasVariants
      ? variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
      : Number(body.stock) || 0;

    const product = await createProduct(userId, {
      name: body.name.trim(),
      description: body.description ?? "",
      detail: body.detail ?? "",
      images: Array.isArray(body.images) ? body.images : [],
      thumbnail: body.thumbnail ?? "",
      category_id: body.categoryId ? Number(body.categoryId) : null,

      price,
      sale_price: hasVariants ? null : salePrice,
      sale_start: body.saleStart || null,
      sale_end: body.saleEnd || null,

      sale_enabled: saleEnabled,
      sale_stock: saleStock,

      stock,
      is_active: true,
      views: 0,
      sold: 0,
    });

    flog("POST_PRODUCT_CREATED", product);

    if (hasVariants) {
      await replaceVariantsByProductId(product.id, variants);
      flog("POST_VARIANTS_INSERTED", variants.length);
    }

    if (Array.isArray(body.shippingRates)) {
      await upsertShippingRates({
        productId: product.id,
        rates: body.shippingRates.map((r: any) => ({
          zone: r.zone,
          price: Number(r.price || 0),
          domesticCountryCode:
            r.zone === "domestic"
              ? body.domesticCountryCode ?? null
              : null,
        })),
      });

      flog("POST_SHIPPING_SAVED", body.shippingRates);
    }

    flog("POST_SUCCESS", product.id);

    return NextResponse.json({
      success: true,
      data: { id: product.id },
    });
  } catch (err: any) {
    ferr("POST_ERROR", err);
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
   PUT UPDATE PRODUCT
========================================================= */

export async function PUT(req: Request) {
  flog("PUT_START");

  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  try {
    const body = await req.json();
    flog("PUT_BODY", body);

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
      const prices = variants.map((v) => Number(v.price)).filter((n) => n > 0);
      price = prices.length ? Math.min(...prices) : 0;
    } else {
      price = Number(body.price) || 0;
    }

    const salePrice =
      typeof body.salePrice === "number"
        ? body.salePrice
        : null;

    const stock = hasVariants
      ? variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
      : Number(body.stock) || 0;

    const saleEnabled = body.saleEnabled === true;
    const saleStock = saleEnabled ? Number(body.saleStock ?? 0) : 0;

    const updated = await updateProductBySeller(userId, body.id, {
      name: body.name,
      description: body.description ?? "",
      detail: body.detail ?? "",
      images: body.images ?? [],
      thumbnail: body.thumbnail ?? "",
      category_id: body.categoryId ?? null,

      price,
      sale_price: hasVariants ? null : salePrice,

      sale_enabled: saleEnabled,
      sale_stock: saleStock,
      sale_start: body.saleStart || null,
      sale_end: body.saleEnd || null,

      stock,
      is_active: body.isActive ?? true,
    });

    if (!updated) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    await replaceVariantsByProductId(body.id, variants);
    flog("PUT_VARIANTS_REPLACED", variants.length);

    if (Array.isArray(body.shippingRates)) {
      await upsertShippingRates({
        productId: body.id,
        rates: body.shippingRates.map((r: any) => ({
          zone: r.zone,
          price: Number(r.price || 0),
          domesticCountryCode:
            r.zone === "domestic"
              ? r.countryCode || r.domesticCountryCode || null
              : null,
        })),
      });

      flog("PUT_SHIPPING_REPLACED", body.shippingRates);
    }

    flog("PUT_SUCCESS", body.id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    ferr("PUT_ERROR", err);
    return NextResponse.json(
      { error: "FAILED_TO_UPDATE_PRODUCT" },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE PRODUCT
========================================================= */

export async function DELETE(req: Request) {
  flog("DELETE_START");

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

    flog("DELETE_SUCCESS", id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    ferr("DELETE_ERROR", err);
    return NextResponse.json(
      { error: "FAILED_TO_DELETE_PRODUCT" },
      { status: 500 }
    );
  }
}
