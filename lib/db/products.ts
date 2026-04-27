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
  seller_id: string;

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
  final_price?: number | null;

  currency?: string | null;

  stock: number;
  is_unlimited?: boolean | null;

  sold?: number | null;
  views?: number | null;

  rating_avg?: number | null;
  rating_count?: number | null;

  is_active?: boolean | null;
  is_featured?: boolean | null;
  is_digital?: boolean | null;

  status?: ProductStatus | null;

  category_id: number | null;

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

  sale_stock?: number;
  sale_enabled?: boolean;

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
    | "sale_stock"
    | "sale_sold"
    | "sale_enabled"
    | "stock"
    | "is_active"
    | "status"
  >
>;

/* =========================================================
   HELPERS
========================================================= */

function isUUID(str: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(str);
}

function isInSaleTime(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;

  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();

  return now >= s && now <= e;
}

function toAppProduct(row: ProductRow): ProductRecord {
  const price = Number(row.price ?? 0);
  const salePrice =
    row.sale_price !== null ? Number(row.sale_price) : null;

  const saleActive =
    Boolean(row.sale_enabled) &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price &&
    isInSaleTime(row.sale_start, row.sale_end);

  const final_price = saleActive ? salePrice : price;

  return {
    ...row,
    price,
    sale_price: salePrice,
    final_price,

    images: Array.isArray(row.images) ? row.images : [],

    sale_stock: Number(row.sale_stock ?? 0),
    sale_sold: Number(row.sale_sold ?? 0),
    sale_enabled: Boolean(row.sale_enabled),

    sold: Number(row.sold ?? 0),
    views: Number(row.views ?? 0),

    is_active: row.is_active !== false,
  };
}

function mapDbError(err: unknown): string {
  const code =
    typeof err === "object" &&
    err &&
    "code" in err
      ? String((err as { code?: string }).code)
      : "";

  if (code === "23505") return "DUPLICATE";
  if (code === "23503") return "INVALID_REFERENCE";

  return "DB_ERROR";
}

/* =========================================================
   GET ALL
========================================================= */

export async function getAllProducts(limit = 20): Promise<ProductRecord[]> {
  console.log("[DB][PRODUCT][GET_ALL] start", { limit });

  const { rows } = await query<ProductRow>(
    `
    SELECT *
    FROM products
    WHERE is_active = true
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit]
  );

  console.log("[DB][PRODUCT][GET_ALL] rows:", rows.length);

  return rows.map(toAppProduct);
}

/* =========================================================
   GET SELLER PRODUCTS
========================================================= */

export async function getSellerProducts(
  sellerId: string
): Promise<ProductRecord[]> {
  console.log("[DB][PRODUCT][GET_SELLER] start", { sellerId });

  if (!isUUID(sellerId)) {
    console.warn("[DB][PRODUCT][GET_SELLER] invalid sellerId");
    return [];
  }

  const { rows } = await query<ProductRow>(
    `
    SELECT *
    FROM products
    WHERE seller_id = $1
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    `,
    [sellerId]
  );

  console.log("[DB][PRODUCT][GET_SELLER] rows:", rows.length);

  return rows.map(toAppProduct);
}

/* =========================================================
   GET BY IDS
========================================================= */

export async function getProductsByIds(
  ids: string[]
): Promise<ProductRecord[]> {
  console.log("[DB][PRODUCT][GET_BY_IDS] start", { count: ids.length });

  const safeIds = ids.filter(isUUID);

  if (!safeIds.length) {
    console.warn("[DB][PRODUCT][GET_BY_IDS] no valid ids");
    return [];
  }

  const { rows } = await query<ProductRow>(
    `
    SELECT *
    FROM products
    WHERE id = ANY($1::uuid[])
      AND deleted_at IS NULL
      AND is_active = true
    `,
    [safeIds]
  );

  console.log("[DB][PRODUCT][GET_BY_IDS] rows:", rows.length);

  return rows.map(toAppProduct);
}

/* =========================================================
   GET BY ID
========================================================= */

export async function getProductById(
  id: string
): Promise<ProductRecord | null> {
  console.log("[DB][PRODUCT][GET_BY_ID] start", { id });

  if (!isUUID(id)) {
    console.warn("[DB][PRODUCT][GET_BY_ID] invalid UUID");
    return null;
  }

  try {
    const { rows } = await query<ProductRow>(
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
      console.warn("[DB][PRODUCT][GET_BY_ID] not found");
      return null;
    }

    console.log("[DB][PRODUCT][GET_BY_ID] found");

    return toAppProduct(rows[0]);
  } catch (err) {
    console.error("[DB][PRODUCT][GET_BY_ID] ERROR:", mapDbError(err));
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
  console.log("[DB][PRODUCT][CREATE] start", {
    sellerId,
    product,
  });

  if (!isUUID(sellerId)) {
    throw new Error("INVALID_SELLER_ID");
  }

  const slug = product.name.toLowerCase().trim().replace(/\s+/g, "-");

  const price = Number(product.price || 0);
  const salePrice =
    product.sale_price !== null ? Number(product.sale_price) : null;

  const finalPrice =
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price
      ? salePrice
      : price;

  try {
    const { rows } = await query<ProductRow>(
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
        product.category_id,

        price,
        salePrice,
        finalPrice,

        product.sale_start,
        product.sale_end,

        Number(product.sale_stock ?? 0),
        0,
        Boolean(product.sale_enabled),

        Number(product.stock ?? 0),
        Boolean(product.is_active),

        Number(product.views ?? 0),
        Number(product.sold ?? 0),

        sellerId,
      ]
    );

    if (!rows.length) {
      throw new Error("FAILED_TO_CREATE_PRODUCT");
    }

    console.log("[DB][PRODUCT][CREATE] success", rows[0].id);

    return toAppProduct(rows[0]);

  } catch (err) {
    console.error("[DB][PRODUCT][CREATE] ERROR:", mapDbError(err));
    throw new Error(mapDbError(err));
  }
}

/* =========================================================
   UPDATE — FORENSIC VERSION
========================================================= */

export async function updateProductBySeller(
  sellerId: string,
  productId: string,
  data: UpdateProductInput
): Promise<ProductRecord | null> {
  console.log("[DB][PRODUCT][UPDATE] start", {
    sellerId,
    productId,
    incoming: data,
  });

  if (!isUUID(sellerId) || !isUUID(productId)) {
    console.warn("[DB][PRODUCT][UPDATE] invalid ids");
    return null;
  }

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
    "sale_stock",
    "sale_sold",
    "sale_enabled",
    "stock",
    "is_active",
    "status",
  ] as const;

  const fields: string[] = [];
  const values: unknown[] = [];
  const accepted: Record<string, unknown> = {};
  const skipped: Record<string, unknown> = {};

  let idx = 1;

  for (const key of allowedFields) {
    const value = data[key];

    if (value === undefined) {
      skipped[key] = "undefined";
      continue;
    }

    if (key === "price" || key === "stock" || key === "sale_stock" || key === "sale_sold") {
      if (typeof value !== "number" || Number.isNaN(value)) {
        skipped[key] = value;
        continue;
      }
    }

    if (key === "sale_price") {
      if (
        value !== null &&
        (typeof value !== "number" || Number.isNaN(value))
      ) {
        skipped[key] = value;
        continue;
      }
    }

    accepted[key] = value;
    fields.push(`${key} = $${idx++}`);
    values.push(value);
  }

  console.log("[DB][PRODUCT][UPDATE] accepted:", accepted);
  console.log("[DB][PRODUCT][UPDATE] skipped:", skipped);
  console.log("[DB][PRODUCT][UPDATE] sql_fields:", fields);

  if (!fields.length) {
    console.warn("[DB][PRODUCT][UPDATE] no valid fields");
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

    console.log("[DB][PRODUCT][UPDATE] sql_values:", [
      ...values,
      productId,
      sellerId,
    ]);

    if (!rows.length) {
      console.warn("[DB][PRODUCT][UPDATE] not found");
      return null;
    }

    console.log("[DB][PRODUCT][UPDATE] returned_row:", {
      id: rows[0].id,
      price: rows[0].price,
      sale_price: rows[0].sale_price,
      sale_enabled: rows[0].sale_enabled,
      sale_stock: rows[0].sale_stock,
      sale_start: rows[0].sale_start,
      sale_end: rows[0].sale_end,
      stock: rows[0].stock,
    });

    return toAppProduct(rows[0]);

  } catch (err) {
    console.error("[DB][PRODUCT][UPDATE] ERROR:", mapDbError(err));
    return null;
  }
}

/* =========================================================
   DELETE PRODUCT BY ID
========================================================= */

export async function deleteProductById(
  productId: string,
  userId: string
): Promise<{
  ok: boolean;
  paths: string[];
  error?: string;
}> {
  console.log("[DB][PRODUCT][DELETE] start", { productId, userId });

  if (!isUUID(productId) || !isUUID(userId)) {
    return { ok: false, paths: [], error: "INVALID_ID" };
  }

  try {
    const res = await query(
      `
      SELECT images, seller_id
      FROM products
      WHERE id = $1
      `,
      [productId]
    );

    if (!res.rows.length) {
      return { ok: false, paths: [], error: "NOT_FOUND" };
    }

    const product = res.rows[0];

    if (product.seller_id !== userId) {
      return { ok: false, paths: [], error: "FORBIDDEN" };
    }

    const paths: string[] = [];

    if (Array.isArray(product.images)) {
      for (const url of product.images) {
        if (typeof url !== "string") continue;
        const p = url.split("/storage/v1/object/public/products/")[1];
        if (p) paths.push(p);
      }
    }

    await query(`DELETE FROM shipping_rates WHERE product_id = $1`, [productId]);
    await query(`DELETE FROM product_variants WHERE product_id = $1`, [productId]);
    await query(`UPDATE products SET deleted_at = NOW() WHERE id = $1`, [productId]);

    console.log("[DB][PRODUCT][DELETE] success");

    return { ok: true, paths };

  } catch (err) {
    console.error("[DB][PRODUCT][DELETE] ERROR:", mapDbError(err));
    return { ok: false, paths: [], error: "DB_ERROR" };
  }
}
/* =========================================================
   LEGACY COMPATIBILITY EXPORTS
   GIỮ TƯƠNG THÍCH TOÀN APP
========================================================= */

export async function deleteProductBySeller(
  sellerId: string,
  productId: string
): Promise<boolean> {
  console.log("🧪 [DB][PRODUCT][DELETE_BY_SELLER] START", {
    sellerId,
    productId,
  });

  const result = await deleteProductById(productId, sellerId);

  console.log("🧪 [DB][PRODUCT][DELETE_BY_SELLER] RESULT", result);

  return result.ok;
}

export async function getSoldByProduct(
  productId: string
): Promise<number> {
  console.log("🧪 [DB][PRODUCT][GET_SOLD] START", productId);

  const { rows } = await query(
    `
    SELECT COALESCE(SUM(quantity),0)::int AS sold
    FROM order_items
    WHERE product_id = $1
    `,
    [productId]
  );

  const sold = Number(rows[0]?.sold ?? 0);

  console.log("🧪 [DB][PRODUCT][GET_SOLD] RESULT", sold);

  return sold;
}

export async function incrementProductView(
  productId: string
): Promise<number> {
  console.log("🧪 [DB][PRODUCT][INCREMENT_VIEW] START", productId);

  const { rows } = await query(
    `
    UPDATE products
    SET views = COALESCE(views,0) + 1,
        updated_at = NOW()
    WHERE id = $1
    RETURNING views
    `,
    [productId]
  );

  const views = Number(rows[0]?.views ?? 0);

  console.log("🧪 [DB][PRODUCT][INCREMENT_VIEW] RESULT", views);

  return views;
}
