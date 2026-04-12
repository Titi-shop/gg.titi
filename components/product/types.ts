// components/product/types.ts

export interface Category {
  id: string;
  key: string;
  icon?: string;
}

export interface ProductVariant {
  optionValue: string;
  stock: number;
  sku?: string | null;
}

export interface ProductPayload {
  id?: string;
  name: string;
  price: number;
  salePrice?: number | null;
  saleStart?: string | null;
  saleEnd?: string | null;
  description: string;
  detail: string;
  images: string[];
  thumbnail: string | null;
  categoryId: string;
  stock: number;
  is_active: boolean;
  variants?: ProductVariant[];
  shipping_rates?: {
    zone: string;
    price: number;
  }[];
}
