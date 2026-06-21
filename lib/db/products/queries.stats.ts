import { query } from "@/lib/db";

import {
  safeNumber,
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
   INCREMENT PRODUCT VIEW
========================================================= */

export async function incrementProductView(
  product_id: string
): Promise<number> {
  log(
    "INCREMENT_VIEW_START",
    product_id
  );

  try {
    const result =
      await query<{
        views: number;
      }>(
        `
        UPDATE products
        SET
          views = views + 1,
          updated_at = NOW()
        WHERE id = $1
        RETURNING views
        `,
        [product_id]
      );

    const views =
      safeNumber(
        result.rows[0]?.views
      );

    log(
      "INCREMENT_VIEW_SUCCESS",
      views
    );

    return views;
  } catch (error) {
    logError(
      "INCREMENT_VIEW_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET SOLD COUNT
========================================================= */

export async function getSoldByProduct(
  product_id: string
): Promise<number> {
  log(
    "GET_SOLD_START",
    product_id
  );

  try {
    const result =
      await query<{
        sold: number;
      }>(
        `
        SELECT
          COALESCE(
            SUM(quantity),
            0
          ) AS sold
        FROM order_items
        WHERE product_id = $1
        `,
        [product_id]
      );

    const sold =
      safeNumber(
        result.rows[0]?.sold
      );

    log(
      "GET_SOLD_SUCCESS",
      sold
    );

    return sold;
  } catch (error) {
    logError(
      "GET_SOLD_ERROR",
      error
    );

    throw error;
  }
}
