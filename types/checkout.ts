import type { ShippingRate } from "@/types/Product";

/* =========================
   REGION
========================= */

export type Region =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

/* =========================
   SHIPPING INFO
========================= */

export interface ShippingInfo {
  id: string;
  name: string;
  phone: string;
  address_line: string;
  region: string;
  district?: string;
  ward?: string;
  country: string;
  postal_code?: string | null;
}

/* =========================
   MESSAGE
========================= */

export interface Message {
  text: string;
  type: "error" | "success";
}

/* =========================
   CHECKOUT ITEM (internal use)
========================= */

export interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  final_price: number;
  thumbnail?: string;
  stock: number;
}

/* =========================
   PRODUCT FOR CHECKOUT
========================= */

export interface CheckoutProduct {
  id: string;
  name: string;
  thumbnail: string;
  price: number;
  sale_price?: number | null;
  final_price: number;
  stock: number;

  shipping_rates?: ShippingRate[];

  selectedVariant?: {
    id: string;
    price: number;
    sale_price?: number | null;
    final_price?: number;
    stock: number;
  } | null;

  variant_id?: string | null;
}

/* =========================
   PROPS
========================= */

export interface CheckoutProps {
  open: boolean;
  onClose: () => void;
  product: CheckoutProduct;
}

/* =========================
   VALIDATE PARAMS
========================= */

export interface ValidateParams {
  user: unknown;
  piReady: boolean;
  shipping: ShippingInfo | null;
  item: CheckoutItem | null;
  quantity: number;
  maxStock: number;
  pilogin?: () => void;
  showMessage: (text: string, type?: "error" | "success") => void;
  t: Record<string, string>;
}

/* =========================
   PAY PARAMS
========================= */

export interface UseCheckoutPayParams {
  item: CheckoutItem | null;
  quantity: number;
  total: number;
  shipping: ShippingInfo | null;
  unitPrice: number;

  processing: boolean;
  setProcessing: (v: boolean) => void;
  processingRef: { current: boolean };

  t: Record<string, string>;
  user: unknown;

  router: {
    push: (path: string) => void;
  };

  onClose: () => void;

  variantId?: string | null;

  showMessage: (text: string, type?: "error" | "success") => void;

  validate: () => boolean;
}
