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
   TYPES
========================= */

export type Region =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

export interface ShippingInfo {
  name: string;
  phone: string;
  address_line: string;
  province: string;
  country?: string;
  postal_code?: string | null;
}

export interface AddressApiItem {
  is_default: boolean;
  full_name: string;
  phone: string;
  address_line: string;
  province: string;
  country?: string;
  postal_code?: string | null;
}

export interface AddressApiResponse {
  items?: AddressApiItem[];
}

export interface Message {
  text: string;
  type: "error" | "success";
}

export interface PreviewItem {
  product_id: string;
  quantity: number;
}

export interface PreviewPayload {
  country: string;
  zone: Region;
  items: PreviewItem[];
}

export interface PreviewResponse {
  shipping_fee: number;
  total: number;
}

export interface Props {
  open: boolean;
  onClose: () => void;
  product: Product & {
    variant_id?: string | null;
  };
}
