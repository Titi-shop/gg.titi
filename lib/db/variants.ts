
import { query, withTransaction } from "@/lib/db";

/* =========================================================
   DB TYPE (1:1 WITH TABLE)
========================================================= */

export type ProductVariantDB = {
  id?: string;

  product_id: string;

  /* ================= OPTIONS ================= */
  option_1: string | null;
  option_2: string | null;
  option_3: string | null;

  option_label_1: string | null;
  option_label_2: string | null;
  option_label_3: string | null;

  name: string;

  /* ================= SKU ================= */
  sku: string | null;

  /* ================= PRICE ================= */
  price: number;
  sale_price: number | null;
  final_price: number;
  sale_enabled: boolean;
  sale_stock: number;
  sale_sold: number;
  currency: string;

  /* ================= STOCK ================= */
  stock: number;
  is_unlimited: boolean;

  /* ================= MEDIA ================= */
  image: string;

  /* ================= STATUS ================= */
  is_active: boolean;

  /* ================= SORT ================= */
  sort_order: number;

  /* ================= ANALYTICS ================= */
  sold: number;

  /* ================= TIME ================= */
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

/* =========================================================
   APP TYPE (FRONTEND FRIENDLY)
========================================================= */

export type ProductVariant = {
  id?: string;

  option1: string;
  option2: string | null;
  option3: string | null;

  optionLabel1: string | null;
  optionLabel2: string | null;
  optionLabel3: string | null;

  name: string;

  sku: string | null;

  price: number;
  salePrice: number | null;
  finalPrice: number;

  saleEnabled: boolean;
  saleStock: number;
  saleSold: number;

  stock: number;
  isUnlimited: boolean;

  image: string;

  isActive: boolean;
  sortOrder: number;

  sold: number;
};

/* =========================================================
   MAP: DB → APP
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
   MAP: APP → DB
========================================================= */

export function mapVariantToDB(v: ProductVariant): ProductVariantDB {
  return {
    id: v.id,

    product_id: "",

    option_1: v.option_1,
    option_2: v.option_2,
    option_3: v.option_3,

    option_label_1: v.option_label_1,
    option_label_2: v.option_label_2,
    option_label_3: v.option_label_3,

    name: v.name,

    sku: v.sku,

    price: v.price,
    sale_price: v.sale_price,
    final_price: v.final_price,

    sale_enabled: v.sale_enabled,
    sale_stock: v.sale_stock,
    sale_sold: v.sale_sold,

    stock: v.stock,
    is_unlimited: v.is_unlimited,

    image: v.image,

    is_active: v.is_active,
    sort_order: v.sort_order,

    sold: v.sold,

    currency: "PI",
  };
}
/* =========================================================
   GET VARIANTS
========================================================= */

export async function getVariantsByProductId(
  productId: string
): Promise<ProductVariant[]> {
  const res = await query(
    `
    SELECT *
    FROM product_variants
    WHERE product_id = $1
      AND deleted_at IS NULL
    ORDER BY sort_order ASC
    `,
    [productId]
  );

  return res.rows.map(mapVariantToApp);
}

/* =========================================================
   REPLACE VARIANTS
========================================================= */

export async function replaceVariantsByProductId(
  productId: string,
  input: ProductVariant[]
) {
  return withTransaction(async (client) => {
    /* DELETE OLD */
    await client.query(
      `DELETE FROM product_variants WHERE product_id = $1`,
      [productId]
    );

    if (!input.length) return;

    /* INSERT NEW */
    const FIELD_COUNT = 21;
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
        db.option_label_1,

        db.option_2,
        db.option_label_2,

        db.option_3,
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

        db.sold
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

        sold
      )
      VALUES ${placeholders.join(",")}
      `,
      values
    );
  });
}

/* =========================================================
   DECREASE STOCK
========================================================= */

export async function decreaseVariantStock(
  variantId: string,
  quantity: number
) {
  return withTransaction(async (client) => {
    const res = await client.query(
      `
      SELECT stock, is_unlimited, sale_enabled, sale_stock, sale_sold
      FROM product_variants
      WHERE id = $1
      FOR UPDATE
      `,
      [variantId]
    );

    if (!res.rows.length) throw new Error("VARIANT_NOT_FOUND");

    const v = res.rows[0];

    if (!v.is_unlimited && v.stock < quantity) {
      throw new Error("OUT_OF_STOCK");
    }

    if (v.sale_enabled) {
      const left = v.sale_stock - v.sale_sold;
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
        updated_at = NOW()
      WHERE id = $1
      `,
      [variantId, quantity]
    );

    return { success: true };
  });
}
