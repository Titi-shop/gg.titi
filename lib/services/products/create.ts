import { createProduct } from "@/lib/db/products";

import {
  replaceVariantsByProductId,
} from "@/lib/db/variants";

import {
  upsertShippingRates,
} from "@/lib/db/shipping";

import {
  normalizeVariants,
  validateProductPayload,
} from "@/lib/validators/products";

import {
  ProductRequestBody,
} from "./types";

import {
  getCategoryId,
  normalizeShippingRates,
  buildSaleFields,
  buildProductFields,
} from "./helpers";

/* =========================================================
   CREATE PRODUCT
========================================================= */

export async function createProductService(
  req: Request,
  userId: string
) {
  try {
    const body =
      (await req.json()) as ProductRequestBody;

    console.log(
      "📦 CREATE_PRODUCT_BODY",
      JSON.stringify(
        body,
        null,
        2
      )
    );

    /* =========================
       VALIDATE
    ========================= */

    const error =
      validateProductPayload(
        body
      );

    console.log(
      "🧪 VALIDATION_RESULT",
      {
        error,

        sale_enabled:
          body.sale_enabled,

        sale_start:
          body.sale_start,

        sale_end:
          body.sale_end,

        variantCount:
          body.variants?.length ??
          0,
      }
    );

    if (error) {
      console.error(
        "❌ PRODUCT_VALIDATION_FAILED",
        error
      );

      return { error };
    }

    /* =========================
       VARIANTS
    ========================= */

    const variants =
      normalizeVariants(
        body.variants ?? []
      );

    console.log(
      "🧪 NORMALIZED_VARIANTS",
      JSON.stringify(
        variants,
        null,
        2
      )
    );

    const hasVariants =
      variants.length > 0;

    /* =========================
       PRODUCT FIELDS
    ========================= */

    const {
      price,
      stock,
    } = buildProductFields(
      body,
      hasVariants
    );

    const {
      sale_enabled,
      sale_price,
      sale_stock,
      sale_start,
      sale_end,
    } = buildSaleFields(
      body,
      hasVariants
    );

    console.log(
      "🚀 CREATE_PRODUCT_DB",
      {
        productPrice:
          price,

        stock,

        sale_enabled,

        sale_price,

        sale_stock,

        sale_start,

        sale_end,

        variantCount:
          variants.length,
      }
    );

    console.log(
      "🧪 CREATE_PRODUCT_INPUT",
      {
        hasVariants,

        price,

        stock,

        sale_enabled,

        sale_price,

        sale_stock,

        sale_start,

        sale_end,
      }
    );

    /* =========================
       CREATE PRODUCT
    ========================= */

    const product =
      await createProduct(
        userId,
        {
          name:
            body.name,

          description:
            body.description ??
            "",

          detail:
            body.detail ??
            "",

          images:
            body.images ??
            [],

          thumbnail:
            body.thumbnail ??
            "",

          category_id:
            getCategoryId(
              body
            ),

          price,
          stock,

          sale_enabled,
          sale_price,
          sale_stock,
          sale_start,
          sale_end,

          is_active:
            body.is_active !==
            false,

          has_variants:
            hasVariants,
        }
      );

    console.log(
      "✅ PRODUCT_CREATED",
      {
        id:
          product.id,
      }
    );

    /* =========================
       VARIANTS SAVE
    ========================= */

    if (
      variants.length > 0
    ) {
      console.log(
        "🧪 REPLACE_VARIANTS_START",
        {
          productId:
            product.id,

          count:
            variants.length,
        }
      );

      await replaceVariantsByProductId(
        product.id,
        variants
      );

      console.log(
        "✅ REPLACE_VARIANTS_DONE"
      );
    }

    /* =========================
       SHIPPING
    ========================= */

    const cleanedRates =
      normalizeShippingRates(
        body,
        body.primary_shipping_country
      );

    console.log(
      "🧪 CREATE_SHIPPING_RATES",
      cleanedRates
    );

    console.log(
      "🧪 SHIPPING_RATES",
      cleanedRates
    );

    if (
      cleanedRates.length > 0
    ) {
      await upsertShippingRates({
        productId:
          product.id,

        rates:
          cleanedRates,
      });

      console.log(
        "✅ UPDATE_SHIPPING_SAVED"
      );

      console.log(
        "✅ SHIPPING_SAVED"
      );
    }

    /* =========================
       SUCCESS
    ========================= */

    return {
      success: true,

      data: {
        id: product.id,
      },
    };
  } catch (error) {
    console.error(
      "💥 CREATE_PRODUCT_SERVICE_ERROR",
      error
    );

    return {
      error:
        error instanceof Error
          ? error.message
          : "UNKNOWN_ERROR",
    };
  }
}
