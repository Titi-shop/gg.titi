import { query, withTransaction } from "@/lib/db";

/* =========================================================
   TYPES (MATCH DB)
========================================================= */

export type ProductVariant = {
  id?: string;
  optionName?: string;
  optionValue: string;
  price?: number;
  salePrice?: number | null;
  stock: number;
  isUnlimited?: boolean;
  /* 🔥 FLASH SALE */
  saleStock?: number;
  saleSold?: number;
  saleEnabled?: boolean;
  sku?: string | null;
  image?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

/* =========================================================
   VALIDATE
========================================================= */

function validateVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) {
    console.warn("⚠️ [VARIANT] input is not array");
    return [];
  }

  const valid = input.filter((v): v is ProductVariant => {
    if (typeof v !== "object" || v === null) {
      console.warn("❌ [VARIANT] invalid object:", v);
      return false;
    }

    const value =
      typeof v.optionValue === "string"
        ? v.optionValue.trim()
        : "";

    if (!value) {
      console.warn("❌ [VARIANT] empty optionValue:", v);
      return false;
    }

    return true;
  });

  console.log("🧩 [VARIANT] VALID COUNT:", valid.length);

  return valid;
}

/* =========================================================
   NORMALIZE (MATCH DB)
========================================================= */

function normalizeVariant(v: ProductVariant, index: number) {
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
      : "Option";

  const price =
    typeof v.price === "number" && v.price >= 0
      ? v.price
      : 0;

  const salePrice =
    typeof v.salePrice === "number" && v.salePrice >= 0
      ? v.salePrice
      : null;

  /* ❗ FIX: VALIDATE SALE */
  if (salePrice !== null && salePrice >= price) {
    throw new Error("INVALID_VARIANT_SALE_PRICE");
  }

  const finalPrice =
    salePrice !== null ? salePrice : price;

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

  return {
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
      option_label_1,
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

  return res.rows.map((r) => ({
    id: r.id,
    optionName: r.option_label_1,
    optionValue: r.option_1,

    price: Number(r.price),
    salePrice:
      r.sale_price !== null ? Number(r.sale_price) : null,
    finalPrice: Number(r.final_price),
    stock: r.is_unlimited ? 999999 : r.stock,
    isUnlimited: r.is_unlimited,

    saleEnabled: r.sale_enabled,
    saleStock: r.sale_stock ?? 0,
    saleSold: r.sale_sold ?? 0,
    sku: r.sku,
    image: r.image,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    sold: r.sold ?? 0,
  }));
}

/* =========================================================
   REPLACE VARIANTS (ATOMIC)
========================================================= */

export async function replaceVariantsByProductId(
  productId: string,
  input: unknown
) {
  const valid = validateVariants(input);

  if (valid.length > 100) {
    throw new Error("TOO_MANY_VARIANTS");
  }

  await withTransaction(async (client) => {
    /* DELETE OLD */
    await client.query(
      `DELETE FROM product_variants WHERE product_id = $1`,
      [productId]
    );

    if (!valid.length) return;

    const normalized = valid.map(normalizeVariant);

    const values: any[] = [];
    const placeholders: string[] = [];

    normalized.forEach((v, i) => {
      const base = i * 20;

      placeholders.push(
        `(
          $${base + 1},  $${base + 2},  $${base + 3},
          $${base + 4},  $${base + 5},
          $${base + 6},  $${base + 7},
          $${base + 8},
          $${base + 9},  $${base + 10}, $${base + 11},
          $${base + 12}, $${base + 13},
          $${base + 14}, $${base + 15}, $${base + 16},
          $${base + 17}, $${base + 18},
          $${base + 19}, $${base + 20}
        )`
      );

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

    await client.query(
      `
      INSERT INTO product_variants (
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
  
    console.log("✅ [VARIANT] inserted success");
  });
}

export async function decreaseVariantStock(
  variantId: string,
  quantity: number
) {
  return withTransaction(async (client) => {
    /* 🔒 LOCK ROW */
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
      throw new Error("VARIANT_NOT_FOUND");
    }

    const v = res.rows[0];

    /* ================= NORMAL STOCK ================= */
    if (!v.is_unlimited) {
      if (v.stock < quantity) {
        throw new Error("OUT_OF_STOCK");
      }
    }

    /* ================= FLASH SALE ================= */
    if (v.sale_enabled) {
      const left = (v.sale_stock ?? 0) - (v.sale_sold ?? 0);

      if (left < quantity) {
        throw new Error("FLASH_SALE_SOLD_OUT");
      }
    }

    /* ================= UPDATE ================= */

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

    return { success: true };
  });
}
