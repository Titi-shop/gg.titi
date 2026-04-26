export interface Category {
  id: string;
  key: string;
  icon?: string;
}

export interface ProductVariant {
  id?: string;

  /* OPTIONS */
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;

  optionLabel1?: string | null;
  optionLabel2?: string | null;
  optionLabel3?: string | null;

  optionValue?: string;
  optionName?: string;

  name?: string;

  /* PRICE */
  price?: number;
  salePrice?: number | null;
  finalPrice?: number;

  /* SALE */
  saleEnabled?: boolean;
  saleStock?: number;
  saleSold?: number;

  /* STOCK */
  stock: number;
  isUnlimited?: boolean;

  /* MEDIA */
  sku?: string | null;
  image?: string;

  /* STATUS */
  sortOrder?: number;
  isActive?: boolean;

  /* ANALYTICS */
  sold?: number;
}

/* =========================
   PRODUCT PAYLOAD (CLIENT)
========================= */
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

  /* 🔥 FIX */
  isActive: boolean;

  variants?: ProductVariant[];

  shippingRates?: {
  zone: string;
  price: number;
  domesticCountryCode?: string | null;
}[];
