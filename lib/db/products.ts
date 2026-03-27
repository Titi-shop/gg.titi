const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is missing");
}

if (!SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

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
   INTERNAL HELPERS
========================================================= */

function supabaseHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

function toAppProduct(row: ProductRow): ProductRecord {
  return {
    ...row,
    price: Number(row.price),
    sale_price: row.sale_price !== null ? Number(row.sale_price) : null,
  };
}

function toDbPrice(value: number): number {
  return Number(value);
}

/* =========================================================
   GET — ALL ACTIVE PRODUCTS (PUBLIC)
========================================================= */

export async function getAllProducts(): Promise<ProductRecord[]> {
  const url =
    `${SUPABASE_URL}/rest/v1/products` +
    `?deleted_at=is.null&select=*`;

  const res = await fetch(url, {
    headers: supabaseHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ SUPABASE GET PRODUCTS ERROR:", text);
    throw new Error("FAILED_TO_FETCH_PRODUCTS");
  }

  const rows: ProductRow[] = await res.json();
  return rows.map(toAppProduct);
}

/* =========================================================
   GET — PRODUCTS BY SELLER
========================================================= */

export async function getSellerProducts(
  sellerId: string
): Promise<ProductRecord[]> {
  const url =
    `${SUPABASE_URL}/rest/v1/products` +
    `?seller_id=eq.${encodeURIComponent(sellerId)}` +
    `&deleted_at=is.null&select=*`;

  const res = await fetch(url, {
    headers: supabaseHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ SUPABASE SELLER PRODUCTS ERROR:", text);
    throw new Error("FAILED_TO_FETCH_SELLER_PRODUCTS");
  }

  const rows: ProductRow[] = await res.json();
  return rows.map(toAppProduct);
}

/* =========================================================
   POST — CREATE PRODUCT
========================================================= */

export async function createProduct(
  sellerId: string,
  product: CreateProductInput
): Promise<ProductRecord> {
  if (Number.isNaN(product.price)) {
    throw new Error("INVALID_PRICE");
  }

  if (
    product.sale_price !== null &&
    Number.isNaN(product.sale_price)
  ) {
    throw new Error("INVALID_SALE_PRICE");
  }

  const payload = {
    name: product.name.trim(),
    description: product.description ?? "",
    detail: product.detail ?? "",
    images: Array.isArray(product.images) ? product.images : [],
    thumbnail: product.thumbnail ?? null,
    category_id: product.category_id ?? null,

    price: toDbPrice(product.price),
    sale_price:
      product.sale_price !== null
        ? toDbPrice(product.sale_price)
        : null,

    sale_start: product.sale_start ?? null,
    sale_end: product.sale_end ?? null,

    stock:
      typeof product.stock === "number" &&
      !Number.isNaN(product.stock) &&
      product.stock >= 0
        ? product.stock
        : 0,

    is_active:
      typeof product.is_active === "boolean"
        ? product.is_active
        : true,

    views:
      typeof product.views === "number" && !Number.isNaN(product.views)
        ? product.views
        : 0,

    sold:
      typeof product.sold === "number" && !Number.isNaN(product.sold)
        ? product.sold
        : 0,

    seller_id: sellerId,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ SUPABASE CREATE PRODUCT ERROR:", text);
    throw new Error("FAILED_TO_CREATE_PRODUCT");
  }

  const rows: ProductRow[] = await res.json();

  if (!rows.length) {
    throw new Error("PRODUCT_CREATED_BUT_EMPTY_RESPONSE");
  }

  return toAppProduct(rows[0]);
}

/* =========================================================
   PATCH — UPDATE PRODUCT BY SELLER
========================================================= */

export async function updateProductBySeller(
  sellerId: string,
  productId: string,
  data: UpdateProductInput
): Promise<boolean> {
  const payload: Record<string, unknown> = {};

  if (data.name !== undefined) {
    payload.name =
      typeof data.name === "string" ? data.name.trim() : "";
  }

  if (data.description !== undefined) {
    payload.description =
      typeof data.description === "string" ? data.description : "";
  }

  if (data.detail !== undefined) {
    payload.detail =
      typeof data.detail === "string" ? data.detail : "";
  }

  if (data.images !== undefined) {
    payload.images = Array.isArray(data.images)
      ? data.images.filter((i): i is string => typeof i === "string")
      : [];
  }

  if (data.thumbnail !== undefined) {
    payload.thumbnail =
      typeof data.thumbnail === "string" ? data.thumbnail : null;
  }

  if (data.category_id !== undefined) {
    payload.category_id =
      typeof data.category_id === "string" && data.category_id.trim() !== ""
        ? data.category_id
        : null;
  }

  if (data.price !== undefined) {
    if (Number.isNaN(data.price)) {
      throw new Error("INVALID_PRICE");
    }
    payload.price = toDbPrice(data.price);
  }

  if (data.sale_price !== undefined) {
    if (data.sale_price !== null && Number.isNaN(data.sale_price)) {
      throw new Error("INVALID_SALE_PRICE");
    }

    payload.sale_price =
      data.sale_price !== null ? toDbPrice(data.sale_price) : null;
  }

  if (data.sale_start !== undefined) {
    payload.sale_start =
      typeof data.sale_start === "string" ? data.sale_start : null;
  }

  if (data.sale_end !== undefined) {
    payload.sale_end =
      typeof data.sale_end === "string" ? data.sale_end : null;
  }

  if (data.stock !== undefined) {
    payload.stock =
      typeof data.stock === "number" &&
      !Number.isNaN(data.stock) &&
      data.stock >= 0
        ? data.stock
        : 0;
  }

  if (data.is_active !== undefined) {
    payload.is_active =
      typeof data.is_active === "boolean" ? data.is_active : true;
  }

  if (data.status !== undefined) {
    payload.status = data.status;
  }

  const url =
    `${SUPABASE_URL}/rest/v1/products` +
    `?id=eq.${encodeURIComponent(productId)}` +
    `&seller_id=eq.${encodeURIComponent(sellerId)}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ SUPABASE UPDATE PRODUCT ERROR:", text);
    throw new Error("FAILED_TO_UPDATE_PRODUCT");
  }

  const rows: ProductRow[] = await res.json();

return rows.length > 0;
}

/* =========================================================
   PATCH — SOFT DELETE
========================================================= */

export async function deleteProductBySeller(
  sellerId: string,
  productId: string
): Promise<boolean> {
  const url =
    `${SUPABASE_URL}/rest/v1/products` +
    `?id=eq.${encodeURIComponent(productId)}` +
    `&seller_id=eq.${encodeURIComponent(sellerId)}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      deleted_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ DELETE PRODUCT ERROR:", text);
    throw new Error("FAILED_TO_DELETE_PRODUCT");
  }

  const rows: ProductRow[] = await res.json();
  return rows.length > 0;
}
