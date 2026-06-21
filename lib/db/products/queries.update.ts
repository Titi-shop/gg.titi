import { query } from "@/lib/db";

import type {
  ProductRow,
  ProductRecord,
  UpdateProductInput,
} from "@/types/Product";

import {
  isUUID,
  safeNumber,
  safeNullableNumber,
  normalizeImages,
  normalizeStatus,
  slugify,
  log,
  logError,
} from "./helpers";

import { mapRow } from "./mapper";
import { calcFinalPrice } from "./pricing";
import { getProductById } from "./queries.read";

export async function updateProductBySeller(
  seller_id: string,
  product_id: string,
  input: UpdateProductInput
): Promise<ProductRecord | null> {
  log(
    "UPDATE_START",
    {
      seller_id,
      product_id,
      input,
    }
  );

  try {
    if (
      !isUUID(seller_id) ||
      !isUUID(product_id)
    ) {
      return null;
    }

    if (
      input.name !==
        undefined &&
      !input.name.trim()
    ) {
      throw new Error(
        "INVALID_PRODUCT_NAME"
      );
    }

    if (
      input.images !==
        undefined &&
      input.images.length === 0
    ) {
      throw new Error(
        "PRODUCT_IMAGE_REQUIRED"
      );
    }

    const current =
  await getProductById(
    product_id
  );

if (!current) {
  return null;
}

const hasVariants = Boolean(
  input.has_variants ??
  current.has_variants
);
    log(
  "UPDATE_VARIANT_MODE",
  {
    current_has_variants:
      current.has_variants,

    input_has_variants:
      input.has_variants,

    final_has_variants:
      hasVariants,
  }
);

/* =========================
   PRICE
========================= */

const nextPrice =
  hasVariants
    ? null
    : input.price !== undefined
    ? safeNumber(
        input.price
      )
    : current.price;

const nextSalePrice =
  hasVariants
    ? null
    : input.sale_price !==
        undefined
    ? safeNullableNumber(
        input.sale_price
      )
    : current.sale_price;

const nextSaleEnabled =
  input.sale_enabled !== undefined
    ? Boolean(
        input.sale_enabled
      )
    : current.sale_enabled;

const nextFinalPrice =
  hasVariants
    ? null
    : calcFinalPrice({
        price:
          safeNumber(
            nextPrice
          ),
        sale_price:
          nextSalePrice,
        sale_enabled:
          nextSaleEnabled,
      });
log(
  "UPDATE_PRICE_CALC",
  {
    nextPrice,
    nextSalePrice,
    nextSaleEnabled,
    nextFinalPrice,
  }
);
/* =========================
   STOCK
========================= */

const nextStock =
  hasVariants
    ? null
    : input.stock !==
        undefined
    ? safeNumber(
        input.stock
      )
    : current.stock;

const nextSaleStock =
  hasVariants
    ? null
    : input.sale_stock !==
        undefined
    ? safeNumber(
        input.sale_stock
      )
    : current.sale_stock;

/* =========================
   SALE WINDOW
========================= */

const nextSaleStart =
  input.sale_start !== undefined
    ? input.sale_start
    : current.sale_start;

const nextSaleEnd =
  input.sale_end !== undefined
    ? input.sale_end
    : current.sale_end;

    const nextStatus =
      normalizeStatus(
        input.status,
        input.is_active
      );

    const result =
      await query<ProductRow>(
        `
        UPDATE products
        SET
          name = $1,
          slug = $2,
          short_description = $3,
          description = $4,
          detail = $5,
          thumbnail = $6,
          images = $7,
          detail_images = $8,
          video_url = $9,
          price = $10,
          sale_price = $11,
          final_price = $12,
          stock = $13,
          is_unlimited = $14,
          is_featured = $15,
          is_digital = $16,
          status = $17,
          category_id = $18,
          sale_start = $19,
          sale_end = $20,
          sale_enabled = $21,
          sale_stock = $22,
          meta_title = $23,
          meta_description = $24,
          is_active = $25,
          has_variants = $26,
          updated_at = NOW()
        WHERE id = $27
          AND seller_id = $28
          AND deleted_at IS NULL
        RETURNING *
        `,
        [
          input.name?.trim() ??
            current.name,

          slugify(
            input.name ??
              current.name
          ),

          input.short_description ??
            current.short_description,

          input.description ??
            current.description,

          input.detail ??
            current.detail,

          input.thumbnail ??
            current.thumbnail,

          input.images
            ? normalizeImages(
                input.images
              )
            : current.images,

          input.detail_images
            ? normalizeImages(
                input.detail_images
              )
            : current.detail_images,

          input.video_url ??
            current.video_url,

          nextPrice,
          nextSalePrice,
          nextFinalPrice,
          nextStock,

          input.is_unlimited !==
            undefined
            ? Boolean(
                input.is_unlimited
              )
            : current.is_unlimited,

          input.is_featured !==
            undefined
            ? Boolean(
                input.is_featured
              )
            : current.is_featured,

          input.is_digital !==
            undefined
            ? Boolean(
                input.is_digital
              )
            : current.is_digital,

          nextStatus,

          input.category_id !==
            undefined
            ? input.category_id
            : current.category_id,

          nextSaleStart,
          nextSaleEnd,
          nextSaleEnabled,

          nextSaleStock,

          input.meta_title ??
            current.meta_title,

          input.meta_description ??
            current.meta_description,

          input.is_active !==
            undefined
            ? input.is_active
            : current.is_active,

          hasVariants,

          product_id,
          seller_id,
        ]
      );

    const row =
      result.rows[0] ??
      null;

    if (!row) {
      return null;
    }

    log(
      "UPDATE_SUCCESS",
      row.id
    );

    return mapRow(row);
  } catch (error) {
    logError(
      "UPDATE_ERROR",
      error
    );

    throw error;
  }
}
