"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import OrderCard from "./OrderCard";

/* ======================================================
   TYPES
====================================================== */

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "returned"
  | "cancelled";

export type OrderTab =
  | "all"
  | OrderStatus;

export interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  thumbnail: string;
  images: string[] | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: OrderStatus;
}

export interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: OrderStatus;

  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;

  total: number;
  order_items: OrderItem[];
}

/* ======================================================
   PROPS
====================================================== */

type Props = {
  orders: Order[];
  onClick: (id: string) => void;

  initialTab?: OrderTab;
  onTabChange?: (tab: OrderTab) => void;

  renderActions?: (
    order: Order
  ) => React.ReactNode;

  renderExtra?: (
    order: Order
  ) => React.ReactNode;
};

/* ======================================================
   COMPONENT
====================================================== */

export default function OrdersList({
  orders,
  onClick,
  initialTab = "all",
  onTabChange,
  renderActions,
  renderExtra,
}: Props) {
  const { t } = useTranslation();

  /* ======================================================
     TAB STATE
  ====================================================== */

  const [tab, setTab] =
    useState<OrderTab>(
      initialTab
    );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  /* ======================================================
     TABS
  ====================================================== */

  const tabs: Array<
    [OrderTab, string]
  > = [
    [
      "all",
      t.all ?? "All",
    ],
    [
      "pending",
      t.pending_orders ??
        "Pending",
    ],
    [
      "processing",
      t.processing_orders ??
        "processing",
    ],
    [
      "shipped",
      t.shipped_orders ??
        "Shipped",
    ],
    [
      "delivered",
      t.delivered_orders??
        "delivered",
      ],
    [
      "completed",
      t.completed_orders ??
        "Completed",
    ],
    [
      "returned",
      t.returned_orders ??
        "Returned",
    ],
    [
      "cancelled",
      t.cancelled_orders ??
        "Cancelled",
    ],
  ];

  /* ======================================================
     COUNTS
  ====================================================== */

  const counts = useMemo(() => {
    const map: Record<
      OrderTab,
      number
    > = {
      all: orders.length,
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      completed: 0,
      returned: 0,
      cancelled: 0,
    };

    for (const order of orders) {
      if (
        typeof map[
          order.status
        ] === "number"
      ) {
        map[
          order.status
        ] += 1;
      }
    }

    return map;
  }, [orders]);

  /* ======================================================
     FILTERED
  ====================================================== */

  const filtered = useMemo(() => {
    if (tab === "all") {
      return orders;
    }

    return orders.filter(
      (order) =>
        order.status === tab
    );
  }, [orders, tab]);

  /* ======================================================
     HANDLER
  ====================================================== */

  function handleTabChange(
    nextTab: OrderTab
  ) {
    setTab(nextTab);
    onTabChange?.(nextTab);
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <section className="w-full">
    
       {/* ================= TABS ================= */}
<div className="sticky top-0 z-20 overflow-x-auto scrollbar-hide border-b border-orange-500/20 bg-white">
  <div className="flex min-w-max gap-2 px-3 py-2">
    {tabs.map(([key, label]) => {
      const active = tab === key;

      return (
        <button
  key={key}
  type="button"
  onClick={() => handleTabChange(key)}
  className={`
    shrink-0
    flex items-center gap-2
    rounded-xl
    border
    px-4 py-2
    text-sm font-medium
    transition-all

    ${
      active
        ? "border-orange-500 bg-orange-50 text-orange-600"
        : "border-gray-200 bg-white text-gray-600"
    }
  `}
>
  <span>{label}</span>

  <span
    className={`
      rounded-full
      px-2 py-0.5
      text-xs

      ${
        active
          ? "bg-orange-500 text-white"
          : "bg-gray-100 text-gray-500"
      }
    `}
  >
    {counts[key]}
  </span>
</button>
      );
    })}
  </div>
</div>

      {/* LIST */}
      <div className="p-4 space-y-4">
        {filtered.length ===
        0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center text-sm text-gray-400">
            {t.no_orders ??
              "No orders"}
          </div>
        ) : (
          filtered.map(
            (order) => (
              <div
                key={
                  order.id
                }
                className="space-y-3"
              >
                <OrderCard
                  order={
                    order
                  }
                  onClick={() =>
                    onClick(
                      order.id
                    )
                  }
                  actions={renderActions?.(
                    order
                  )}
                />

                {renderExtra?.(
                  order
                )}
              </div>
            )
          )
        )}
      </div>
    </section>
  );
}
