import type { Product } from "@/types/Product";

/* =========================
   PI TYPE
========================= */

export type PiPayment = {
  createPayment: (
    data: {
      amount: number;
      memo: string;
      metadata: unknown;
    },
    callbacks: {
      onReadyForServerApproval: (
        paymentId: string,
        callback: () => void
      ) => void;
      onReadyForServerCompletion: (
        paymentId: string,
        txid: string
      ) => void;
      onCancel: () => void;
      onError: (error: unknown) => void;
    }
  ) => Promise<void>;
};

declare global {
  interface Window {
    Pi?: PiPayment;
  }
}

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
   SHIPPING
========================= */

export interface ShippingInfo {
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
   ADDRESS API
========================= */

export interface AddressApiItem {
  is_default: boolean;
  full_name: string;
  phone: string;
  address_line: string;
  region: string;
  district?: string;
  ward?: string;
  country: string;
  postal_code?: string | null;
}

export interface AddressApiResponse {
  items?: AddressApiItem[];
}

/* =========================
   MESSAGE
========================= */

export interface Message {
  text: string;
  type: "error" | "success";
}

/* =========================
   PREVIEW
========================= */

export interface PreviewItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface PreviewPayload {
  country: string;
  zone: Region;

  shipping: {
    region: string;
    district?: string;
    ward?: string;
  };

  items: PreviewItem[];
}

export interface PreviewResponse {
  shipping_fee: number;
  total: number;
  currency?: string;
}

/* =========================
   CHECKOUT PRODUCT
========================= */

export interface CheckoutProduct extends Product {
  selectedVariant?: {
    id: string;
    price: number;
    salePrice?: number | null;
    finalPrice?: number;
    stock: number;
  } | null;

  variant_id?: string | null;
}

/* =========================
   COMPONENT PROPS
========================= */

export interface Props {
  open: boolean;
  onClose: () => void;
  product: CheckoutProduct;
}
