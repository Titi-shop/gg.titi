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
      : "option";

  const price =
    typeof v.price === "number" && v.price >= 0
      ? v.price
      : 0;

  const salePrice =
    typeof v.salePrice === "number" && v.salePrice >= 0
      ? v.salePrice
      : null;

  /* ✅ FINAL PRICE (QUAN TRỌNG) */
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
  /* 🔥 FLASH SALE */
  sale_stock: saleStock,
  sale_sold: saleSold,
  sale_enabled: saleEnabled,

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
  sold,
  sale_enabled,
  sale_stock,
  sale_sold
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

    sku: r.sku,
    image: r.image,
    sortOrder: r.sort_order,
    isActive: r.is_active,
   saleStock: r.sale_stock,
    saleSold: r.sale_sold,
    saleEnabled: r.sale_enabled,
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
  console.log("🚀 [VARIANT][REPLACE] product:", productId);

  const valid = validateVariants(input);

  if (valid.length > 100) {
    throw new Error("TOO_MANY_VARIANTS");
  }

  await withTransaction(async (client) => {
    /* ================= DELETE OLD ================= */
    console.log("🗑️ [VARIANT] delete old");

    await client.query(
      `DELETE FROM product_variants WHERE product_id = $1`,
      [productId]
    );

    if (valid.length === 0) {
      console.log("⚠️ [VARIANT] no variants to insert");
      return;
    }

    /* ================= NORMALIZE ================= */
    const normalized = valid.map(normalizeVariant);

    console.log("🧩 [VARIANT] normalized:", normalized);

    /* ================= BUILD INSERT ================= */
    const values: unknown[] = [];
    const placeholders: string[] = [];

    normalized.forEach((v, i) => {
      const idx = i * 20;

      placeholders.push(
  `($${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8},$${idx + 9},$${idx + 10},$${idx + 11},$${idx + 12},$${idx + 13},$${idx + 14},$${idx + 15},$${idx + 16},$${idx + 17},$${idx + 18},$${idx + 19},$${idx + 20})`
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

  /* 🔥 FIX ORDER */
  v.sale_enabled,
  v.sale_stock,
  v.sale_sold,

  v.sku,
  v.image,

  v.sort_order,
  v.is_active
);
    });

    /* ================= INSERT ================= */
    console.log("📦 [VARIANT] inserting:", normalized.length);

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

  /* 🔥 FLASH SALE */
  sale_enabled,
  sale_stock,
  sale_sold,

  sku,
  image,

  sort_order,
  is_active
)
VALUES  ${placeholders.join(",")}
      `,
      values
    );

    console.log("✅ [VARIANT] inserted success");
  });
}
