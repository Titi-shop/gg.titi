"use client";

import { useMemo, useState } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import OrderCard from "./OrderCard";

/* ================= TYPES ================= */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "returned"
  | "cancelled";

export type OrderTab = "all" | OrderStatus;

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

/* ================= PROPS ================= */

type Props = {
  orders: Order[];
  onClick: (id: string) => void;
  initialTab?: OrderTab;

  renderActions?: (order: Order) => React.ReactNode;
  renderExtra?: (order: Order) => React.ReactNode; // ✅ THÊM DÒNG NÀY
  onTabChange?: (tab: OrderTab) => void;
};

/* ================= COMPONENT ================= */

export default function OrdersList({
  orders,
  onClick,
  initialTab = "all",
  renderActions,
  renderExtra, // ✅ THÊM DÒNG NÀY
}: Props) {
  const { t } = useTranslation();

  const [tab, setTab] = useState<OrderTab>(initialTab);

  /* ================= FILTER ================= */

  const filtered = useMemo(() => {
    if (tab === "all") return orders;
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  /* ================= COUNT ================= */

  const counts = useMemo(() => {
    const map: Record<OrderTab, number> = {
      all: orders.length,
      pending: 0,
      confirmed: 0,
      shipping: 0,
      completed: 0,
      returned: 0,
      cancelled: 0,
    };

    for (const o of orders) {
      if (map[o.status] !== undefined) {
        map[o.status]++;
      }
    }

    return map;
  }, [orders]);

  /* ================= TABS ================= */

  const tabs: [OrderTab, string][] = [
    ["all", t.all ?? "All"],
    ["pending", t.pending_orders ?? "Pending"],
    ["confirmed", t.confirmed_orders ?? "Confirmed"],
    ["shipping", t.shipping_orders ?? "Shipping"],
    ["completed", t.completed_orders ?? "Completed"],
    ["returned", t.returned_orders ?? "Returned"],
    ["cancelled", t.cancelled_orders ?? "Cancelled"],
  ];

  /* ================= UI ================= */

  return (
    <div>

      {/* TABS */}
      <div className="bg-white border-b">
        <div className="flex gap-6 px-4 py-3 text-sm overflow-x-auto whitespace-nowrap">
          {tabs.map(([key, label]) => (
            <button
  key={key}
  onClick={() => {
    setTab(key);
    onTabChange?.(key);
  }}
  className={`pb-2 border-b-2 transition ${
    tab === key
      ? "border-black font-semibold"
      : "border-transparent text-gray-400"
  }`}
>
              {label}

              <div className="text-xs text-center mt-1">
                {counts[key]}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div className="p-4 space-y-4">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400">
            {t.no_orders ?? "No orders"}
          </p>
        ) : (
          filtered.map((order) => (
  <div key={order.id}>
    <OrderCard
      order={order}
      onClick={() => onClick(order.id)}
      actions={renderActions?.(order)}
    />

    {/* ✅ THÊM DÒNG NÀY */}
    {renderExtra?.(order)}
  </div>
))
        )}
      </div>

    </div>
  );
}
