export const ORDER_STATUS = {
  PENDING: "pending",
  PENDING_FULFILLMENT: "pending_fulfillment",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  RETURNS: "returns",
} as const;

export type OrderStatus =
  (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/* ================= ACTIVE FLOW ================= */

export const ORDER_ACTIVE_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PENDING_FULFILLMENT,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
] as const;

/* ================= SHIPPING FLOW ================= */

export const ORDER_SHIPPING_STATUSES = [
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
] as const;

/* ================= FINISHED ================= */

export const ORDER_FINISHED_STATUSES = [
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUNDED,
] as const;

/* ================= GUARDS ================= */

export const isOrderStatus = (
  value: string
): value is OrderStatus => {
  return (Object.values(ORDER_STATUS) as string[]).includes(value);
};
