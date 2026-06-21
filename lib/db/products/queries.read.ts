import { query } from "@/lib/db";

import type {
  ProductRow,
  ProductRecord,
} from "@/types/Product";

import {
  isUUID,
} from "./helpers";

import {
  mapRow,
} from "./mapper";

/* =========================================================
   LOGGER
========================================================= */

function log(
  step: string,
  data?: unknown
): void {
  console.log(
    `🧪 [DB][PRODUCTS] ${step}`,
    data ?? ""
  );
}

function logError(
  step: string,
  error: unknown
): void {
  console.error(
    `💥 [DB][PRODUCTS] ${step}`,
    error
  );
}

/* =========================================================
   GET ALL PRODUCTS
========================================================= */

export async function getAllProducts(
  limit = 20
): Promise<ProductRecord[]> {
  log(
    "GET_ALL_START",
    { limit }
  );

  try {
    const t0 = performance.now();
    const result =
      await query<ProductRow>(
        `
        SELECT *
        FROM products
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [limit]
      );
console.log(
    "⏱️ SQL getAllProducts:",
    performance.now() - t0
  );


    log(
      "GET_ALL_SUCCESS",
      {
        count:
          result.rows.length,
      }
    );

    return result.rows.map(
      mapRow
    );
  } catch (error) {
    logError(
      "GET_ALL_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET PRODUCT BY ID
========================================================= */

export async function getProductById(
  product_id: string
): Promise<ProductRecord | null> {
  log(
    "GET_BY_ID_START",
    { product_id }
  );

  try {
    if (
      !product_id ||
      !isUUID(product_id)
    ) {
      log(
        "GET_BY_ID_INVALID_ID",
        product_id
      );

      return null;
    }

    const result =
      await query<ProductRow>(
        `
        SELECT *
        FROM products
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [product_id]
      );

    const row =
      result.rows[0] ??
      null;

    console.log(
      "🧪 GET_BY_ID_DB_ROW",
      {
        id: row?.id,
        category_id:
          row?.category_id,
        price:
          row?.price,
        sale_price:
          row?.sale_price,
        final_price:
          row?.final_price,
        stock:
          row?.stock,
        sale_stock:
          row?.sale_stock,
        sale_enabled:
          row?.sale_enabled,
        sale_start:
          row?.sale_start,
        sale_end:
          row?.sale_end,
        has_variants:
          row?.has_variants,
      }
    );

    if (!row) {
      log(
        "GET_BY_ID_NOT_FOUND",
        product_id
      );

      return null;
    }

    const mapped =
      mapRow(row);

    console.log(
      "🧪 GET_BY_ID_MAPPED",
      {
        id: mapped.id,
        category_id:
          mapped.category_id,
        price:
          mapped.price,
        sale_price:
          mapped.sale_price,
        final_price:
          mapped.final_price,
        stock:
          mapped.stock,
        sale_stock:
          mapped.sale_stock,
        sale_enabled:
          mapped.sale_enabled,
        sale_start:
          mapped.sale_start,
        sale_end:
          mapped.sale_end,
        has_variants:
          mapped.has_variants,
      }
    );

    log(
      "GET_BY_ID_SUCCESS",
      product_id
    );

    return mapped;
  } catch (error) {
    logError(
      "GET_BY_ID_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET PRODUCTS BY IDS
========================================================= */

export async function getProductsByIds(
  ids: string[]
): Promise<ProductRecord[]> {
  log(
    "GET_BY_IDS_START",
    ids
  );

  try {
    if (
      !Array.isArray(ids)
    ) {
      throw new Error(
        "INVALID_PRODUCT_IDS"
      );
    }

    const validIds =
      ids.filter(isUUID);

    if (
      validIds.length === 0
    ) {
      log(
        "GET_BY_IDS_EMPTY"
      );

      return [];
    }

    const result =
      await query<ProductRow>(
        `
        SELECT *
        FROM products
        WHERE id = ANY($1::uuid[])
          AND deleted_at IS NULL
        `,
        [validIds]
      );

    log(
      "GET_BY_IDS_SUCCESS",
      {
        count:
          result.rows.length,
      }
    );

    return result.rows.map(
      mapRow
    );
  } catch (error) {
    logError(
      "GET_BY_IDS_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET SELLER PRODUCTS
========================================================= */

export async function getSellerProducts(
  seller_id: string
): Promise<ProductRecord[]> {
  log(
    "GET_SELLER_PRODUCTS_START",
    { seller_id }
  );

  try {
    if (!isUUID(seller_id)) {
      return [];
    }

    const result =
      await query<ProductRow>(
        `
        SELECT
  p.*,

  MIN(
    COALESCE(
      pv.final_price,
      pv.sale_price,
      pv.price
    )
  ) AS min_price,

  MIN(
    CASE
      WHEN pv.sale_enabled = true
      THEN pv.sale_price
      ELSE NULL
    END
  ) AS min_sale_price,

  up.shop_name,
  up.shop_banner,
  up.avatar_url,
  up.total_sales,
  up.shop_description

FROM products p

LEFT JOIN product_variants pv
  ON pv.product_id = p.id
 AND pv.deleted_at IS NULL

LEFT JOIN user_profiles up
  ON up.user_id = p.seller_id

WHERE p.seller_id = $1
  AND p.deleted_at IS NULL

GROUP BY
  p.id,
  up.shop_name,
  up.shop_banner,
  up.avatar_url,
  up.total_sales,
  up.shop_description

ORDER BY p.created_at DESC
        `,
        [seller_id]
      );

    log(
      "GET_SELLER_PRODUCTS_SUCCESS",
      {
        count:
          result.rows.length,
        first:
          result.rows[0] ?? null,
      }
    );

    return result.rows.map(
      mapRow
    );
  } catch (error) {
    logError(
      "GET_SELLER_PRODUCTS_ERROR",
      error
    );

    throw error;
  }
}
