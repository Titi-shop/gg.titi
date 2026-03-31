import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type ProductStatus =
  | "draft"
  | "active"
  | "inactive"
  | "archived"
  | "banned";

type ProductRow = {
  id: string;
  name: string;
  slug?: string | null;
  short_description?: string | null;
  description: string;
  detail: string;
  thumbnail: string | null;
  images: string[];
  detail_images?: string[] | null;
  video_url?: string | null;
  price: number;
  sale_price: number | null;
  currency?: string | null;
  stock: number;
  is_unlimited?: boolean | null;
  is_active?: boolean | null;
  category_id: string | null;
  seller_id: string;
  views?: number | null;
  sold?: number | null;
  rating_avg?: number | null;
  rating_count?: number | null;
  status?: ProductStatus | null;
  is_featured?: boolean | null;
  is_digital?: boolean | null;
  sale_start: string | null;
  sale_end: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string | null;
};

export type ProductRecord = Omit<ProductRow, "price" | "sale_price"> & {
  price: number;
  sale_price: number | null;
};

export type CreateProductInput = {
  name: string;
  description: string;
  detail: string;
  images: string[];
  thumbnail: string | null;
  category_id: string | null;
  price: number;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;
  stock: number;
  is_active: boolean;
  views?: number;
  sold?: number;
domestic_shipping_fee: number | null;
asia_shipping_fee: number | null;
international_shipping_fee: number | null;
};

export type UpdateProductInput = Partial<
  Pick<
    ProductRecord,
    | "name"
    | "description"
    | "detail"
    | "images"
    | "thumbnail"
    | "category_id"
    | "price"
    | "sale_price"
    | "sale_start"
    | "sale_end"
    | "stock"
    | "is_active"
    | "status"
   | "domestic_shipping_fee"
   | "asia_shipping_fee"
 | "international_shipping_fee"
  >
>;

/* =========================================================
   HELPERS
========================================================= */

function toAppProduct(row: ProductRow): ProductRecord {
  return {
    ...row,
    price: Number(row.price),
    sale_price: row.sale_price !== null ? Number(row.sale_price) : null,
  };
}

/* =========================================================
   GET — ALL PRODUCTS
========================================================= */

export async function getAllProducts(): Promise<ProductRecord[]> {
  const { rows } = await query(
    `
    SELECT *
    FROM products
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    `
  );

  return rows.map(toAppProduct);
}

/* =========================================================
   GET — SELLER PRODUCTS
========================================================= */

export async function getSellerProducts(
  sellerId: string
): Promise<ProductRecord[]> {
  const { rows } = await query(
    `
    SELECT *
    FROM products
    WHERE seller_id = $1
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    `,
    [sellerId]
  );

  return rows.map(toAppProduct);
}

/* =========================================================
   GET — BY IDS
========================================================= */

export async function getProductsByIds(
  ids: string[]
): Promise<ProductRecord[]> {
  if (!ids.length) return [];

  const { rows } = await query(
    `
    SELECT *
    FROM products
    WHERE id = ANY($1::uuid[])
      AND deleted_at IS NULL
    `,
    [ids]
  );

  return rows.map(toAppProduct);
}

/* =========================================================
   GET — BY ID
========================================================= */

export async function getProductById(
  id: string
): Promise<ProductRecord | null> {
  const { rows } = await query(
    `
    SELECT *
    FROM products
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [id]
  );

  if (!rows.length) return null;

  return toAppProduct(rows[0]);
}

/* =========================================================
   CREATE
========================================================= */

export async function createProduct(
  sellerId: string,
  product: CreateProductInput
): Promise<ProductRecord> {
  const { rows } = await query(
    `
    INSERT INTO products (
      name,
      description,
      detail,
      images,
      thumbnail,
      category_id,
      price,
      sale_price,
      sale_start,
      sale_end,
      stock,
      is_active,
      views,
      sold,
      seller_id,
      domestic_shipping_fee,
     asia_shipping_fee,
     international_shipping_fee
    )
   VALUES (
  $1,$2,$3,$4,$5,$6,
  $7,$8,$9,$10,$11,$12,$13,$14,$15,
  $16,$17,$18
)
    RETURNING *
    `,
    [
      product.name.trim(),
      product.description ?? "",
      product.detail ?? "",
      product.images,
      product.thumbnail,
      product.category_id,
      product.price,
      product.sale_price,
      product.sale_start,
      product.sale_end,
      product.stock,
      product.is_active,
      product.views ?? 0,
      product.sold ?? 0,
      sellerId,
     product.domestic_shipping_fee,
    product.asia_shipping_fee,
     product.international_shipping_fee,
    ]
  );

  if (!rows.length) {
    throw new Error("FAILED_TO_CREATE_PRODUCT");
  }

  return toAppProduct(rows[0]);
}

/* =========================================================
   UPDATE
========================================================= */

export async function updateProductBySeller(
  sellerId: string,
  productId: string,
  data: UpdateProductInput
): Promise<boolean> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  /* ================= WHITELIST ================= */

  const allowedFields = [
    "name",
    "description",
    "detail",
    "images",
    "thumbnail",
    "category_id",
    "price",
    "sale_price",
    "sale_start",
    "sale_end",
    "stock",
    "is_active",
    "status",

    // 🔥 shipping
    "domestic_shipping_fee",
    "asia_shipping_fee",
    "international_shipping_fee",
  ] as const;

  /* ================= BUILD QUERY ================= */

  for (const key of allowedFields) {
    const value = data[key];

    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }
  }

  if (!fields.length) return false;

  const { rowCount } = await query(
    `
    UPDATE products
    SET ${fields.join(", ")},
        updated_at = NOW()
    WHERE id = $${idx}
      AND seller_id = $${idx + 1}
    `,
    [...values, productId, sellerId]
  );

  return (rowCount ?? 0) > 0;
}
/* =========================================================
   SOFT DELETE
========================================================= */

export async function deleteProductBySeller(
  sellerId: string,
  productId: string
): Promise<boolean> {
  const { rowCount } = await query(
    `
    UPDATE products
    SET deleted_at = NOW()
    WHERE id = $1
      AND seller_id = $2
    `,
    [productId, sellerId]
  );

  return (rowCount ?? 0) > 0;
}

/* =========================================================
   SOLD COUNT
========================================================= */

export async function getSoldByProduct(
  productId: string
): Promise<number> {
  const { rows } = await query(
    `
    SELECT COALESCE(SUM(oi.quantity), 0)::int AS sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id = $1
      AND o.status != 'cancelled'
    `,
    [productId]
  );

  return rows[0]?.sold ?? 0;
}

/* =========================================================
   INCREMENT VIEW
========================================================= */

export async function incrementProductView(
  productId: string
): Promise<number> {
  const { rows } = await query(
    `
    UPDATE products
    SET views = COALESCE(views, 0) + 1
    WHERE id = $1
    RETURNING views
    `,
    [productId]
  );

  return rows[0]?.views ?? 0;
}

/* =========================================================
   GET — PRODUCTS BY SELLER
========================================================= */

export type ProductRecord = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  thumbnail: string | null;
  stock: number;
  is_active: boolean;
  created_at: string;
};

export async function getProductsBySeller(
  userId: string
): Promise<ProductRecord[]> {
  if (!userId) {
    throw new Error("INVALID_USER_ID");
  }

  const { rows } = await query<ProductRecord>(
    `
    SELECT
      id,
      name,
      price,
      sale_price,
      thumbnail,
      stock,
      is_active,
      created_at
    FROM products
    WHERE seller_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return rows;
}
