"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";

/* ================= TYPES ================= */

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled";

type OrderTab = "all" | OrderStatus;

interface OrderItem {
  product_id: number;
  product_name: string;
  thumbnail: string;
  images?: string[];
  unit_price: number;
  quantity: number;
  total_price: number;
  seller_message?: string | null;
  seller_cancel_reason?: string | null;
}

interface Order {
  id: string;
  order_number: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  order_items?: OrderItem[];
}

/* ================= FETCHER ================= */

const fetcher = async (): Promise<Order[]> => {
  try {
    const token = await getPiAccessToken();

    if (!token) return [];

    const res = await fetch("/api/orders", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data?.orders)
      ? data.orders
      : [];
  } catch {
    return [];
  }
};

/* ================= PAGE ================= */

export default function CustomerOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<OrderTab>("all");

  const {
    data: orders = [],
    isLoading,
  } = useSWR(
    user ? "/api/orders" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  /* ================= COUNTS ================= */

  const counts = useMemo(() => {
    const map: Record<OrderTab, number> = {
      all: orders.length,
      pending: 0,
      confirmed: 0,
      shipping: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const o of orders) {
      if (map[o.status] !== undefined) {
        map[o.status]++;
      }
    }

    return map;
  }, [orders]);

  /* ================= FILTER ================= */

  const filtered = useMemo(() => {
    if (tab === "all") return orders;
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  /* ================= TOTAL ================= */

  const totalPi = useMemo(
    () =>
      filtered.reduce(
        (sum, o) => sum + Number(o.total ?? 0),
        0
      ),
    [filtered]
  );

  /* ================= LABEL ================= */

  const tabLabel =
    {
      all: t.all_orders ?? "All Orders",
      pending: t.order_pending ?? "Pending",
      confirmed:
        t.order_confirmed ?? "Confirmed",
      shipping:
        t.order_shipping ?? "Shipping",
      completed:
        t.order_completed ?? "Completed",
      cancelled:
        t.order_cancelled ?? "Cancelled",
    }[tab] ?? "Orders";

  /* ================= LOADING ================= */

  if (isLoading || authLoading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 space-y-4">
        {Array.from({ length: 4 }).map(
          (_, i) => (
            <div
              key={i}
              className="h-28 bg-white rounded-xl animate-pulse"
            />
          )
        )}
      </main>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-orange-500 text-white shadow">

        <div className="px-4 py-4">
          <div className="bg-orange-400 rounded-xl px-4 py-3">
            <p className="text-sm font-medium">
              {tabLabel}
            </p>

            <p className="text-xs mt-1 opacity-90">
              {filtered.length} · π
              {formatPi(totalPi)}
            </p>
          </div>
        </div>

        {/* TABS */}
        <div className="bg-white text-sm text-gray-700 border-b overflow-x-auto whitespace-nowrap">
          <div className="flex min-w-max px-2">

            {[
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
            ].map(([key, label]) => {
              const active = tab === key;

              return (
                <button
                  key={key}
                  onClick={() =>
                    setTab(
                      key as OrderTab
                    )
                  }
                  className={`px-4 py-3 border-b-2 transition relative ${
                    active
                      ? "border-orange-500 text-orange-500 font-semibold"
                      : "border-transparent"
                  }`}
                >
                  {label}

                  <span className="ml-1 text-[11px]">
                    (
                    {
                      counts[
                        key as OrderTab
                      ]
                    }
                    )
                  </span>
                </button>
              );
            })}

          </div>
        </div>
      </header>

      {/* CONTENT */}
      <section className="p-4 space-y-4">

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">
            {t.no_orders ??
              "No orders"}
          </div>
        ) : (
          filtered.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-xl shadow-sm border overflow-hidden"
            >

              {/* TOP */}
              <div className="flex justify-between items-center px-4 py-3 border-b bg-gray-50 text-sm">

                <span className="font-medium">
                  #
                  {
                    o.order_number
                  }
                </span>

                <span className="text-orange-500 font-medium">
                  {t[
                    `order_${o.status}` as keyof typeof t
                  ] ??
                    o.status}
                </span>

              </div>

              {/* ITEMS */}
              <div className="divide-y">
                {o.order_items?.map(
                  (
                    item,
                    idx
                  ) => (
                    <div
                      key={
                        idx
                      }
                      className="flex gap-3 p-4"
                    >
                      <img
                        src={
                          item.thumbnail ||
                          item
                            .images?.[0] ||
                          "/placeholder.png"
                        }
                        alt={
                          item.product_name
                        }
                        className="w-16 h-16 rounded-lg object-cover bg-gray-100"
                      />

                      <div className="flex-1 min-w-0">

                        <p className="text-sm line-clamp-2">
                          {
                            item.product_name
                          }
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          x
                          {
                            item.quantity
                          }{" "}
                          · π
                          {formatPi(
                            item.unit_price
                          )}
                        </p>

                        {item.seller_message && (
                          <p className="text-xs text-green-600 mt-1 line-clamp-2">
                            💌{" "}
                            {
                              item.seller_message
                            }
                          </p>
                        )}

                        {item.seller_cancel_reason &&
                          o.status ===
                            "cancelled" && (
                            <p className="text-xs text-red-500 mt-1 line-clamp-2">
                              {
                                item.seller_cancel_reason
                              }
                            </p>
                          )}

                      </div>
                    </div>
                  )
                )}
              </div>

              {/* FOOTER */}
              <div className="px-4 py-3 border-t bg-gray-50">

                <div className="flex justify-between items-center gap-3">

                  <span className="text-sm">
                    {t.total ??
                      "Total"}
                    :{" "}
                    <b>
                      π
                      {formatPi(
                        o.total
                      )}
                    </b>
                  </span>

                  <div className="flex gap-2">

                    <button
                      onClick={() =>
                        router.push(
                          `/customer/orders/${o.id}`
                        )
                      }
                      className="px-3 py-1.5 text-sm border rounded-lg active:scale-95 transition"
                    >
                      {t.detail ??
                        "Detail"}
                    </button>

                    {o.status ===
                      "shipping" && (
                      <button
                        onClick={() =>
                          router.push(
                            `/customer/orders/${o.id}`
                          )
                        }
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg active:scale-95 transition"
                      >
                        {t.received ??
                          "Received"}
                      </button>
                    )}

                    {o.status ===
                      "completed" && (
                      <button
                        onClick={() =>
                          router.push(
                            `/customer/orders/${o.id}`
                          )
                        }
                        className="px-3 py-1.5 text-sm border border-orange-500 text-orange-500 rounded-lg active:scale-95 transition"
                      >
                        {t.buy_again ??
                          "Buy Again"}
                      </button>
                    )}

                  </div>

                </div>

              </div>

            </div>
          ))
        )}

      </section>
    </main>
  );
}
