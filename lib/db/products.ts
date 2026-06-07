import { query, withTransaction } from "@/lib/db";

import type {
  ProductRow,
  ProductRecord,
  ProductStatus,
  CreateProductInput,
  UpdateProductInput,
} from "@/types/Product";

/* =========================================================
   LOGGER
========================================================= */

function log(
  step: string,
  data?: unknown
): void {
  console.log(
    `🧪 [DB][PRODUCTS] ${step}`,
    data ?? ""
  );
}

function logError(
  step: string,
  error: unknown
): void {
  console.error(
    `💥 [DB][PRODUCTS] ${step}`,
    error
  );
}

/* =========================================================
   HELPERS
========================================================= */

function isUUID(
  value: string
): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(
    value
  );
}

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

  const parsed =
    Number(value);

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

  const parsed =
    Number(value);

  return Number.isNaN(parsed)
    ? null
    : parsed;
}

function normalizeImages(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is string =>
      typeof item === "string" &&
      item.trim().length > 0
  );
}

function slugify(
  value: string
): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9\s-]/g,
      ""
    )
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function generateUniqueSlug(
  name: string
): Promise<string> {
  log(
    "GENERATE_SLUG_START",
    name
  );

  const baseSlug =
    slugify(name);

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const result =
      await query<{
        id: string;
      }>(
        `
        SELECT id
        FROM products
        WHERE slug = $1
        LIMIT 1
        `,
        [slug]
      );

    if (
      result.rows.length === 0
    ) {
      log(
        "GENERATE_SLUG_SUCCESS",
        slug
      );

      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

function normalizeStatus(
  status?: ProductStatus,
  is_active?: boolean
): ProductStatus {
  if (status) {
    return status;
  }

  return is_active === false
    ? "hidden"
    : "active";
}

function calcFinalPrice(
  input: {
    price?: number;
    sale_price?: number | null;
    sale_enabled?: boolean;
  }
): number {
  const price =
    safeNumber(
      input.price
    );

  const salePrice =
    safeNullableNumber(
      input.sale_price
    );

  if (
    !input.sale_enabled
  ) {
    return price;
  }

  if (
    salePrice === null ||
    salePrice <= 0
  ) {
    return price;
  }

  if (
    salePrice >= price
  ) {
    return price;
  }

  return salePrice;
}

function mapRow(
  row: ProductRow
): ProductRecord {
  return {
    ...row,

    price: safeNumber(
      row.price
    ),

    sale_price:
      safeNullableNumber(
        row.sale_price
      ),

    final_price:
      safeNumber(
        row.final_price
      ),

    stock: safeNumber(
      row.stock
    ),

    sale_stock:
      safeNumber(
        row.sale_stock
      ),

    sale_sold:
      safeNumber(
        row.sale_sold
      ),

    sold: safeNumber(
      row.sold
    ),

    views: safeNumber(
      row.views
    ),

    rating_avg:
      safeNumber(
        row.rating_avg
      ),

    rating_count:
      safeNumber(
        row.rating_count
      ),

    images:
      normalizeImages(
        row.images
      ),

    detail_images:
      normalizeImages(
        row.detail_images
      ),

    is_active:
      row.is_active === true,

    is_featured:
      row.is_featured === true,

    is_digital:
      row.is_digital === true,

    is_unlimited:
      row.is_unlimited === true,

    sale_enabled:
      row.sale_enabled === true,

    has_variants:
      row.has_variants === true,
  };
}

/* =========================================================
   GET ALL PRODUCTS
========================================================= */

export async function getAllProducts(
  limit = 20
): Promise<ProductRecord[]> {
  log(
    "GET_ALL_START",
    { limit }
  );

  try {
    const result =
      await query<ProductRow>(
        `
        SELECT *
        FROM products
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [limit]
      );

    log(
      "GET_ALL_SUCCESS",
      {
        count:
          result.rows.length,
      }
    );

    return result.rows.map(
      mapRow
    );
  } catch (error) {
    logError(
      "GET_ALL_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET PRODUCT BY ID
========================================================= */

export async function getProductById(
  product_id: string
): Promise<ProductRecord | null> {
  log(
    "GET_BY_ID_START",
    { product_id }
  );

  try {
    if (
      !product_id ||
      !isUUID(product_id)
    ) {
      log(
        "GET_BY_ID_INVALID_ID",
        product_id
      );

      return null;
    }

    const result =
      await query<ProductRow>(
        `
        SELECT *
        FROM products
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [product_id]
      );

    const row =
      result.rows[0] ??
      null;

    if (!row) {
      log(
        "GET_BY_ID_NOT_FOUND",
        product_id
      );

      return null;
    }

    log(
      "GET_BY_ID_SUCCESS",
      product_id
    );

    return mapRow(row);
  } catch (error) {
    logError(
      "GET_BY_ID_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET PRODUCTS BY IDS
========================================================= */

export async function getProductsByIds(
  ids: string[]
): Promise<ProductRecord[]> {
  log(
    "GET_BY_IDS_START",
    ids
  );

  try {
    if (
      !Array.isArray(ids)
    ) {
      throw new Error(
        "INVALID_PRODUCT_IDS"
      );
    }

    const validIds =
      ids.filter(isUUID);

    if (
      validIds.length === 0
    ) {
      log(
        "GET_BY_IDS_EMPTY"
      );

      return [];
    }

    const result =
      await query<ProductRow>(
        `
        SELECT *
        FROM products
        WHERE id = ANY($1::uuid[])
          AND deleted_at IS NULL
        `,
        [validIds]
      );

    log(
      "GET_BY_IDS_SUCCESS",
      {
        count:
          result.rows.length,
      }
    );

    return result.rows.map(
      mapRow
    );
  } catch (error) {
    logError(
      "GET_BY_IDS_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET SELLER PRODUCTS
========================================================= */

export async function getSellerProducts(
  seller_id: string
): Promise<ProductRecord[]> {
  log(
    "GET_SELLER_PRODUCTS_START",
    { seller_id }
  );

  try {
    if (!isUUID(seller_id)) {
      return [];
    }

    const result =
      await query<ProductRow>(
        `
        SELECT
          p.*,

          /* ================= SHOP ================= */

          up.shop_name,
          up.shop_banner,
          up.avatar_url,
          up.total_sales,
          up.shop_description
        FROM products p

        LEFT JOIN user_profiles up
          ON up.user_id = p.seller_id

        WHERE p.seller_id = $1
          AND p.deleted_at IS NULL

        ORDER BY p.created_at DESC
        `,
        [seller_id]
      );

    log(
      "GET_SELLER_PRODUCTS_SUCCESS",
      {
        count:
          result.rows.length,
        first:
          result.rows[0] ?? null,
      }
    );

    return result.rows.map(
      mapRow
    );
  } catch (error) {
    logError(
      "GET_SELLER_PRODUCTS_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   CREATE PRODUCT
========================================================= */

export async function createProduct(
  seller_id: string,
  input: CreateProductInput
): Promise<ProductRecord> {
  log(
    "CREATE_START",
    input
  );

  try {
    if (
      !isUUID(seller_id)
    ) {
      throw new Error(
        "INVALID_SELLER_ID"
      );
    }

    if (
      !input.name?.trim()
    ) {
      throw new Error(
        "INVALID_PRODUCT_NAME"
      );
    }

    if (
      !Array.isArray(
        input.images
      ) ||
      input.images.length === 0
    ) {
      throw new Error(
        "PRODUCT_IMAGE_REQUIRED"
      );
    }

    const price =
      safeNumber(
        input.price
      );

    if (price < 0) {
      throw new Error(
        "INVALID_PRODUCT_PRICE"
      );
    }

    const salePrice =
      safeNullableNumber(
        input.sale_price
      );

    if (
      salePrice !== null &&
      salePrice >= price
    ) {
      throw new Error(
        "INVALID_SALE_PRICE"
      );
    }

    const finalPrice =
      calcFinalPrice({
        price,
        sale_price:
          salePrice,
        sale_enabled:
          input.sale_enabled,
      });

    const slug =
      await generateUniqueSlug(
        input.name
      );

    const status =
      normalizeStatus(
        input.status,
        input.is_active
      );

    const result =
      await query<ProductRow>(
        `
        INSERT INTO products (
          seller_id,
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
          is_featured,
          is_digital,
          status,
          category_id,
          sale_start,
          sale_end,
          sale_enabled,
          sale_stock,
          meta_title,
          meta_description,
          is_active,
          has_variants
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,
          $11,$12,$13,$14,
          $15,$16,$17,$18,
          $19,$20,$21,$22,
          $23,$24,$25,$26,
          $27,$28
        )
        RETURNING *
        `,
        [
          seller_id,
          input.name.trim(),
          slug,

          input.short_description ??
            "",

          input.description ??
            "",

          input.detail ??
            "",

          input.thumbnail ??
            "",

          normalizeImages(
            input.images
          ),

          normalizeImages(
            input.detail_images
          ),

          input.video_url ??
            "",

          price,

          salePrice,

          finalPrice,

          "PI",

          safeNumber(
            input.stock
          ),

          Boolean(
            input.is_unlimited
          ),

          Boolean(
            input.is_featured
          ),

          Boolean(
            input.is_digital
          ),

          status,

          input.category_id ??
            null,

          input.sale_start ??
            null,

          input.sale_end ??
            null,

          Boolean(
            input.sale_enabled
          ),

          safeNumber(
            input.sale_stock
          ),

          input.meta_title ??
            "",

          input.meta_description ??
            "",

          input.is_active !==
            false,

          Boolean(
            input.has_variants
          ),
        ]
      );

    const row =
      result.rows[0];

    if (!row) {
      throw new Error(
        "FAILED_TO_CREATE_PRODUCT"
      );
    }

    log(
      "CREATE_SUCCESS",
      row.id
    );

    return mapRow(row);
  } catch (error) {
    logError(
      "CREATE_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   UPDATE PRODUCT
========================================================= */

export async function updateProductBySeller(
  seller_id: string,
  product_id: string,
  input: UpdateProductInput
): Promise<ProductRecord | null> {
  log(
    "UPDATE_START",
    {
      seller_id,
      product_id,
      input,
    }
  );

  try {
    if (
      !isUUID(seller_id) ||
      !isUUID(product_id)
    ) {
      return null;
    }

    if (
      input.name !==
        undefined &&
      !input.name.trim()
    ) {
      throw new Error(
        "INVALID_PRODUCT_NAME"
      );
    }

    if (
      input.images !==
        undefined &&
      input.images.length === 0
    ) {
      throw new Error(
        "PRODUCT_IMAGE_REQUIRED"
      );
    }

    const current =
      await getProductById(
        product_id
      );

    if (!current) {
      return null;
    }

    const nextPrice =
      input.price !==
      undefined
        ? safeNumber(
            input.price
          )
        : current.price;

    const nextSalePrice =
      input.sale_price !==
      undefined
        ? safeNullableNumber(
            input.sale_price
          )
        : current.sale_price;

    const nextSaleEnabled =
      input.sale_enabled !==
      undefined
        ? Boolean(
            input.sale_enabled
          )
        : current.sale_enabled;

    const nextFinalPrice =
      calcFinalPrice({
        price: nextPrice,
        sale_price:
          nextSalePrice,
        sale_enabled:
          nextSaleEnabled,
      });

    const nextStatus =
      normalizeStatus(
        input.status,
        input.is_active
      );

    const result =
      await query<ProductRow>(
        `
        UPDATE products
        SET
          name = $1,
          slug = $2,
          short_description = $3,
          description = $4,
          detail = $5,
          thumbnail = $6,
          images = $7,
          detail_images = $8,
          video_url = $9,
          price = $10,
          sale_price = $11,
          final_price = $12,
          stock = $13,
          is_unlimited = $14,
          is_featured = $15,
          is_digital = $16,
          status = $17,
          category_id = $18,
          sale_start = $19,
          sale_end = $20,
          sale_enabled = $21,
          sale_stock = $22,
          meta_title = $23,
          meta_description = $24,
          is_active = $25,
          has_variants = $26,
          updated_at = NOW()
        WHERE id = $27
          AND seller_id = $28
          AND deleted_at IS NULL
        RETURNING *
        `,
        [
          input.name?.trim() ??
            current.name,

          slugify(
            input.name ??
              current.name
          ),

          input.short_description ??
            current.short_description,

          input.description ??
            current.description,

          input.detail ??
            current.detail,

          input.thumbnail ??
            current.thumbnail,

          input.images
            ? normalizeImages(
                input.images
              )
            : current.images,

          input.detail_images
            ? normalizeImages(
                input.detail_images
              )
            : current.detail_images,

          input.video_url ??
            current.video_url,

          nextPrice,

          nextSalePrice,

          nextFinalPrice,

          input.stock !==
            undefined
            ? safeNumber(
                input.stock
              )
            : current.stock,

          input.is_unlimited !==
            undefined
            ? Boolean(
                input.is_unlimited
              )
            : current.is_unlimited,

          input.is_featured !==
            undefined
            ? Boolean(
                input.is_featured
              )
            : current.is_featured,

          input.is_digital !==
            undefined
            ? Boolean(
                input.is_digital
              )
            : current.is_digital,

          nextStatus,

          input.category_id !==
            undefined
            ? input.category_id
            : current.category_id,

          input.sale_start !==
            undefined
            ? input.sale_start
            : current.sale_start,

          input.sale_end !==
            undefined
            ? input.sale_end
            : current.sale_end,

          nextSaleEnabled,

          input.sale_stock !==
            undefined
            ? safeNumber(
                input.sale_stock
              )
            : current.sale_stock,

          input.meta_title ??
            current.meta_title,

          input.meta_description ??
            current.meta_description,

          input.is_active !==
            undefined
            ? input.is_active
            : current.is_active,

          input.has_variants !==
            undefined
            ? input.has_variants
            : current.has_variants,

          product_id,
          seller_id,
        ]
      );

    const row =
      result.rows[0] ??
      null;

    if (!row) {
      return null;
    }

    log(
      "UPDATE_SUCCESS",
      row.id
    );

    return mapRow(row);
  } catch (error) {
    logError(
      "UPDATE_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   DELETE PRODUCT
========================================================= */

export async function deleteProductBySeller(
  seller_id: string,
  product_id: string
): Promise<boolean> {
  log(
    "DELETE_START",
    {
      seller_id,
      product_id,
    }
  );

  try {
    if (
      !isUUID(seller_id) ||
      !isUUID(product_id)
    ) {
      return false;
    }

    const result =
      await query<{
        id: string;
      }>(
        `
        DELETE FROM products
        WHERE id = $1
          AND seller_id = $2
        RETURNING id
        `,
        [
          product_id,
          seller_id,
        ]
      );

    const success =
      result.rows.length > 0;

    log(
      "DELETE_SUCCESS",
      success
    );

    return success;
  } catch (error) {
    logError(
      "DELETE_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   DELETE PRODUCT FULL
========================================================= */

export async function deleteProductById(
  product_id: string,
  seller_id: string
): Promise<{
  ok: boolean;
}> {
  log(
    "DELETE_FULL_START",
    {
      product_id,
      seller_id,
    }
  );

  return withTransaction(
    async (client) => {
      await client.query(
        `
        DELETE FROM product_variants
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM shipping_rates
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM cart_items
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM favorites
        WHERE product_id = $1
        `,
        [product_id]
      );

      await client.query(
        `
        DELETE FROM product_reviews
        WHERE product_id = $1
        `,
        [product_id]
      );

      const result =
        await client.query<{
          id: string;
        }>(
          `
          DELETE FROM products
          WHERE id = $1
            AND seller_id = $2
          RETURNING id
          `,
          [
            product_id,
            seller_id,
          ]
        );

      const ok =
        result.rows.length > 0;

      log(
        "DELETE_FULL_SUCCESS",
        ok
      );

      return { ok };
    }
  );
}

/* =========================================================
   INCREMENT PRODUCT VIEW
========================================================= */

export async function incrementProductView(
  product_id: string
): Promise<number> {
  log(
    "INCREMENT_VIEW_START",
    product_id
  );

  try {
    const result =
      await query<{
        views: number;
      }>(
        `
        UPDATE products
        SET
          views = views + 1,
          updated_at = NOW()
        WHERE id = $1
        RETURNING views
        `,
        [product_id]
      );

    const views =
      safeNumber(
        result.rows[0]?.views
      );

    log(
      "INCREMENT_VIEW_SUCCESS",
      views
    );

    return views;
  } catch (error) {
    logError(
      "INCREMENT_VIEW_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   GET SOLD COUNT
========================================================= */

export async function getSoldByProduct(
  product_id: string
): Promise<number> {
  log(
    "GET_SOLD_START",
    product_id
  );

  try {
    const result =
      await query<{
        sold: number;
      }>(
        `
        SELECT
          COALESCE(
            SUM(quantity),
            0
          ) AS sold
        FROM order_items
        WHERE product_id = $1
        `,
        [product_id]
      );

    const sold =
      safeNumber(
        result.rows[0]?.sold
      );

    log(
      "GET_SOLD_SUCCESS",
      sold
    );

    return sold;
  } catch (error) {
    logError(
      "GET_SOLD_ERROR",
      error
    );

    throw error;
  }
}

/* =========================================================
   SYNC PRODUCT FROM VARIANTS
========================================================= */

export async function syncProductFromVariants(
  product_id: string
): Promise<void> {
  await withTransaction(
    async (client) => {
      log(
        "SYNC_FROM_VARIANTS_START",
        product_id
      );

      const result =
        await client.query<{
          variant_count: string;
          min_price: string | null;
          total_stock: string | null;
        }>(
          `
          SELECT
            COUNT(*)::text AS variant_count,

            MIN(final_price)::text AS min_price,

            COALESCE(
              SUM(
                CASE
                  WHEN is_unlimited
                  THEN 0
                  ELSE stock
                END
              ),
              0
            )::text AS total_stock

          FROM product_variants

          WHERE product_id = $1
            AND deleted_at IS NULL
            AND is_active = true
          `,
          [product_id]
        );

      const row = result.rows[0];

      const variant_count =
        safeNumber(
          row?.variant_count
        );

      const has_variants =
        variant_count > 0;

      const min_price =
        safeNumber(
          row?.min_price
        );

      const total_stock =
        safeNumber(
          row?.total_stock
        );

      log(
        "SYNC_FROM_VARIANTS_RESULT",
        {
          variant_count,
          has_variants,
          min_price,
          total_stock,
        }
      );

      await client.query(
        `
        UPDATE products
        SET
          final_price = $2,
          stock = $3,
          has_variants = $4,
          updated_at = NOW()
        WHERE id = $1
        `,
        [
          product_id,
          min_price,
          total_stock,
          has_variants,
        ]
      );

      log(
        "SYNC_FROM_VARIANTS_SUCCESS",
        product_id
      );
    }
  );
}
