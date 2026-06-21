import type {
  OrderStatus,
} from "@/constants/order-status";

/* =====================================================
   PAYMENT
===================================================== */

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

/* =====================================================
   RETURN
===================================================== */

export type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refunded"
  | "rejected";

/* =====================================================
   ORDER ITEM
===================================================== */

export type OrderItem = {
  id: string;

  product_id: string;

  product_name: string | null;
  product_slug: string | null;

  thumbnail: string | null;

  images: string[] | null;

  variant_name: string | null;
  variant_value: string | null;

  quantity: number;

  unit_price: string;
  total_price: string;

  currency: string;

  fulfillment_status: string;

  /* RETURN */
  return_status: ReturnStatus | null;

  seller_message: string | null;
  seller_cancel_reason: string | null;

  tracking_code: string | null;
  shipping_provider: string | null;

  shipped_at: string | null;
  delivered_at: string | null;

  snapshot:
    | Record<string, unknown>
    | null;
};

/* =====================================================
   ORDER
===================================================== */

export type Order = {
  id: string;

  order_number: string;

  payment_status: PaymentStatus;

  fulfillment_status: OrderStatus;

  /* RETURN */
  return_status: ReturnStatus | null;

  total: string;
  currency: string;

  items_total: string;
  subtotal: string;
  discount: string;
  shipping_fee: string;
  tax: string;

  created_at: string;

  paid_at: string | null;

  fulfillment_started_at: string | null;
  processing_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;

  cancelled_at: string | null;
  cancel_reason: string | null;

  shipping_name: string;
  shipping_phone: string;
  shipping_address_line: string;

  shipping_ward: string | null;
  shipping_district: string | null;
  shipping_region: string | null;

  shipping_country: string;
  shipping_postal_code: string | null;

  shipping_provider: string | null;
  shipping_zone: string | null;

  buyer_note: string;
  admin_note: string;

  total_items: number;
  total_quantity: number;

  order_items: OrderItem[];
};

/* =====================================================
   API RESPONSE
===================================================== */

export type OrdersResponse = {
  orders?: Order[];
};

/* =====================================================
   CANCEL
===================================================== */

export const CANCEL_REASON_KEYS = [
  "cancel_reason_change_mind",
  "cancel_reason_wrong_product",
  "cancel_reason_change_variant",
  "cancel_reason_better_price",
  "cancel_reason_delivery_slow",
  "cancel_reason_update_address",
  "cancel_reason_other",
] as const;

export type CancelReasonKey =
  (typeof CANCEL_REASON_KEYS)[number];

/* =====================================================
   REVIEW
===================================================== */

export type ReviewedMap =
  Record<string, boolean>;

/* =====================================================
   RETURN HELPERS
===================================================== */

export const ACTIVE_RETURN_STATUSES: ReturnStatus[] = [
  "pending",
  "approved",
  "shipping_back",
  "received",
];

export const FINISHED_RETURN_STATUSES: ReturnStatus[] = [
  "refunded",
  "rejected",
];
