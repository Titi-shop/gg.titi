"use client";

import { formatPi } from "@/lib/pi";
import CustomerOrderActions from "./CustomerOrderActions";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import {
  ORDER_STATUS,
  type OrderStatus,
} from "@/constants/order-status";

/* =======================================================
   TYPES
======================================================= */

type OrderItem = {
  id?: string;
  product_id?: string;
  product_name?: string;
  thumbnail?: string | null;
  images?: string[] | null;
  quantity?: number;
  unit_price?: number;
  seller_message?: string | null;
  seller_cancel_reason?: string | null;
};

type Order = {
  id: string;
  order_number?: string | null;
  status: string;
  fulfillment_status?: OrderStatus;
  total?: number;
  order_items?: OrderItem[];
};

type Props = {
  order: Order;

  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
  onBuyAgain?: () => void;
  onReview?: () => void;

  reviewed?: boolean;
};

/* =======================================================
   NORMALIZE STATUS
======================================================= */

function normalizeStatus(status: string): OrderStatus {
  switch (status) {
    case ORDER_STATUS.PENDING:
    case ORDER_STATUS.PENDING_FULFILLMENT:
    case ORDER_STATUS.PROCESSING:
    case ORDER_STATUS.SHIPPED:
    case ORDER_STATUS.DELIVERED:
    case ORDER_STATUS.COMPLETED:
    case ORDER_STATUS.CANCELLED:
    case ORDER_STATUS.REFUNDED:
      return status;

    default:
      return ORDER_STATUS.PENDING;
  }
}

/* =======================================================
   COMPONENT
======================================================= */

export default function CustomerOrderCard({
  order,
  onDetail,
  onCancel,
  onReceived,
  onBuyAgain,
  onReview,
  reviewed = false,
}: Props) {
  const { t } = useTranslation();

  const items = order.order_items ?? [];
  console.log(
  "ORDER",
  order.id,
  order.status,
  order.fulfillment_status
);
  const status = normalizeStatus(
  order.fulfillment_status ??
  order.status ??
  ORDER_STATUS.PENDING
);

  return (
    <div
      className="
        overflow-hidden
        rounded-2xl
        border border-orange-500/20
        bg-[var(--card-bg)]
        shadow-sm
        transition-colors duration-300
      "
    >
      {/* HEADER */}
      <div
        className="
          flex items-center justify-between gap-3
          border-b border-orange-500/10
          bg-[var(--card-secondary)]
          px-4 py-3
          text-sm
        "
      >
        <span className="truncate font-semibold text-[var(--foreground)]">
          #{order.order_number ?? order.id.slice(0, 8)}
        </span>

        <span
          className="
            shrink-0 rounded-full
            border border-orange-500/30
            bg-orange-500/10
            px-2.5 py-1
            text-xs font-semibold
            text-orange-500
          "
        >
          {t[`order_${status}`] ?? status}
        </span>
      </div>

      {/* ITEMS */}
      <div className="divide-y divide-orange-500/10">
        {items.map((item, index) => {
          const image =
            item.thumbnail ||
            item.images?.[0] ||
            "/placeholder.png";

          return (
            <div
              key={item.id ?? `${order.id}-${index}`}
              className="flex gap-3 px-4 py-4"
            >
              {/* IMAGE */}
              <img
                src={image}
                alt={item.product_name ?? "Product"}
                loading="lazy"
                className="
                  h-16 w-16 shrink-0 rounded-xl
                  border border-orange-500/10
                  bg-[var(--card-secondary)]
                  object-cover
                "
              />

              {/* INFO */}
              <div className="min-w-0 flex-1">
                <p
                  className="
                    line-clamp-2
                    text-sm font-medium
                    text-[var(--foreground)]
                  "
                >
                  {item.product_name ?? "Product"}
                </p>

                {/* PRICE */}
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  x{item.quantity ?? 0} ·{" "}
                  <span className="font-semibold text-orange-500">
                    π{formatPi(Number(item.unit_price ?? 0))}
                  </span>
                </p>

                {/* SELLER MESSAGE */}
                {item.seller_message && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    💌 {item.seller_message}
                  </p>
                )}

                {/* CANCEL REASON */}
                {status === ORDER_STATUS.CANCELLED &&
                  item.seller_cancel_reason && (
                    <p className="mt-1 line-clamp-2 text-xs text-red-500">
                      {item.seller_cancel_reason}
                    </p>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div
        className="
          flex flex-col gap-3
          border-t border-orange-500/10
          bg-[var(--card-secondary)]
          px-4 py-3
          sm:flex-row sm:items-center sm:justify-between
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOTAL */}
        <span className="text-sm text-[var(--foreground)]">
          {t.total ?? "Total"}:{" "}
          <span
            className="
              inline-flex items-center
              rounded-full
              border border-orange-500/30
              bg-orange-500/10
              px-2 py-1
              font-bold
              text-orange-500
            "
          >
            π{formatPi(Number(order.total ?? 0))}
          </span>
        </span>

        {/* ACTIONS */}
        <CustomerOrderActions
          status={status}
          reviewed={reviewed}
          onDetail={onDetail}
          onCancel={onCancel}
          onReceived={onReceived}
          onReview={onReview}
        />
      </div>
    </div>
  );
}
