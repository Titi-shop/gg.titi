import {
  query,
  withTransaction,
} from "@/lib/db";

import {
  isUUID,
} from "./helpers";

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
   DELETE PRODUCT
========================================================= */

export async function deleteProductBySeller(
  seller_id: string,
  product_id: string
): Promise<boolean> {
  log(
    "DELETE_START",
    {
      seller_id,
      product_id,
    }
  );

  try {
    if (
      !isUUID(seller_id) ||
      !isUUID(product_id)
    ) {
      return false;
    }

    const result =
      await query<{
        id: string;
      }>(
        `
        DELETE FROM products
        WHERE id = $1
          AND seller_id = $2
        RETURNING id
        `,
        [
          product_id,
          seller_id,
        ]
      );

    const success =
      result.rows.length > 0;

    log(
      "DELETE_SUCCESS",
      success
    );

    return success;
  } catch (error) {
    logError(
      "DELETE_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   DELETE PRODUCT FULL
========================================================= */

export async function deleteProductById(
  product_id: string,
  seller_id: string
): Promise<{
  ok: boolean;
}> {
  log(
    "DELETE_FULL_START",
    {
      product_id,
      seller_id,
    }
  );

  return withTransaction(
    async (client) => {
      await client.query(
        `
        DELETE FROM product_variants
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM shipping_rates
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM cart_items
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM favorites
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM product_reviews
        WHERE product_id = $1
        `,
        [product_id]
      );

      const result =
        await client.query<{
          id: string;
        }>(
          `
          DELETE FROM products
          WHERE id = $1
            AND seller_id = $2
          RETURNING id
          `,
          [
            product_id,
            seller_id,
          ]
        );

      const ok =
        result.rows.length > 0;

      log(
        "DELETE_FULL_SUCCESS",
        ok
      );

      return { ok };
    }
  );
}
