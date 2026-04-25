
import { query, withTransaction } from "@/lib/db";

/* =========================================================
   DB TYPE (TABLE product_variants)
========================================================= */

export type ProductVariantDB = {
  id?: string;

  product_id: string;

  option_1: string | null;
  option_2: string | null;
  option_3: string | null;

  option_label_1: string | null;
  option_label_2: string | null;
  option_label_3: string | null;

  name: string;

  sku: string | null;

  price: number;
  sale_price: number | null;
  final_price: number;

  sale_enabled: boolean;
  sale_stock: number;
  sale_sold: number;

  stock: number;
  is_unlimited: boolean;

  image: string;

  is_active: boolean;
  sort_order: number;

  sold: number;

  currency: string;

  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

/* =========================================================
   APP TYPE (USED EVERYWHERE)
========================================================= */

export type ProductVariant = {
  id?: string;

  option1?: string;
  option2?: string | null;
  option3?: string | null;

  optionLabel1?: string | null;
  optionLabel2?: string | null;
  optionLabel3?: string | null;

  name?: string;

  sku?: string | null;

  price?: number;
  salePrice?: number | null;
  finalPrice?: number;

  saleEnabled?: boolean;
  saleStock?: number;
  saleSold?: number;

  stock: number;
  isUnlimited?: boolean;

  image?: string;

  isActive?: boolean;
  sortOrder?: number;

  sold?: number;
};

/* =========================================================
   CALCULATE FINAL PRICE
========================================================= */

function calcFinalPrice(v: ProductVariant) {
  const price = Number(v.price || 0);
  const salePrice = v.salePrice != null ? Number(v.salePrice) : null;

  if (
    v.saleEnabled &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price
  ) {
    return salePrice;
  }

  return price;
}

/* =========================================================
   BUILD VARIANT NAME
========================================================= */

function buildVariantName(v: ProductVariant) {
  return [v.option1, v.option2, v.option3]
    .filter(Boolean)
    .join(" - ");
}

/* =========================================================
   MAP DB -> APP
========================================================= */

export function mapVariantToApp(v: ProductVariantDB): ProductVariant {
  return {
    id: v.id,

    option1: v.option_1 ?? "",
    option2: v.option_2 ?? null,
    option3: v.option_3 ?? null,

    optionLabel1: v.option_label_1 ?? null,
    optionLabel2: v.option_label_2 ?? null,
    optionLabel3: v.option_label_3 ?? null,

    name: v.name,

    sku: v.sku ?? null,

    price: Number(v.price ?? 0),
    salePrice: v.sale_price !== null ? Number(v.sale_price) : null,
    finalPrice: Number(v.final_price ?? v.price ?? 0),

    saleEnabled: Boolean(v.sale_enabled),
    saleStock: Number(v.sale_stock ?? 0),
    saleSold: Number(v.sale_sold ?? 0),

    stock: Number(v.stock ?? 0),
    isUnlimited: Boolean(v.is_unlimited),

    image: v.image ?? "",

    isActive: Boolean(v.is_active),
    sortOrder: Number(v.sort_order ?? 0),

    sold: Number(v.sold ?? 0),
  };
}

/* =========================================================
   MAP APP -> DB
========================================================= */

export function mapVariantToDB(
  v: ProductVariant,
  productId: string,
  sortOrder: number
): ProductVariantDB {
  const safePrice = Number(v.price || 0);
  const safeSalePrice =
    v.salePrice !== null && v.salePrice !== undefined
      ? Number(v.salePrice)
      : null;

  const safeStock = Number(v.stock || 0);
  const safeSaleStock = Number(v.saleStock || 0);

  return {
    id: v.id,

    product_id: productId,

    option_1: v.option1 || null,
    option_2: v.option2 || null,
    option_3: v.option3 || null,

    option_label_1: v.optionLabel1 || null,
    option_label_2: v.optionLabel2 || null,
    option_label_3: v.optionLabel3 || null,

    name: v.name || buildVariantName(v),

    sku: v.sku || null,

    price: safePrice,
    sale_price: safeSalePrice,
    final_price: calcFinalPrice({
      ...v,
      price: safePrice,
      salePrice: safeSalePrice,
    }),

    sale_enabled: Boolean(v.saleEnabled),
    sale_stock: safeSaleStock,
    sale_sold: Number(v.saleSold || 0),

    stock: safeStock,
    is_unlimited: Boolean(v.isUnlimited),

    image: v.image || "",

    is_active: v.isActive !== false,
    sort_order: sortOrder,

    sold: Number(v.sold || 0),

    currency: "PI",
  };
}

/* =========================================================
   GET VARIANTS BY PRODUCT
========================================================= */

export async function getVariantsByProductId(
  productId: string
): Promise<ProductVariant[]> {
  console.log("🔍 [DB][VARIANTS][GET] PRODUCT:", productId);

  const res = await query(
    `
    SELECT *
    FROM product_variants
    WHERE product_id = $1
      AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
    `,
    [productId]
  );

  console.log("📦 [DB][VARIANTS][RAW ROW COUNT]:", res.rows.length);

  res.rows.forEach((row: any, i: number) => {
    console.log(`📄 [DB][VARIANT RAW ${i}]`, {
      id: row.id,

      option_1: row.option_1,
      option_2: row.option_2,
      option_3: row.option_3,

      option_label_1: row.option_label_1,
      option_label_2: row.option_label_2,
      option_label_3: row.option_label_3,

      price: row.price,
      sale_price: row.sale_price,
      final_price: row.final_price,

      sale_enabled: row.sale_enabled,
      sale_stock: row.sale_stock,
      sale_sold: row.sale_sold,

      stock: row.stock,
      is_unlimited: row.is_unlimited,
    });
  });

  const mapped = res.rows.map(mapVariantToApp);

  mapped.forEach((row, i) => {
    console.log(`🧠 [DB][VARIANT APP ${i}]`, row);
  });

  return mapped;
}

/* =========================================================
   REPLACE ALL VARIANTS
========================================================= */

export async function replaceVariantsByProductId(
  productId: string,
  input: ProductVariant[]
) {
  return withTransaction(async (client) => {
    await client.query(
      `DELETE FROM product_variants WHERE product_id = $1`,
      [productId]
    );

    if (!input.length) return;

    const FIELD_COUNT = 22;
    const values: any[] = [];
    const placeholders: string[] = [];

    input.forEach((v, i) => {
      const db = mapVariantToDB(v, productId, i);

      const row = Array.from(
        { length: FIELD_COUNT },
        (_, k) => `$${i * FIELD_COUNT + k + 1}`
      ).join(",");

      placeholders.push(`(${row})`);

      values.push(
        db.product_id,

        db.option_1,
        db.option_2,
        db.option_3,

        db.option_label_1,
        db.option_label_2,
        db.option_label_3,

        db.name,

        db.sku,

        db.price,
        db.sale_price,
        db.final_price,

        db.sale_enabled,
        db.sale_stock,
        db.sale_sold,

        db.stock,
        db.is_unlimited,

        db.image,

        db.is_active,
        db.sort_order,

        db.sold,
        db.currency
      );
    });

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

        stock,
        is_unlimited,

        image,

        is_active,
        sort_order,

        sold,
        currency
      )
      VALUES ${placeholders.join(",")}
      `,
      values
    );
  });
}

/* =========================================================
   DECREASE STOCK WHEN ORDER SUCCESS
========================================================= */

export async function decreaseVariantStock(
  variantId: string,
  quantity: number
) {
  return withTransaction(async (client) => {
    const res = await client.query(
      `
      SELECT *
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

    if (!v.is_unlimited && Number(v.stock) < quantity) {
      throw new Error("OUT_OF_STOCK");
    }

    if (v.sale_enabled) {
      const left = Number(v.sale_stock) - Number(v.sale_sold);
      if (left < quantity) {
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

        sold = sold + $2,
        updated_at = NOW()
      WHERE id = $1
      `,
      [variantId, quantity]
    );

    return { success: true };
  });
}
