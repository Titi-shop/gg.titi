"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import { useAuth } from "@/context/AuthContext";
import useSWR from "swr";
import Image from "next/image";

const fetcher = (url: string) =>
  apiAuthFetch(url, { cache: "no-store" }).then((res) =>
    res.ok ? res.json() : []
  );

/* ================= TYPES ================= */

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "returned"
  | "cancelled";

interface OrderItem {
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

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;
  shipping_provider?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;
  total: number;
  order_items: OrderItem[];
}

type OrderTab = "all" | OrderStatus;

/* ================= HELPERS ================= */

function formatDate(date: string): string {
  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "—";
  }

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/* ================= PAGE ================= */

export default function SellerOrdersPage() {

  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<OrderTab>("all");
  const { data: orders = [], isLoading } = useSWR(
  user ? "/api/seller/orders" : null,
  fetcher,
  {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  }
);

  /* ================= LOAD ================= */

  

  /* ================= FILTER ================= */

  const filteredOrders = useMemo(() => {

    if (activeTab === "all") return orders;

    return orders.filter((o) =>
      o.order_items?.some(
        (i) => i.status === activeTab
      )
    );

  }, [orders, activeTab]);

  /* ================= COUNT ================= */

    
  /* ================= TOTAL ================= */

  const totalPi = useMemo(
    () =>
      filteredOrders.reduce(
        (sum, o) => sum + Number(o.total ?? 0),
        0
      ),
    [filteredOrders]
  );
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
    const seen = new Set<OrderStatus>();

    for (const i of o.order_items ?? []) {
      if (!seen.has(i.status)) {
        map[i.status]++;
        seen.add(i.status);
      }
    }
  }

  return map;
}, [orders]);
const goDetail = useCallback(
  (id: string) => {
    router.push(`/seller/orders/${id}`);
  },
  [router]
);
  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}

      <header className="bg-gray-600 text-white px-4 py-4">
        <div className="bg-gray-500 rounded-lg p-4">

          <p className="text-sm opacity-90">
            {t.shop_orders ?? "Shop Orders"}
          </p>

          <p className="text-xs opacity-80 mt-1">
            {t.orders ?? "Orders"}: {filteredOrders.length} · π
            {formatPi(totalPi)}
          </p>

        </div>
      </header>

      {/* TABS */}

      <div className="bg-white border-b">

        <div className="flex gap-6 px-4 py-3 text-sm overflow-x-auto whitespace-nowrap">

          {([
            ["all", t.all ?? "All"],
            ["pending", t.pending_orders ?? "Pending"],
            ["confirmed", t.confirmed_orders ?? "Confirmed"],
            ["shipping", t.shipping_orders ?? "Shipping"],
            ["completed", t.completed_orders ?? "Completed"],
            ["returned", t.returned_orders ?? "Returned"],
            ["cancelled", t.cancelled_orders ?? "Cancelled"],
          ] as [OrderTab, string][])

          .map(([key, label]) => (

            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-2 border-b-2 ${
                activeTab === key
                  ? "border-gray-700 text-gray-700 font-semibold"
                  : "border-transparent text-gray-500"
              }`}
            >

              {label}

              <div className="text-xs mt-1 text-center">
                {counts[key]}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}

      <section className="px-4 mt-4 space-y-4">

{isLoading ? (
  Array.from({ length: 5 }).map((_, i) => (
    <div
      key={i}
      className="bg-white rounded-xl p-4 animate-pulse space-y-3"
    >
      <div className="h-4 bg-gray-200 w-1/3 rounded" />
      <div className="h-3 bg-gray-200 w-1/2 rounded" />
      <div className="h-14 bg-gray-200 rounded" />
    </div>
  ))
) : filteredOrders.length === 0 ? (
  <p className="text-center text-gray-400">
    {t.no_orders ?? "No orders"}
  </p>
) : (
  filteredOrders.map((o) => (
    <div
      key={o.id}
      onClick={() => goDetail(o.id)}
      className="bg-white rounded-xl shadow-sm border overflow-hidden"
    >
      {/* HEADER */}
      <div className="flex justify-between px-4 py-3 border-b bg-gray-50">
        <div>
          <p className="font-semibold text-sm">
            #{o.order_number}
          </p>
          <p className="text-xs text-gray-500">
            {formatDate(o.created_at)}
          </p>
        </div>
      </div>

      {/* BUYER */}
      {(o.shipping_name || o.shipping_phone || o.shipping_address) && (
        <div className="px-4 py-3 text-sm border-b space-y-1">
          <p>
            <span className="text-gray-500">
              {t.customer ?? "Customer"}:
            </span>{" "}
            {o.shipping_name ?? "—"}
          </p>
        </div>
      )}

      {/* PRODUCTS */}
      <div className="divide-y">
        {o.order_items?.map((item) => (
          <div key={item.id} className="flex gap-3 p-4">
            <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden">
              <Image
                src={item.thumbnail || "/placeholder.png"}
                alt={item.product_name}
                width={56}
                height={56}
                className="object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">
                {item.product_name}
              </p>
              <p className="text-xs text-gray-500">
                x{item.quantity} · π{formatPi(item.unit_price)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="px-4 py-3 border-t bg-gray-50 text-sm">
        <span className="font-semibold">
          {t.total ?? "Total"}: π{formatPi(Number(o.total ?? 0))}
        </span>
      </div>
    </div>
  ))
)}

      </section>

    </main>
  );
}
