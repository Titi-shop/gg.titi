import {
  withTransaction,
} from "@/lib/db";

import type {
  VariantWithSaleWindow,
} from "./types";

import {
  safeNumber,
} from "./helpers";

/* =========================================================
   LOGGER
========================================================= */

function vlog(
  step: string,
  payload?: unknown
): void {
  console.log(
    `🧪 [DB][VARIANTS] ${step}`,
    payload ?? ""
  );
}

/* =========================================================
   DECREASE STOCK
========================================================= */

export async function decreaseVariantStock(
  variantId: string,
  quantity: number
): Promise<{
  success: true;
}> {
  return withTransaction(
    async (client) => {
      vlog(
        "DECREASE_START",
        {
          variantId,
          quantity,
        }
      );

      const result =
        await client.query<VariantWithSaleWindow>(
          `
          SELECT
            v.*,
            p.sale_start,
            p.sale_end
          FROM product_variants v
          JOIN products p
            ON p.id = v.product_id
          WHERE v.id = $1
            AND v.deleted_at IS NULL
          FOR UPDATE
          `,
          [variantId]
        );

      const row =
        result.rows[0];

      if (!row) {
        throw new Error(
          "VARIANT_NOT_FOUND"
        );
      }

      if (!row.is_active) {
        throw new Error(
          "VARIANT_INACTIVE"
        );
      }

      if (
        !row.is_unlimited &&
        safeNumber(
          row.stock
        ) < quantity
      ) {
        throw new Error(
          "OUT_OF_STOCK"
        );
      }

      const now =
        Date.now();

      const start =
        row.sale_start
          ? new Date(
              row.sale_start
            ).getTime()
          : null;

      const end =
        row.sale_end
          ? new Date(
              row.sale_end
            ).getTime()
          : null;

      const isSaleWindow =
        Boolean(
          row.sale_enabled
        ) &&
        row.sale_price !==
          null &&
        start !== null &&
        end !== null &&
        now >= start &&
        now <= end;

      if (isSaleWindow) {
        const remaining =
          safeNumber(
            row.sale_stock
          ) -
          safeNumber(
            row.sale_sold
          );

        if (
          remaining <
          quantity
        ) {
          throw new Error(
            "FLASH_SALE_SOLD_OUT"
          );
        }
      }

      await client.query(
        `
        UPDATE product_variants
        SET
          stock = CASE
            WHEN is_unlimited
            THEN stock
            ELSE stock - $2
          END,

          sale_sold = CASE
            WHEN $3 = true
            THEN sale_sold + $2
            ELSE sale_sold
          END,

          sold = sold + $2,

          updated_at = NOW()

        WHERE id = $1
        `,
        [
          variantId,
          quantity,
          isSaleWindow,
        ]
      );

      vlog(
        "DECREASE_SUCCESS",
        {
          variantId,
          quantity,
        }
      );

      return {
        success: true,
      };
    }
  );
}
