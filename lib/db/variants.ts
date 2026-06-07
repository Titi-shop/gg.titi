import { query, withTransaction } from "@/lib/db";

import type {
  ProductVariant,
  ProductVariantDB,
} from "@/types/product";

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
   TYPES
========================================================= */

type VariantRow = Pick<
  ProductVariantDB,
  | "id"
  | "product_id"
  | "price"
  | "sale_price"
  | "final_price"
  | "stock"
  | "is_unlimited"
  | "is_active"
>;

type VariantWithSaleWindow =
  ProductVariantDB & {
    sale_start: string | null;
    sale_end: string | null;
  };

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isNaN(parsed)
    ? fallback
    : parsed;
}

function safeNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isNaN(parsed)
    ? null
    : parsed;
}

function trimOrNull(
  value?: string | null
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length
    ? trimmed
    : null;
}

function buildVariantName(
  variant: Pick<
    ProductVariant,
    | "option1"
    | "option2"
    | "option3"
  >
): string {
  return [
    variant.option1,
    variant.option2,
    variant.option3,
  ]
    .filter(
      (
        value
      ): value is string =>
        Boolean(
          value?.trim()
        )
    )
    .join(" - ");
}

function calcFinalPrice(
  price: number,
  salePrice: number | null,
  saleEnabled: boolean
): number {
  if (
    saleEnabled &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price
  ) {
    return salePrice;
  }

  return price;
}

/* =========================================================
   MAP DB -> APP
========================================================= */

export function mapVariantToApp(
  row: ProductVariantDB
): ProductVariant {
  const price = safeNumber(
    row.price
  );

  const salePrice =
    safeNullableNumber(
      row.sale_price
    );

  const saleEnabled =
    Boolean(
      row.sale_enabled
    ) &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price;

  const mapped: ProductVariant =
    {
      id: row.id,

      option1:
        row.option_1 ?? "",

      option2:
        row.option_2,

      option3:
        row.option_3,

      option_label1:
        row.option_label_1,

      option_label2:
        row.option_label_2,

      option_label3:
        row.option_label_3,

      name:
        row.name ||
        buildVariantName({
          option1:
            row.option_1 ??
            "",
          option2:
            row.option_2,
          option3:
            row.option_3,
        }),

      sku: row.sku,

      price,

      sale_price:
        saleEnabled
          ? salePrice
          : null,

      final_price:
        safeNumber(
          row.final_price,
          calcFinalPrice(
            price,
            salePrice,
            saleEnabled
          )
        ),

      currency:
        row.currency ===
        "PI"
          ? "PI"
          : "PI",

      sale_enabled:
        saleEnabled,

      sale_stock:
        safeNumber(
          row.sale_stock
        ),

      sale_sold:
        safeNumber(
          row.sale_sold
        ),

      stock: safeNumber(
        row.stock
      ),

      is_unlimited:
        Boolean(
          row.is_unlimited
        ),

      image: row.image,

      is_active:
        Boolean(
          row.is_active
        ),

      sort_order:
        safeNumber(
          row.sort_order
        ),

      sold: safeNumber(
        row.sold
      ),
    };

  vlog(
    "MAP_DB_TO_APP",
    mapped
  );

  return mapped;
}

/* =========================================================
   MAP APP -> DB
========================================================= */

export function mapVariantToDB(
  variant: ProductVariant,
  productId: string,
  sortOrder: number
): ProductVariantDB {
  const price = safeNumber(
    variant.price
  );

  const salePrice =
    safeNullableNumber(
      variant.sale_price
    );

  const saleEnabled =
    Boolean(
      variant.sale_enabled
    ) &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price;

  const mapped: ProductVariantDB =
    {
      id: variant.id,

      product_id: productId,

      option_1:
        trimOrNull(
          variant.option1
        ),

      option_2:
        trimOrNull(
          variant.option2
        ),

      option_3:
        trimOrNull(
          variant.option3
        ),

      option_label_1:
        trimOrNull(
          variant.option_label1
        ),

      option_label_2:
        trimOrNull(
          variant.option_label2
        ),

      option_label_3:
        trimOrNull(
          variant.option_label3
        ),

      name:
        trimOrNull(
          variant.name
        ) ??
        buildVariantName(
          variant
        ),

      sku: trimOrNull(
        variant.sku
      ),

      price,

      sale_price:
        saleEnabled
          ? salePrice
          : null,

      final_price:
        calcFinalPrice(
          price,
          salePrice,
          saleEnabled
        ),

      sale_enabled:
        saleEnabled,

      sale_stock:
        saleEnabled
          ? safeNumber(
              variant.sale_stock
            )
          : 0,

      sale_sold:
        safeNumber(
          variant.sale_sold
        ),

      currency: "PI",

      stock: safeNumber(
        variant.stock
      ),

      is_unlimited:
        Boolean(
          variant.is_unlimited
        ),

      image:
        variant.image ?? "",

      is_active:
        variant.is_active !==
        false,

      sort_order:
        safeNumber(sortOrder),

      sold: safeNumber(
        variant.sold
      ),

      created_at: undefined,
      updated_at: undefined,
      deleted_at: null,
    };

  vlog(
    "MAP_APP_TO_DB",
    mapped
  );

  return mapped;
}

/* =========================================================
   GET VARIANTS BY PRODUCT
========================================================= */

export async function getVariantsByProductId(
  productId: string
): Promise<ProductVariant[]> {
  vlog(
    "GET_BY_PRODUCT_START",
    {
      productId,
    }
  );

  if (!productId) {
    throw new Error(
      "INVALID_PRODUCT_ID"
    );
  }

  const result =
    await query<ProductVariantDB>(
      `
      SELECT *
      FROM product_variants
      WHERE product_id = $1
        AND deleted_at IS NULL
      ORDER BY
        sort_order ASC,
        created_at ASC
      `,
      [productId]
    );

  vlog(
    "GET_BY_PRODUCT_ROWS",
    result.rows.length
  );

  return result.rows.map(
    mapVariantToApp
  );
}

/* =========================================================
   GET SINGLE VARIANT
========================================================= */

export async function getVariantById(
  variantId: string
): Promise<VariantRow | null> {
  vlog(
    "GET_VARIANT_START",
    {
      variantId,
    }
  );

  const result =
    await query<VariantRow>(
      `
      SELECT
        id,
        product_id,
        price,
        sale_price,
        final_price,
        stock,
        is_unlimited,
        is_active
      FROM product_variants
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [variantId]
    );

  const row =
    result.rows[0] ?? null;

  vlog(
    "GET_VARIANT_RESULT",
    row
  );

  return row;
}

/* =========================================================
   VALIDATE OWNERSHIP
========================================================= */

export async function validateVariantOwnership(
  variantId: string,
  productId: string
): Promise<boolean> {
  const variant =
    await getVariantById(
      variantId
    );

  if (!variant) {
    return false;
  }

  return (
    variant.is_active &&
    variant.product_id ===
      productId
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
      vlog("REPLACE_START", {
        productId,
        count:
          variants.length,
      });

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

      const FIELD_COUNT = 22;

      const placeholders: string[] =
        [];

      const values: Array<
        | string
        | number
        | boolean
        | null
      > = [];

      mapped.forEach(
        (variant, index) => {
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
        ${placeholders.join(
          ","
        )}
        `,
        values
      );

      vlog(
        "REPLACE_SUCCESS"
      );
    }
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

      const now = Date.now();

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
