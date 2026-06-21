import { query } from "@/lib/db";

import type {
  ProductRow,
  ProductRecord,
  CreateProductInput,
  ProductStatus,
} from "@/types/Product";

import {
  safeNumber,
  safeNullableNumber,
  normalizeImages,
  normalizeStatus,
  generateUniqueSlug,
  isUUID,
  log,
  logError,
} from "./helpers";
import { calcFinalPrice }from "./pricing";
import { mapRow } from "./mapper";

export async function createProduct(
  seller_id: string,
  input: CreateProductInput
): Promise<ProductRecord> {
  log(
    "CREATE_START",
    input
  );

  try {
    if (
      !isUUID(seller_id)
    ) {
      throw new Error(
        "INVALID_SELLER_ID"
      );
    }

    if (
      !input.name?.trim()
    ) {
      throw new Error(
        "INVALID_PRODUCT_NAME"
      );
    }

    if (
      !Array.isArray(
        input.images
      ) ||
      input.images.length === 0
    ) {
      throw new Error(
        "PRODUCT_IMAGE_REQUIRED"
      );
    }

    const hasVariants =
  input.has_variants === true;

const price = hasVariants
  ? null
  : safeNumber(input.price);

const salePrice = hasVariants
  ? null
  : safeNullableNumber(
      input.sale_price
    );

if (
  !hasVariants &&
  price !== null &&
  price < 0
) {
  throw new Error(
    "INVALID_PRODUCT_PRICE"
  );
}

if (
  !hasVariants &&
  price !== null &&
  salePrice !== null &&
  salePrice >= price
) {
  throw new Error(
    "INVALID_SALE_PRICE"
  );
}

const finalPrice = hasVariants
  ? null
  : calcFinalPrice({
      price,
      sale_price: salePrice,
      sale_enabled:
        input.sale_enabled,
    });

const stock = hasVariants
  ? null
  : safeNumber(
      input.stock
    );

const saleStock = hasVariants
  ? null
  : safeNumber(
      input.sale_stock
    );

const saleEnabled =
  Boolean(input.sale_enabled);

const saleStart =
  input.sale_start ?? null;

const saleEnd =
  input.sale_end ?? null;

    const slug =
      await generateUniqueSlug(
        input.name
      );

    const status =
      normalizeStatus(
        input.status,
        input.is_active
      );

    const result =
      await query<ProductRow>(
        `
        INSERT INTO products (
          seller_id,
          name,
          slug,
          short_description,
          description,
          detail,
          thumbnail,
          images,
          detail_images,
          video_url,
          price,
          sale_price,
          final_price,
          currency,
          stock,
          is_unlimited,
          is_featured,
          is_digital,
          status,
          category_id,
          sale_start,
          sale_end,
          sale_enabled,
          sale_stock,
          meta_title,
          meta_description,
          is_active,
          has_variants
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,
          $11,$12,$13,$14,
          $15,$16,$17,$18,
          $19,$20,$21,$22,
          $23,$24,$25,$26,
          $27,$28
        )
        RETURNING *
        `,
        [
          
  seller_id,
  input.name.trim(),
  slug,

  input.short_description ??
    "",

  input.description ??
    "",

  input.detail ??
    "",

  input.thumbnail ??
    "",

  normalizeImages(
    input.images
  ),

  normalizeImages(
    input.detail_images
  ),

  input.video_url ??
    "",

  price,
  salePrice,
  finalPrice,
  "PI",

  stock,

  Boolean(
    input.is_unlimited
  ),

  Boolean(
    input.is_featured
  ),

  Boolean(
    input.is_digital
  ),

  status,

  input.category_id ??
    null,

  saleStart,
  saleEnd,

  saleEnabled,

  saleStock,

  input.meta_title ??
    "",

  input.meta_description ??
    "",

  input.is_active !==
    false,

  hasVariants,
]
      );

    const row =
      result.rows[0];

    if (!row) {
      throw new Error(
        "FAILED_TO_CREATE_PRODUCT"
      );
    }

    log(
      "CREATE_SUCCESS",
      row.id
    );

    return mapRow(row);
  } catch (error) {
    logError(
      "CREATE_ERROR",
      error
    );

    throw error;
  }
}
