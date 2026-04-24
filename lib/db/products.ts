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
  category_id: number | null;
  seller_id: string;
  views?: number | null;
  sold?: number | null;
   final_price?: number | null;
  rating_avg?: number | null;
  rating_count?: number | null;
  status?: ProductStatus | null;
  is_featured?: boolean | null;
  is_digital?: boolean | null;
  sale_start: string | null;
  sale_end: string | null;
   sale_stock?: number | null;
  sale_sold?: number | null;
  sale_enabled?: boolean | null;
  meta_title?: string | null;
  meta_description?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
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
  category_id: number | null;
  price: number;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;
  stock: number;
  is_active: boolean;
  views?: number;
  sold?: number;
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
  >
>;

/* =========================================================
   HELPERS
========================================================= */

function toAppProduct(row: ProductRow): ProductRecord {
  return {
    ...row,

    price:
      typeof row.price === "number"
        ? row.price
        : Number(row.price) || 0,

    sale_price:
      row.sale_price !== null &&
      row.sale_price !== undefined
        ? Number(row.sale_price)
        : null,

    final_price:
      row.final_price !== null &&
      row.final_price !== undefined
        ? Number(row.final_price)
        : Number(row.price) || 0,

    images: Array.isArray(row.images) ? row.images : [],
    sale_stock: row.sale_stock ?? 0,
    sale_sold: row.sale_sold ?? 0,
    sale_enabled: row.sale_enabled ?? false,
  };
}
/* =========================================================
   GET — ALL PRODUCTS
========================================================= */
export async function getAllProducts(limit = 20): Promise<ProductRecord[]> {
  const { rows } = await query<ProductRecord>(
    `
    SELECT 
  id,
  name,
  slug,
  short_description,
  description,
  detail,
  thumbnail,
  images,
  detail_images,
  video_url,
  price,
  sale_price,
  final_price,
  currency,
  stock,
  is_unlimited,
  sold,
  views,
  rating_avg,
  rating_count,
  is_active,
  is_featured,
  is_digital,
  status,
  category_id,
  sale_start,
  sale_end,
  
  sale_stock,
  sale_sold,
  sale_enabled,

  meta_title,
  meta_description,
  created_at,
  updated_at,
  deleted_at,
  seller_id
FROM products
    WHERE is_active = true
  AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit]
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
  SELECT 
    p.*,

    /* ✅ MIN VARIANT PRICE (đúng chuẩn ecommerce) */
    (
      SELECT MIN(
        CASE
          WHEN v.sale_price > 0 
            AND NOW() BETWEEN p.sale_start AND p.sale_end
          THEN v.sale_price
          ELSE v.price
        END
      )
      FROM product_variants v
      WHERE v.product_id = p.id
        AND v.is_active = TRUE
   ) AS min_variant_price,

    /* ✅ SALE PRICE (optional) */
    CASE
      WHEN p.sale_price > 0 
        AND NOW() BETWEEN p.sale_start AND p.sale_end
      THEN p.sale_price
      ELSE p.price
    END AS sale_price

  FROM products p
  WHERE p.seller_id = $1
    AND p.deleted_at IS NULL

  ORDER BY p.created_at DESC
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
    AND is_active = true
    `,
    [ids]
  );

  return rows.map(toAppProduct);
}

/* =========================================================
   GET — BY ID
========================================================= */

function isUUID(str: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(str);
}

export async function getProductById(
  id: string
): Promise<ProductRecord | null> {
  console.log("[DB][PRODUCT][GET_BY_ID] start", { id });

  if (!id || typeof id !== "string") {
    console.warn("[DB][PRODUCT][GET_BY_ID] invalid id type");
    return null;
  }

  // ✅ FIX QUAN TRỌNG
  if (!isUUID(id)) {
    console.warn("[DB][PRODUCT][GET_BY_ID] invalid UUID:", id);
    return null;
  }

  try {
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

    if (!rows.length) {
      console.log("[DB][PRODUCT][GET_BY_ID] not found");
      return null;
    }

    console.log("[DB][PRODUCT][GET_BY_ID] found");

    return toAppProduct(rows[0]);
  } catch (err) {
    console.error("[DB][PRODUCT][GET_BY_ID] ERROR:", err);
    return null;
  }
}

/* =========================================================
   CREATE
========================================================= */

export async function createProduct(
  sellerId: string,
  product: CreateProductInput
): Promise<ProductRecord> {

  /* ================= CALC ================= */

  const slug = product.name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");

  const finalPrice =
    product.sale_price !== null &&
    product.sale_price < product.price
      ? product.sale_price
      : product.price;

  /* ================= INSERT ================= */

  const { rows } = await query(
    `
    INSERT INTO products (
      name,
      slug,
      description,
      detail,
      images,
      thumbnail,
      category_id,

      price,
      sale_price,
      final_price,

      sale_start,
      sale_end,

      sale_stock,
      sale_sold,
      sale_enabled,

      stock,
      is_active,

      views,
      sold,

      seller_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,
      $8,$9,$10,
      $11,$12,
      $13,$14,$15,
      $16,$17,
      $18,$19,
      $20
    )
    RETURNING *
    `,
    [
      product.name.trim(),
      slug,
      product.description ?? "",
      product.detail ?? "",
      product.images ?? [],
      product.thumbnail ?? "",
      product.category_id ? Number(product.category_id) : null,

      product.price,
      product.sale_price,
      finalPrice,

      product.sale_start,
      product.sale_end,
      product.sale_stock ?? 0,
      0,
      product.sale_enabled ?? false,
      product.stock,
      product.is_active,
      product.views ?? 0,
      product.sold ?? 0,
      sellerId,
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
): Promise<ProductRecord | null> {
  console.log("[DB][PRODUCT][UPDATE] start", {
    sellerId,
    productId,
    data,
  });

  if (!sellerId || !productId) {
    console.warn("[DB][PRODUCT][UPDATE] invalid ids");
    return null;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

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

  "sale_stock",
  "sale_sold",
  "sale_enabled",
] as const;

  for (const key of allowedFields) {
    const value = data[key];

    if (value === undefined) continue;

    /* ================= VALIDATE ================= */

    if (key === "price") {
      if (typeof value !== "number" || Number.isNaN(value)) {
        console.warn("[DB][UPDATE] invalid price");
        continue;
      }
    }

    if (key === "sale_price") {
      if (
        value !== null &&
        (typeof value !== "number" || Number.isNaN(value))
      ) {
        console.warn("[DB][UPDATE] invalid sale_price");
        continue;
      }
    }

    if (key === "stock") {
      if (typeof value !== "number" || value < 0) {
        console.warn("[DB][UPDATE] invalid stock");
        continue;
      }
    }

    fields.push(`${key} = $${idx++}`);
    values.push(value);
  }

  if (!fields.length) {
    console.warn("[DB][UPDATE] no fields");
    return null;
  }

  try {
    const { rows } = await query<ProductRow>(
      `
      UPDATE products
      SET ${fields.join(", ")},
          updated_at = NOW()
      WHERE id = $${idx}
        AND seller_id = $${idx + 1}
      RETURNING *
      `,
      [...values, productId, sellerId]
    );

    if (!rows.length) {
      console.warn("[DB][UPDATE] not found");
      return null;
    }

    console.log("[DB][UPDATE] success");

    return toAppProduct(rows[0]);

  } catch (err) {
    console.error("[DB][UPDATE] ERROR:", err);
    return null;
  }
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

export type SellerProductRecord = {
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
): Promise<SellerProductRecord[]> {
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

export async function deleteProductById(
  productId: string,
  userId: string
): Promise<{
  ok: boolean;
  paths: string[];
  error?: string;
}> {
  try {
    const res = await query(
      `
      SELECT images, seller_id
      FROM products
      WHERE id = $1
      `,
      [productId]
    );

    if (res.rowCount === 0) {
      return { ok: false, paths: [], error: "NOT_FOUND" };
    }

    const product = res.rows[0];

    if (product.seller_id !== userId) {
      return { ok: false, paths: [], error: "FORBIDDEN" };
    }

    /* ================= EXTRACT PATH ================= */
    const paths: string[] = [];

    if (Array.isArray(product.images)) {
      for (const url of product.images) {
        if (typeof url !== "string") continue;

        const match = url.split("/storage/v1/object/public/products/")[1];
        if (match) paths.push(match);
      }
    }

    /* ================= DELETE ================= */
    await query(
  `
  UPDATE products
  SET deleted_at = NOW()
  WHERE id = $1
  `,
  [productId]
);

    return { ok: true, paths };

  } catch (err) {
    console.error("[DB][DELETE PRODUCT]:", err);

    return { ok: false, paths: [], error: "DB_ERROR" };
  }
}
