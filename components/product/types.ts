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

/* =========================
   PRODUCT PAYLOAD (CLIENT)
========================= */
export interface ProductPayload {
  id?: string;

  name: string;
  price: number;

  /* 🔥 SALE */
  salePrice?: number | null;
  saleStart?: string | null;
  saleEnd?: string | null;

  description: string;
  detail: string;

  images: string[];
  thumbnail: string | null;

  categoryId: string;

  stock: number;

  /* 🔥 FIX */
  isActive: boolean;

  variants?: ProductVariant[];

  /* 🔥 FIX naming */
  shippingRates?: {
    zone: string;
    price: number;
  }[];
}
