"use client";

import { formatPi } from "@/lib/pi";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import CustomerOrderActions from "./CustomerOrderActions";

import {
  ORDER_STATUS,
  type OrderStatus,
} from "@/constants/order-status";

import type {
  BuyerOrderRow,
  BuyerOrderItemRow,
  ReturnStatus,
} from "@/types/orders";

/* =======================================================
   TYPES
======================================================= */

type Props = {
  order: BuyerOrderRow;

  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
  onBuyAgain?: () => void;
  onReview?: () => void;

  reviewed?: boolean;
};

/* =======================================================
   DISPLAY STATUS
======================================================= */

function getDisplayStatus(
  order: BuyerOrderRow
): OrderStatus | `return_${ReturnStatus}` {
  if (order.return_status) {
    return `return_${order.return_status}`;
  }

  return order.fulfillment_status;
}

/* =======================================================
   ITEM ROW
======================================================= */

function OrderItemRow({
  item,
  orderId,
  index,
  status,
}: {
  item: BuyerOrderItemRow;
  orderId: string;
  index: number;
  status: string;
}) {
  const image =
    item.thumbnail ||
    (Array.isArray(item.images)
      ? String(item.images[0] ?? "")
      : "") ||
    "/placeholder.png";

  return (
    <div
      className="
        flex gap-3
        px-4 py-4
      "
    >
      <img
        src={image}
        alt={
          item.product_name ??
          "Product"
        }
        loading="lazy"
        className="
          h-16 w-16 shrink-0
          rounded-xl
          border border-orange-500/10
          bg-[var(--card-secondary)]
          object-cover
        "
      />

      <div className="min-w-0 flex-1">
        <p
          className="
            line-clamp-2
            text-sm font-medium
            text-[var(--foreground)]
          "
        >
          {item.product_name ??
            "Product"}
        </p>

        <p className="mt-1 text-xs text-[var(--text-muted)]">
          x{item.quantity}
          {" · "}
          <span className="font-semibold text-orange-500">
            π
            {formatPi(
              Number(item.unit_price)
            )}
          </span>
        </p>

        {item.seller_message && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            💌 {item.seller_message}
          </p>
        )}

        {status ===
          ORDER_STATUS.CANCELLED &&
          item.seller_cancel_reason && (
            <p className="mt-1 line-clamp-2 text-xs text-red-500">
              {
                item.seller_cancel_reason
              }
            </p>
          )}
      </div>
    </div>
  );
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

  const status =
    getDisplayStatus(order);

  const items =
    order.order_items ?? [];

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
          #
          {order.order_number ||
            order.id.slice(0, 8)}
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
          {t[`order_${status}`] ??
            status}
        </span>
      </div>

      {/* ITEMS */}

      <div className="divide-y divide-orange-500/10">
        {items.map(
          (item, index) => (
            <OrderItemRow
              key={
                item.id ??
                `${order.id}-${index}`
              }
              item={item}
              orderId={order.id}
              index={index}
              status={status}
            />
          )
        )}
      </div>

      {/* FOOTER */}

      <div
        className="
          flex flex-col gap-3
          border-t border-orange-500/10
          bg-[var(--card-secondary)]
          px-4 py-3
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
        onClick={(e) =>
          e.stopPropagation()
        }
      >
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
            π
            {formatPi(
              Number(order.total)
            )}
          </span>
        </span>

        <CustomerOrderActions
          status={
            order.fulfillment_status
          }
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
