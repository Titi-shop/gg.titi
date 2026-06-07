/* =========================================================
   ENUMS
========================================================= */

export type CurrencyCode = "PI";

export type ProductStatus =
  | "draft"
  | "active"
  | "hidden"
  | "archived";

export type ShippingZone =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

/* =========================================================
   CATEGORY
========================================================= */

export interface Category {
  id: number;
  key: string;
  icon?: string | null;
}

/* =========================================================
   SHIPPING
========================================================= */

export interface ShippingRate {
  id?: string;
  product_id?: string;
  zone_id?: string;
  zone?: ShippingZone;
  domestic_country_code?: string | null;
  price: number;
  currency?: CurrencyCode;
  created_at?: string;
  updated_at?: string;
}

export type ShippingRatesState = Record<ShippingZone, number | "">;

/* =========================================================
   VARIANT
========================================================= */

export interface ProductVariant {
  id?: string;
  product_id?: string;

  option1: string;
  option2?: string | null;
  option3?: string | null;

  option_label1?: string | null;
  option_label2?: string | null;
  option_label3?: string | null;

  name?: string;

  sku?: string | null;

  price: number;
  sale_price?: number | null;
  final_price?: number;

  currency?: CurrencyCode;

  sale_enabled?: boolean;
  sale_stock?: number;
  sale_sold?: number;

  stock: number;
  is_unlimited?: boolean;
  sold?: number;

  image?: string;

  is_active?: boolean;
  sort_order?: number;

  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

/* =========================================================
   PRODUCT CORE (DB)
========================================================= */

export interface ProductRecord {
  id: string;
  seller_id: string;

  name: string;
  slug: string;

  short_description: string;
  description: string;
  detail: string;

  thumbnail: string;
  images: string[];
  detail_images: string[];
  video_url: string;

  category_id: number | null;

  has_variants: boolean;
  is_digital: boolean;

  price: number;
  sale_price: number | null;
  final_price: number;

  currency: CurrencyCode;

  sale_enabled: boolean;
  sale_stock: number;
  sale_sold: number;
  sale_start: string | null;
  sale_end: string | null;

  stock: number;
  is_unlimited: boolean;
  sold: number;

  views: number;
  rating_avg: number;
  rating_count: number;

  meta_title: string;
  meta_description: string;

  status: ProductStatus;
  is_active: boolean;
  is_featured: boolean;

  variants?: ProductVariant[];
  shipping_rates?: ShippingRate[];

  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/* =========================================================
   FORM STATE
========================================================= */

export interface ProductFormState {
  id?: string;

  name: string;
  slug?: string;

  short_description: string;
  description: string;
  detail: string;

  category_id: number | "" | null;

  thumbnail: string | null;
  images: string[];
  detail_images: string[];
  video_url: string;

  has_variants: boolean;
  is_digital: boolean;

  price: number | "";
  sale_price: number | "" | null;

  final_price?: number;
  currency: CurrencyCode;

  sale_enabled: boolean;
  sale_stock: number | "";
  sale_sold?: number;
  sale_start: string | null;
  sale_end: string | null;

  stock: number | "";
  is_unlimited: boolean;

  variants: ProductVariant[];

  shipping_rates: ShippingRatesState;
  domestic_country_code: string | null;

  status: ProductStatus;
  is_active: boolean;
  is_featured: boolean;

  meta_title: string;
  meta_description: string;
}

/* =========================================================
   PAYLOAD
========================================================= */

export interface ProductPayload {
  id?: string;

  name: string;
  slug?: string;

  short_description?: string;
  description: string;
  detail: string;

  category_id?: number | null;

  thumbnail?: string | null;
  images: string[];
  detail_images?: string[];

  video_url?: string;

  has_variants?: boolean;
  is_digital?: boolean;

  price?: number;
  sale_price?: number | null;
  final_price?: number;

  currency?: CurrencyCode;

  sale_enabled?: boolean;
  sale_stock?: number;
  sale_start?: string | null;
  sale_end?: string | null;

  stock?: number;
  is_unlimited?: boolean;
  sold?: number;

  variants?: ProductVariant[];
  shipping_rates?: ShippingRate[];

  domestic_country_code?: string | null;

  status?: ProductStatus;
  is_active?: boolean;
  is_featured?: boolean;

  meta_title?: string;
  meta_description?: string;

  idempotency_key?: string;
}

/* =========================================================
   DB ROW
========================================================= */

export interface ProductDB {
  id: string;
  seller_id: string;

  name: string;
  slug: string;

  short_description: string;
  description: string;
  detail: string;

  thumbnail: string;
  images: string[];
  detail_images: string[];
  video_url: string;

  category_id: number | null;

  has_variants: boolean;
  is_digital: boolean;

  price: number;
  sale_price: number | null;
  final_price: number;

  currency: CurrencyCode;

  sale_enabled: boolean;
  sale_stock: number;
  sale_sold: number;

  sale_start: string | null;
  sale_end: string | null;

  stock: number;
  is_unlimited: boolean;
  sold: number;

  views: number;
  rating_avg: number;
  rating_count: number;
  meta_title: string;
  meta_description: string;
  status: ProductStatus;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;

  deleted_at: string | null;
}

/* =========================================================
   CREATE / UPDATE
========================================================= */

export interface CreateProductInput {
  name: string;

  short_description?: string;
  description?: string;
  detail?: string;

  thumbnail?: string;
  images?: string[];
  detail_images?: string[];
  video_url?: string;
  category_id?: number | null;
  price?: number;
  sale_price?: number | null;
  currency?: CurrencyCode;
  stock?: number;
  is_unlimited?: boolean;
  is_featured?: boolean;
  is_digital?: boolean;
  sale_enabled?: boolean;
  sale_stock?: number;
  sale_start?: string | null;
  sale_end?: string | null;
  meta_title?: string;
  meta_description?: string;
  status?: ProductStatus;
  is_active?: boolean;
  has_variants?: boolean;
}

export type UpdateProductInput =
  Partial<CreateProductInput>;

/* =========================================================
   VIEW TYPES
========================================================= */

export type ProductVariantView = {
  id: string;

  option1?: string;
  option2?: string | null;
  option3?: string | null;
  optionLabel1?: string | null;
  optionLabel2?: string | null;
  optionLabel3?: string | null;
  name?: string;
  price: number;
  sale_price?: number | null;
  final_price: number;
  sale_enabled: boolean;
  stock: number;
  image?: string;
  is_active?: boolean;
};

export type RelatedProduct = {
  id: string;
  categoryId: string;
  name: string;
  thumbnail?: string;
  price: number;
  sale_price?: number | null;
  final_price: number;
};

export type SellerProduct = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;
  thumbnail: string;
  stock: number;
  sold: number;
  rating_avg: number;
  is_active: boolean;
  min_price?: number;
  min_sale_price?: number | null;
};
