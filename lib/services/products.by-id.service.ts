import {
  getProductById,
  updateProductBySeller,
  deleteProductById,
  type UpdateProductInput,
} from "@/lib/db/products";

import {
  getVariantsByProductId,
  replaceVariantsByProductId,
  type ProductVariantRecord,
} from "@/lib/db/variants";

import {
  getShippingRatesByProduct,
  upsertShippingRates,
  type ShippingRateInput,
} from "@/lib/db/shipping";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeVariants,
  validateProductPayload,
} from "@/lib/validators/products";

/* =====================================================
   TYPES
===================================================== */

type ProductRequestBody = {
  name?: string;
  description?: string;
  detail?: string;
  images?: string[];
  thumbnail?: string;
  category_id?: number | null;
  price?: number;
  stock?: number;
  sale_price?: number | null;
  sale_enabled?: boolean;
  sale_stock?: number;
  sale_start?: string | null;
  sale_end?: string | null;
  is_active?: boolean;
  primary_shipping_country?: string | null;
  shipping_rates?: ShippingRateBody[];
  variants?: ProductVariantRecord[];
};

type ShippingRateBody = {
  zone: string;
  price?: number;
  domestic_country_code?: string | null;
};

/* =====================================================
   LOGGER
===================================================== */

function log(scope: string, message: string, data?: unknown) {
  console.log(`[${scope}] ${message}`, data ?? "");
}

/* =====================================================
   HELPERS
===================================================== */

function calcVariantFinalPrice(variant: ProductVariantRecord): number {
  const saleActive =
    variant.sale_enabled &&
    variant.sale_price !== null &&
    Number(variant.sale_price) > 0 &&
    Number(variant.sale_price) < Number(variant.price);

  return saleActive
    ? Number(variant.sale_price)
    : Number(variant.price);
}

function normalizeShippingRates(
  body: ProductRequestBody
): ShippingRateInput[] {
  const rates = body.shipping_rates ?? [];

  return rates.map((r) => ({
    zone: r.zone,
    price: Number(r.price ?? 0),
    domestic_country_code:
      r.zone === "domestic"
        ? r.domestic_country_code ??
          body.primary_shipping_country ??
          null
        : null,
  }));
}

/* =====================================================
   GET PRODUCT
===================================================== */

export async function getProductService(id: string) {
  log("PRODUCT.GET", "START", { id });

  try {
    if (!id) {
      return { error: "INVALID_PRODUCT_ID" };
    }

    const product = await getProductById(id);

    if (!product) {
      return { error: "PRODUCT_NOT_FOUND" };
    }

    log("PRODUCT.GET", "FOUND", {
      id,
      has_variants: product.has_variants,
    });

    log("VARIANTS.LOAD", "START", { id });

    const variants = product.has_variants
      ? await getVariantsByProductId(id)
      : [];

    log("VARIANTS.LOAD", "DONE", {
      count: variants.length,
    });

    const enrichedVariants = variants.map((v) => ({
      ...v,
      final_price: calcVariantFinalPrice(v),
    }));

    const prices = enrichedVariants.map((v) =>
      Number(v.final_price)
    );

    const minPrice = prices.length
      ? Math.min(...prices)
      : null;

    const maxPrice = prices.length
      ? Math.max(...prices)
      : null;

    log("PRICE.SUMMARY", "CALCULATED", {
      minPrice,
      maxPrice,
    });

    const shippingRates =
      await getShippingRatesByProduct(id);

    log("SHIPPING.LOAD", "DONE", {
      count: shippingRates.length,
    });

    return {
      ...product,
      has_variants: product.has_variants,
      variants: enrichedVariants,
      min_price: minPrice,
      max_price: maxPrice,
      shipping_rates: shippingRates,
    };
  } catch (error) {
    log("PRODUCT.GET", "ERROR", error);
    return { error: "INTERNAL_SERVER_ERROR" };
  }
}

/* =====================================================
   UPDATE PRODUCT
===================================================== */

export async function updateProductService(
  id: string,
  userId: string,
  body: ProductRequestBody
) {
  log("PRODUCT.UPDATE", "START", { id });

  try {
    if (!id) {
      return { error: "INVALID_PRODUCT_ID" };
    }

    const error = validateProductPayload({
      ...body,
      variants: body.variants ?? [],
    });

    if (error) {
      return { error };
    }

    const variants = normalizeVariants(body.variants ?? []);
    const hasVariants = variants.length > 0;

    log("VARIANTS.PROCESS", "DONE", {
      count: variants.length,
      hasVariants,
    });

    const finalPrice = hasVariants
      ? Math.min(
          ...variants.map((v) =>
            Number(v.final_price)
          )
        )
      : Number(body.price ?? 0);

    const finalStock = hasVariants
      ? variants.reduce(
          (sum, v) =>
            sum + Number(v.stock ?? 0),
          0
        )
      : Number(body.stock ?? 0);

    log("PRICE.STOCK", "CALCULATED", {
      finalPrice,
      finalStock,
    });

    const payload: UpdateProductInput = {
      name: body.name,
      description: body.description,
      detail: body.detail,
      images: body.images,
      thumbnail: body.thumbnail,
      category_id: body.category_id ?? null,
      price: finalPrice,
      stock: finalStock,
      sale_price: hasVariants
        ? null
        : body.sale_price ?? null,
      sale_enabled: body.sale_enabled ?? false,
      sale_stock: Number(body.sale_stock ?? 0),
      sale_start: body.sale_start ?? null,
      sale_end: body.sale_end ?? null,
      is_active: body.is_active ?? true,
      has_variants: hasVariants,
    };

    const updated = await updateProductBySeller(
      userId,
      id,
      payload
    );

    if (!updated) {
      return { error: "NOT_FOUND" };
    }

    log("PRODUCT.UPDATE", "SUCCESS", { id });

    await replaceVariantsByProductId(id, variants);

    log("VARIANTS.UPDATE", "DONE", {
      count: variants.length,
    });

    const cleanedRates = normalizeShippingRates(body);

    await upsertShippingRates({
      productId: id,
      rates: cleanedRates,
    });

    log("SHIPPING.UPDATE", "DONE", {
      count: cleanedRates.length,
    });

    return {
      success: true,
      data: {
        id,
        price: finalPrice,
        stock: finalStock,
        has_variants: hasVariants,
      },
    };
  } catch (error) {
    log("PRODUCT.UPDATE", "ERROR", error);
    return { error: "INTERNAL_SERVER_ERROR" };
  }
}

/* =====================================================
   DELETE PRODUCT
===================================================== */

export async function deleteProductService(
  id: string,
  userId: string
) {
  log("PRODUCT.DELETE", "START", { id });

  try {
    if (!id) {
      return { error: "INVALID_PRODUCT_ID" };
    }

    const product = await getProductById(id);

    if (!product) {
      return { error: "PRODUCT_NOT_FOUND" };
    }

    const paths: string[] = [];

    const collectPath = (url?: string | null) => {
      if (!url) return;

      const marker = "/products/";
      const index = url.indexOf(marker);

      if (index === -1) return;

      const path = url.substring(index + marker.length);

      if (path) paths.push(path);
    };

    collectPath(product.thumbnail);

    if (Array.isArray(product.images)) {
      for (const img of product.images) {
        collectPath(img);
      }
    }

    const result = await deleteProductById(id, userId);

    if (!result.ok) {
      return { error: "DELETE_FAILED" };
    }

    log("PRODUCT.DELETE", "DELETED", { id });

    if (paths.length > 0) {
      await supabaseAdmin.storage
        .from("products")
        .remove(paths);

      log("STORAGE.DELETE", "DONE", {
        count: paths.length,
      });
    }

    return { success: true };
  } catch (error) {
    log("PRODUCT.DELETE", "ERROR", error);
    return { error: "INTERNAL_SERVER_ERROR" };
  }
}
