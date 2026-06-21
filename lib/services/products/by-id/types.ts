import type {
  ProductVariantRecord,
} from "@/lib/db/variants";

/* =====================================================
   SHIPPING
===================================================== */

export type ShippingRateBody = {
  zone: string;
  price?: number;
  domestic_country_code?: string | null;
};

/* =====================================================
   PRODUCT REQUEST
===================================================== */

export type ProductRequestBody = {
  name?: string;

  description?: string;
  detail?: string;

  images?: string[];
  thumbnail?: string;

  category_id?: number | null;

  /* ================= PRICE ================= */

  price?: number;
  stock?: number;

  sale_price?: number | null;
  sale_enabled?: boolean;
  sale_stock?: number;

  sale_start?: string | null;
  sale_end?: string | null;

  /* ================= STATUS ================= */

  is_active?: boolean;

  /* ================= SHIPPING ================= */

  primary_shipping_country?: string | null;

  shipping_rates?: ShippingRateBody[];

  /* ================= VARIANTS ================= */

  variants?: ProductVariantRecord[];
};
