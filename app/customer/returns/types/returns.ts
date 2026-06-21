export type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refund_pending"
  | "refunded"
  | "rejected"
  | "cancelled";

export type ReturnRecord = {
  id: string;

  return_number?: string | null;

  order_id: string;

  status: ReturnStatus;

  refund_amount?: string | number | null;

  created_at?: string | null;

  refunded_at?: string | null;

  return_tracking_code?: string | null;

  thumbnail?: string | null;

  product_name?: string | null;
};

export type ReturnDetail = {
  id: string;

  return_number: string;

  status: ReturnStatus;

  reason: string;

  description?: string | null;

  refund_amount?: number;

  created_at?: string;

  evidence_images?: string[];

  items: ReturnItem[];

  timeline?: ReturnTimelineItem[];

  return_tracking_code?: string | null;
};

export type ReturnItem = {
  product_name: string;

  thumbnail: string;

  quantity: number;

  unit_price: number;
};

export type ReturnTimelineItem = {
  label: string;

  time: string;
};
