"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import CustomerOrderCard from "./CustomerOrderCard";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import {
  ORDER_STATUS,
  type OrderStatus,
} from "@/constants/order-status";

import type { Order } from "@/app/customer/orders/types";

/* =======================================================
   TYPES
======================================================= */

type OrderTab = OrderStatus | "all";

/* =======================================================
   TABS
======================================================= */

const VALID_TABS: OrderTab[] = [
  "all",

  ORDER_STATUS.PENDING,
  ORDER_STATUS.PENDING_FULFILLMENT,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUNDED,
];

/* =======================================================
   PROPS
======================================================= */

type Props = {
  orders: Order[];

  initialTab?: OrderTab;

  reviewedMap?: Record<string, boolean>;

  onDetail: (id: string) => void;
  onCancel?: (id: string) => void;
  onReceived?: (id: string) => void;
  onBuyAgain?: (id: string) => void;
  onReview?: (id: string) => void;
};

/* =======================================================
   WRAPPER
======================================================= */

export default function CustomerOrdersList(
  props: Props
) {
  return (
    <Suspense
      fallback={
        <div className="p-4">
          <div className="h-12 animate-pulse rounded-xl bg-[var(--card-bg)]" />
        </div>
      }
    >
      <Inner {...props} />
    </Suspense>
  );
}

/* =======================================================
   INNER
======================================================= */

function Inner({
  orders,
  initialTab = "all",

  reviewedMap,

  onDetail,
  onCancel,
  onReceived,
  onBuyAgain,
  onReview,
}: Props) {
  const { t } = useTranslation();

  const searchParams =
    useSearchParams();

  const urlTab =
    searchParams.get("tab") as
      | OrderTab
      | null;

  const safeTab: OrderTab =
    urlTab &&
    VALID_TABS.includes(urlTab)
      ? urlTab
      : initialTab;

  const [tab, setTab] =
    useState<OrderTab>(safeTab);

  useEffect(() => {
    setTab(safeTab);
  }, [safeTab]);

  /* =====================================================
     LABELS
  ===================================================== */

  const tabs: Array<
    [OrderTab, string]
  > = [
    [
      "all",
      t.all ?? "All",
    ],

    [
      ORDER_STATUS.PENDING,
      t.order_pending ??
        "Pending",
    ],

    [
      ORDER_STATUS.PENDING_FULFILLMENT,
      t.order_paid ??
        "Paid",
    ],

    [
      ORDER_STATUS.PROCESSING,
      t.order_processing ??
        "Processing",
    ],

    [
      ORDER_STATUS.SHIPPED,
      t.order_shipped ??
        "Shipped",
    ],

    [
      ORDER_STATUS.DELIVERED,
      t.order_delivered ??
        "Delivered",
    ],

    [
      ORDER_STATUS.COMPLETED,
      t.order_completed ??
        "Completed",
    ],

    [
      ORDER_STATUS.CANCELLED,
      t.order_cancelled ??
        "Cancelled",
    ],

    [
      ORDER_STATUS.REFUNDED,
      t.order_refunded ??
        "Refunded",
    ],
  ];

  /* =====================================================
     COUNTS
  ===================================================== */

  const counts = useMemo(() => {
    const map: Record<
      OrderTab,
      number
    > = {
      all: orders.length,

      pending: 0,
      pending_fulfillment: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
      refunded: 0,
    };

    for (const order of orders) {
      const status =
        order.fulfillment_status ??
        ORDER_STATUS.PENDING;

      map[status] =
        (map[status] ?? 0) + 1;
    }

    return map;
  }, [orders]);

  /* =====================================================
     FILTER
  ===================================================== */

  const filteredOrders =
    useMemo(() => {
      if (tab === "all") {
        return orders;
      }

      return orders.filter(
        order =>
          (
            order.fulfillment_status ??
            ORDER_STATUS.PENDING
          ) === tab
      );
    }, [orders, tab]);

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="sticky top-0 z-20 overflow-x-auto scrollbar-hide border-b border-orange-500/20 bg-[var(--background)]">
        <div className="flex min-w-max gap-2 px-3 py-2">
          {tabs.map(
            ([key, label]) => {
              const active =
                tab === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setTab(key)
                  }
                  className={`
                    shrink-0
                    rounded-xl
                    border
                    px-4
                    py-2
                    text-sm
                    font-medium
                    transition-all

                    ${
                      active
                        ? `
                          border-orange-500
                          bg-[var(--card-bg)]
                          text-orange-500
                        `
                        : `
                          border-orange-500/20
                          bg-[var(--card-bg)]
                          text-[var(--foreground)]
                        `
                    }
                  `}
                >
                  {label}
                  {" ("}
                  {counts[key]}
                  {")"}
                </button>
              );
            }
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {filteredOrders.length ===
        0 ? (
          <div className="rounded-2xl border border-orange-500/20 bg-[var(--card-bg)] p-8 text-center text-sm text-[var(--text-muted)]">
            {t.no_orders ??
              "No orders"}
          </div>
        ) : (
          filteredOrders.map(
            order => (
              <CustomerOrderCard
                key={order.id}
                order={order}
                reviewed={
                  reviewedMap?.[
                    order.id
                  ] ?? false
                }
                onDetail={() =>
                  onDetail(order.id)
                }
                onCancel={() =>
                  onCancel?.(
                    order.id
                  )
                }
                onReceived={() =>
                  onReceived?.(
                    order.id
                  )
                }
                onBuyAgain={() =>
                  onBuyAgain?.(
                    order.id
                  )
                }
                onReview={() =>
                  onReview?.(
                    order.id
                  )
                }
              />
            )
          )
        )}
      </div>
    </div>
  );
      }
