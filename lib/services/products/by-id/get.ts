import {
  getProductById,
} from "@/lib/db/products";

import {
  getVariantsByProductId,
} from "@/lib/db/variants";

import {
  getShippingRatesByProduct,
} from "@/lib/db/shipping";

import {
  log,
  calculatePriceSummary,
} from "./helpers";

/* =====================================================
   GET PRODUCT
===================================================== */

export async function getProductService(
  id: string
) {
  log(
    "PRODUCT.GET",
    "START",
    { id }
  );

  try {
    if (!id) {
      return {
        error:
          "INVALID_PRODUCT_ID",
      };
    }

    const product =
      await getProductById(id);

    if (!product) {
      return {
        error:
          "PRODUCT_NOT_FOUND",
      };
    }

    log(
      "PRODUCT.GET",
      "FOUND",
      {
        id,
        has_variants:
          product.has_variants,
      }
    );

    log(
      "VARIANTS.LOAD",
      "START",
      { id }
    );

    const variants =
      product.has_variants
        ? await getVariantsByProductId(
            id
          )
        : [];

    log(
      "VARIANTS.LOAD",
      "DONE",
      {
        count:
          variants.length,
      }
    );

    const {
      enrichedVariants,
      minPrice,
      maxPrice,
    } =
      calculatePriceSummary(
        variants
      );

    log(
      "PRICE.SUMMARY",
      "CALCULATED",
      {
        minPrice,
        maxPrice,
      }
    );

    const shippingRates =
      await getShippingRatesByProduct(
        id
      );

    log(
      "SHIPPING.LOAD",
      "DONE",
      {
        count:
          shippingRates.length,
      }
    );

    console.log(
      "🧪 PRODUCT_RESPONSE_DATA",
      {
        id: product.id,

        category_id:
          product.category_id,

        has_variants:
          product.has_variants,

        price:
          product.price,

        sale_price:
          product.sale_price,

        final_price:
          product.final_price,

        stock:
          product.stock,

        sale_stock:
          product.sale_stock,

        sale_enabled:
          product.sale_enabled,

        sale_start:
          product.sale_start,

        sale_end:
          product.sale_end,

        variantCount:
          enrichedVariants.length,

        shippingCount:
          shippingRates.length,
      }
    );

    return {
      ...product,

      has_variants:
        product.has_variants,

      variants:
        enrichedVariants,

      min_price:
        minPrice,

      max_price:
        maxPrice,

      shipping_rates:
        shippingRates,
    };
  } catch (error) {
    log(
      "PRODUCT.GET",
      "ERROR",
      error
    );

    return {
      error:
        "INTERNAL_SERVER_ERROR",
    };
  }
}
