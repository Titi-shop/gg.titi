import {
  withTransaction,
} from "@/lib/db";

import type {
  ProductVariant,
} from "@/types/product";

import {
  mapVariantToDB,
} from "./mapper";

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
   REPLACE VARIANTS
========================================================= */

export async function replaceVariantsByProductId(
  productId: string,
  variants: ProductVariant[]
): Promise<void> {
  await withTransaction(
    async (client) => {
      vlog(
        "REPLACE_START",
        {
          productId,
          count:
            variants.length,
        }
      );

      await client.query(
        `
        DELETE FROM product_variants
        WHERE product_id = $1
        `,
        [productId]
      );

      if (!variants.length) {
        vlog(
          "NO_VARIANTS"
        );

        return;
      }

      const mapped =
        variants.map(
          (
            variant,
            index
          ) =>
            mapVariantToDB(
              variant,
              productId,
              index
            )
        );

      const FIELD_COUNT =
        22;

      const placeholders:
        string[] = [];

      const values: Array<
        | string
        | number
        | boolean
        | null
      > = [];

      mapped.forEach(
        (
          variant,
          index
        ) => {
          const base =
            index *
            FIELD_COUNT;

          placeholders.push(
            `(${Array.from(
              {
                length:
                  FIELD_COUNT,
              },
              (_, i) =>
                `$${base + i + 1}`
            ).join(",")})`
          );

          values.push(
            variant.product_id,
            variant.option_1,
            variant.option_2,
            variant.option_3,
            variant.option_label_1,
            variant.option_label_2,
            variant.option_label_3,
            variant.name,
            variant.sku,
            variant.price,
            variant.sale_price,
            variant.final_price,
            variant.sale_enabled,
            variant.sale_stock,
            variant.sale_sold,
            variant.currency,
            variant.stock,
            variant.is_unlimited,
            variant.image,
            variant.is_active,
            variant.sort_order,
            variant.sold
          );
        }
      );

      await client.query(
        `
        INSERT INTO product_variants (
          product_id,
          option_1,
          option_2,
          option_3,
          option_label_1,
          option_label_2,
          option_label_3,
          name,
          sku,
          price,
          sale_price,
          final_price,
          sale_enabled,
          sale_stock,
          sale_sold,
          currency,
          stock,
          is_unlimited,
          image,
          is_active,
          sort_order,
          sold
        )
        VALUES
        ${placeholders.join(",")}
        `,
        values
      );

      vlog(
        "REPLACE_SUCCESS"
      );
    }
  );
}
