import {
  updateProductBySeller,
  type UpdateProductInput,
} from "@/lib/db/products";

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

import type {
  ProductRequestBody,
} from "./types";

import {
  log,
  normalizeShippingRates,
} from "./helpers";

/* =====================================================
   UPDATE PRODUCT
===================================================== */

export async function updateProductService(
  id: string,
  userId: string,
  body: ProductRequestBody
) {
  log(
    "PRODUCT.UPDATE",
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

    const error =
  validateProductPayload({
    ...body,
    variants:
      body.variants ?? [],
  });

console.log(
  "🧪 VALIDATION_RESULT",
  error
);

if (error) {
  console.error(
    "❌ VALIDATION_FAILED",
    error,
    {
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

  return { error };
}

    const variants =
      normalizeVariants(
        body.variants ?? []
      );

    const hasVariants =
      variants.length > 0;

    log(
      "VARIANTS.PROCESS",
      "DONE",
      {
        count:
          variants.length,

        hasVariants,
      }
    );

    const finalPrice =
      hasVariants
        ? Math.min(
            ...variants.map(
              (variant) =>
                Number(
                  variant.final_price
                )
            )
          )
        : Number(
            body.price ?? 0
          );

    const finalStock =
      hasVariants
        ? variants.reduce(
            (
              sum,
              variant
            ) =>
              sum +
              Number(
                variant.stock ??
                  0
              ),
            0
          )
        : Number(
            body.stock ?? 0
          );

    log(
      "PRICE.STOCK",
      "CALCULATED",
      {
        finalPrice,
        finalStock,
      }
    );

    const payload: UpdateProductInput =
      {
        name:
          body.name,

        description:
          body.description,

        detail:
          body.detail,

        images:
          body.images,

        thumbnail:
          body.thumbnail,

        category_id:
          body.category_id ??
          null,

        price:
          hasVariants
            ? null
            : finalPrice,

        stock:
          hasVariants
            ? null
            : finalStock,

        /* ======================
           FORCE DISABLE SALE
           WHEN HAS VARIANTS
        ======================= */

        sale_price:
          hasVariants
            ? null
            : body.sale_price ??
              null,

        sale_enabled:
          hasVariants
            ? false
            : Boolean(
                body.sale_enabled
              ),

        sale_stock:
          hasVariants
            ? null
            : Number(
                body.sale_stock ??
                  0
              ),

        sale_start:
  body.sale_start ?? null,

sale_end:
  body.sale_end ?? null,

        is_active:
          body.is_active ??
          true,

        has_variants:
          hasVariants,
      };

    console.log(
      "🧪 UPDATE_PAYLOAD",
      payload
    );

    const updated =
      await updateProductBySeller(
        userId,
        id,
        payload
      );

    if (!updated) {
      return {
        error:
          "NOT_FOUND",
      };
    }

    log(
      "PRODUCT.UPDATE",
      "SUCCESS",
      { id }
    );

    await replaceVariantsByProductId(
      id,
      variants
    );

    log(
      "VARIANTS.UPDATE",
      "DONE",
      {
        count:
          variants.length,
      }
    );

    const cleanedRates =
      normalizeShippingRates(
        body
      );

    await upsertShippingRates({
      productId: id,
      rates: cleanedRates,
    });

    log(
      "SHIPPING.UPDATE",
      "DONE",
      {
        count:
          cleanedRates.length,
      }
    );

    return {
      success: true,

      data: {
        id,

        price:
          finalPrice,

        stock:
          finalStock,

        has_variants:
          hasVariants,
      },
    };
  } catch (error) {
    log(
      "PRODUCT.UPDATE",
      "ERROR",
      error
    );

    return {
      error:
        "INTERNAL_SERVER_ERROR",
    };
  }
}
