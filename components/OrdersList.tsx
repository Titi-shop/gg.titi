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
  | "confirmed"
  | "shipping"
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
      "confirmed",
      t.confirmed_orders ??
        "Confirmed",
    ],
    [
      "shipping",
      t.shipping_orders ??
        "Shipping",
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
      confirmed: 0,
      shipping: 0,
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
      {/* TABS */}
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="flex gap-5 px-4 py-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {tabs.map(
            ([key, label]) => {
              const active =
                tab === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    handleTabChange(
                      key
                    )
                  }
                  className={`min-w-fit pb-2 border-b-2 transition text-sm ${
                    active
                      ? "border-black text-black font-semibold"
                      : "border-transparent text-gray-400"
                  }`}
                >
                  <div>
                    {label}
                  </div>

                  <div className="text-[11px] mt-1 text-center">
                    {
                      counts[
                        key
                      ]
                    }
                  </div>
                </button>
              );
            }
          )}
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
