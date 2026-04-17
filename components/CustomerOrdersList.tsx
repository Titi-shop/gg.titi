"use client";

import { useMemo, useState } from "react";
import CustomerOrderCard from "./CustomerOrderCard";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type Props = {
  orders: any[];
  onDetail: (id: string) => void;
};

export default function CustomerOrdersList({
  orders,
  onDetail,
}: Props) {
  const { t } = useTranslation();

  const [tab, setTab] = useState("all");

  const tabs = [
    ["all", t.all ?? "All"],
    [
      "pending",
      t.order_pending ?? "Pending",
    ],
    [
      "confirmed",
      t.order_confirmed ??
        "Confirmed",
    ],
    [
      "shipping",
      t.order_shipping ??
        "Shipping",
    ],
    [
      "completed",
      t.order_completed ??
        "Completed",
    ],
    [
      "cancelled",
      t.order_cancelled ??
        "Cancelled",
    ],
  ];

  const counts = useMemo(() => {
    const map: any = {
      all: orders.length,
      pending: 0,
      confirmed: 0,
      shipping: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const o of orders) {
      map[o.status]++;
    }

    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    if (tab === "all") return orders;
    return orders.filter(
      (o) => o.status === tab
    );
  }, [orders, tab]);

  return (
    <>
      {/* TABS */}
      <div className="bg-white border-b sticky top-0 z-10 overflow-x-auto whitespace-nowrap">
        <div className="flex min-w-max px-2">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() =>
                setTab(key)
              }
              className={`px-4 py-3 border-b-2 text-sm ${
                tab === key
                  ? "border-orange-500 text-orange-500 font-semibold"
                  : "border-transparent text-gray-500"
              }`}
            >
              {label} (
              {counts[key]})
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div className="p-4 space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">
            {t.no_orders ??
              "No orders"}
          </div>
        ) : (
          filtered.map((order) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              onDetail={() =>
                onDetail(order.id)
              }
            />
          ))
        )}
      </div>
    </>
  );
}
