export type VariantInput = {
  price?: number;
  sale_price?: number | null;
  final_price?: number;
  stock?: number;
  sale_enabled?: boolean;
};

export type ShippingRateInput = {
  zone: string;
  price: number;
  domestic_country_code:
    string | null;
};

export type ProductRequestBody = {
  id?: string;

  name: string;

  description?: string;
  detail?: string;

  images?: string[];
  thumbnail?: string;

  category_id?: number | null;

  price?: number;
  stock?: number;

  sale_price?: number | null;

  sale_start?: string | null;
  sale_end?: string | null;

  sale_stock?: number;

  sale_enabled?: boolean;

  has_variants?: boolean;

  is_active?: boolean;

  primary_shipping_country?: string;

  domestic_country_code?: string;

  shipping_rates?: {
    zone: string;
    price?: number;
    domestic_country_code?:
      string | null;
  }[];

  variants?: VariantInput[];
};
