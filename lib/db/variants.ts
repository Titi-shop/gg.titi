
import { query, withTransaction } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

export type ProductVariant = {
  id?: string;
  optionName?: string;
  optionValue: string;

  price?: number;
  salePrice?: number | null;
  finalPrice?: number;

  stock: number;
  isUnlimited?: boolean;

  saleStock?: number;
  saleSold?: number;
  saleEnabled?: boolean;

  sold?: number;

  sku?: string | null;
  image?: string | null;

  sortOrder?: number;
  isActive?: boolean;
};

/* =========================================================
   VALIDATE
========================================================= */

function validateVariants(input: unknown): ProductVariant[] {
  console.log("🧪 [VARIANT][VALIDATE] RAW:", input);

  if (!Array.isArray(input)) {
    console.warn("⚠️ [VARIANT] input is not array");
    return [];
  }

  const valid = input.filter((v, i): v is ProductVariant => {
    if (typeof v !== "object" || v === null) {
      console.warn(`❌ [VARIANT] invalid object at index ${i}:`, v);
      return false;
    }

    const value =
      typeof v.optionValue === "string"
        ? v.optionValue.trim()
        : "";

    if (!value) {
      console.warn(`❌ [VARIANT] empty optionValue at index ${i}:`, v);
      return false;
    }

    return true;
  });

  console.log("✅ [VARIANT] VALID COUNT:", valid.length);
  return valid;
}

/* =========================================================
   NORMALIZE
========================================================= */

function normalizeVariant(v: ProductVariant, index: number) {
  console.log(`🔧 [VARIANT][NORMALIZE] index=${index}`, v);

  const value =
    typeof v.optionValue === "string"
      ? v.optionValue.trim()
      : "";

  if (!value) {
    throw new Error("INVALID_OPTION_VALUE");
  }

  const label =
    typeof v.optionName === "string" && v.optionName.trim()
      ? v.optionName.trim()
      : "option";

  const price =
    typeof v.price === "number" && !isNaN(v.price) && v.price >= 0
      ? v.price
      : 0;

  const salePrice =
    typeof v.salePrice === "number" &&
    !isNaN(v.salePrice) &&
    v.salePrice >= 0
      ? v.salePrice
      : null;

  const finalPrice =
    salePrice !== null && salePrice < price
      ? salePrice
      : price;

  const saleStock =
    typeof v.saleStock === "number" && v.saleStock >= 0
      ? v.saleStock
      : 0;

  const saleSold =
    typeof v.saleSold === "number" && v.saleSold >= 0
      ? v.saleSold
      : 0;

  const saleEnabled =
    typeof v.saleEnabled === "boolean"
      ? v.saleEnabled
      : false;

  const normalized = {
    option_1: value,
    option_label_1: label,
    option_2: null,
    option_label_2: null,
    option_3: null,
    option_label_3: null,
    name: value,

    price,
    sale_price: salePrice,
    final_price: finalPrice,

    stock: v.stock >= 0 ? v.stock : 0,
    is_unlimited: v.isUnlimited ?? false,

    sale_enabled: saleEnabled,
    sale_stock: saleStock,
    sale_sold: saleSold,

    sku: v.sku ?? null,
    image: v.image ?? "",

    sort_order: v.sortOrder ?? index,
    is_active: v.isActive ?? true,
  };

  console.log("✅ [VARIANT][NORMALIZED]:", normalized);

  return normalized;
}

/* =========================================================
   GET VARIANTS
========================================================= */

export async function getVariantsByProductId(productId: string) {
  console.log("🔍 [VARIANT][GET] product:", productId);

  const res = await query(
    `
    SELECT
      id,

      option_1,
      option_2,
      option_3,

      option_label_1,
      option_label_2,
      option_label_3,

      price,
      sale_price,
      final_price,

      stock,
      is_unlimited,

      sale_enabled,
      sale_stock,
      sale_sold,

      sku,
      image,

      sort_order,
      is_active,
      sold

    FROM product_variants
    WHERE product_id = $1
      AND deleted_at IS NULL
    ORDER BY sort_order ASC
    `,
    [productId]
  );

  console.log("📦 [VARIANT][GET] rows:", res.rows.length);

  return res.rows.map((r) => {
    const mapped = {
      id: r.id,

      /* 🔥 OPTION (FULL SUPPORT 3 LEVEL) */
      option1: r.option_1,
      option2: r.option_2,
      option3: r.option_3,

      optionLabel1: r.option_label_1,
      optionLabel2: r.option_label_2,
      optionLabel3: r.option_label_3,

      /* 🔥 BACKWARD COMPAT (cho code cũ) */
      optionName: r.option_label_1,
      optionValue: r.option_1,

      /* 🔥 PRICE */
      price: Number(r.price),
      salePrice:
        r.sale_price !== null ? Number(r.sale_price) : null,
      finalPrice: Number(r.final_price),

      /* 🔥 STOCK */
      stock: r.is_unlimited ? 999999 : r.stock,
      isUnlimited: r.is_unlimited,

      /* 🔥 FLASH SALE */
      saleEnabled: r.sale_enabled,
      saleStock: r.sale_stock,
      saleSold: r.sale_sold,

      /* 🔥 MEDIA */
      sku: r.sku,
      image: r.image,

      /* 🔥 STATUS */
      sortOrder: r.sort_order,
      isActive: r.is_active,

      sold: r.sold ?? 0,
    };

    console.log("🧩 [VARIANT][MAP]:", mapped);
    return mapped;
  });
}
/* =========================================================
   REPLACE VARIANTS
========================================================= */

export async function replaceVariantsByProductId(
  productId: string,
  input: unknown
) {
  console.log("🚀 [VARIANT][REPLACE] product:", productId);

  const valid = validateVariants(input);

  if (valid.length > 100) {
    throw new Error("TOO_MANY_VARIANTS");
  }

  await withTransaction(async (client) => {
    console.log("🧱 [VARIANT] BEGIN TRANSACTION");

    /* DELETE OLD */
    console.log("🗑️ deleting old variants...");
    await client.query(
      `DELETE FROM product_variants WHERE product_id = $1`,
      [productId]
    );

    if (valid.length === 0) {
      console.warn("⚠️ no variants to insert");
      return;
    }

    /* NORMALIZE */
    const normalized = valid.map((v, i) =>
      normalizeVariant(v, i)
    );

    console.log("🧩 normalized count:", normalized.length);

    /* BUILD INSERT */
    const FIELD_COUNT = 20;
    const values: unknown[] = [];
    const placeholders: string[] = [];

    normalized.forEach((v, i) => {
      const idx = i * FIELD_COUNT;

      const row = Array.from(
        { length: FIELD_COUNT },
        (_, k) => `$${idx + k + 1}`
      ).join(",");

      placeholders.push(`(${row})`);

      values.push(
        productId,

        v.option_1,
        v.option_label_1,

        v.option_2,
        v.option_label_2,

        v.option_3,
        v.option_label_3,

        v.name,

        v.price,
        v.sale_price,
        v.final_price,

        v.stock,
        v.is_unlimited,

        v.sale_enabled,
        v.sale_stock,
        v.sale_sold,

        v.sku,
        v.image,

        v.sort_order,
        v.is_active
      );
    });

    console.log("📦 inserting variants...");
    console.log("PLACEHOLDERS:", placeholders.length);
    console.log("VALUES LENGTH:", values.length);

    try {
      await client.query(
        `
        INSERT INTO product_variants
        (
          product_id,
          option_1,
          option_label_1,

          option_2,
          option_label_2,

          option_3,
          option_label_3,

          name,

          price,
          sale_price,
          final_price,

          stock,
          is_unlimited,

          sale_enabled,
          sale_stock,
          sale_sold,

          sku,
          image,

          sort_order,
          is_active
        )
        VALUES ${placeholders.join(",")}
        `,
        values
      );

      console.log("✅ INSERT SUCCESS");
    } catch (err) {
      console.error("❌ INSERT ERROR");
      console.error("VALUES:", values);
      console.error("ERROR:", err);
      throw err;
    }
  });
}

/* =========================================================
   DECREASE STOCK
========================================================= */

export async function decreaseVariantStock(
  variantId: string,
  quantity: number
) {
  console.log("📉 [VARIANT][DECREASE]", {
    variantId,
    quantity,
  });

  return withTransaction(async (client) => {
    const res = await client.query(
      `
      SELECT
        stock,
        is_unlimited,
        sale_enabled,
        sale_stock,
        sale_sold
      FROM product_variants
      WHERE id = $1
      FOR UPDATE
      `,
      [variantId]
    );

    if (!res.rows.length) {
      console.error("❌ VARIANT NOT FOUND:", variantId);
      throw new Error("VARIANT_NOT_FOUND");
    }

    const v = res.rows[0];

    console.log("🔒 LOCKED VARIANT:", v);

    if (!v.is_unlimited && v.stock < quantity) {
      console.error("❌ OUT OF STOCK");
      throw new Error("OUT_OF_STOCK");
    }

    if (v.sale_enabled) {
      const left =
        (v.sale_stock ?? 0) - (v.sale_sold ?? 0);

      console.log("🔥 FLASH LEFT:", left);

      if (left < quantity) {
        console.error("❌ FLASH SALE SOLD OUT");
        throw new Error("FLASH_SALE_SOLD_OUT");
      }
    }

    await client.query(
      `
      UPDATE product_variants
      SET
        stock = CASE
          WHEN is_unlimited THEN stock
          ELSE stock - $2
        END,
        sale_sold = CASE
          WHEN sale_enabled THEN sale_sold + $2
          ELSE sale_sold
        END,
        updated_at = NOW()
      WHERE id = $1
      `,
      [variantId, quantity]
    );

    console.log("✅ STOCK UPDATED");

    return { success: true };
  });
}
