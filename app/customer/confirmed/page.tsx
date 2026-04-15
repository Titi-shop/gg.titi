"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useMemo } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useAuth } from "@/context/AuthContext";

/* ================= TYPES ================= */

type OrderStatus =
  | "pending"
  | "confirmed" 
  | "shipping"
  | "completed"
  | "cancelled"
  | "refunded";

interface OrderItem {
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
}

interface Order {
  id: string;
  order_number: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  order_items: OrderItem[];
}

/* ================= FETCHER ================= */

const fetcher = async (url: string) => {
  const token = await getPiAccessToken();
  if (!token) return [];

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.orders ?? [];
};

/* ================= PAGE ================= */

export default function CustomerPickupPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const { data: allOrders = [], isLoading } = useSWR(
    user ? "/api/orders" : null,
    fetcher
  );

  /* ================= FILTER ================= */

  const orders = useMemo(
  () => allOrders.filter((o: Order) => o.status === "confirmed"),
  [allOrders]
);

  const totalPi = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.total), 0),
    [orders]
  );

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="bg-orange-500 text-white px-4 py-4">
        <div className="bg-orange-400 rounded-lg p-4">
          <p className="text-sm">{t.order_info}</p>
          <p className="text-xs mt-1">
            {t.orders}: {orders.length} · π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mt-6 px-4">

        {isLoading || authLoading ? (
          <p className="text-center text-gray-400">
            {t.loading_orders}
          </p>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center mt-20 text-gray-400">
            <div className="w-24 h-24 bg-gray-200 rounded-full mb-4" />
            <p>{t.no_confirmed_orders}</p>
          </div>
        ) : (
          <div className="space-y-4">

            {orders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl shadow-sm">

                {/* HEADER */}
                <div className="flex justify-between px-4 py-3 border-b">
                  <span className="text-sm font-semibold">
                    #{o.order_number}
                  </span>
                  <span className="text-orange-500 text-sm">
                    {t.order_status_confirmed}
                  </span>
                </div>

                {/* PRODUCTS */}
                <div className="px-4 py-3 space-y-3">
                  {o.order_items?.map((item, idx) => (
                    <div key={idx} className="flex gap-3">

                      <img
                        src={item.thumbnail || "/placeholder.png"}
                        className="w-16 h-16 rounded object-cover border"
                      />

                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {item.product_name}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          x{item.quantity} · π{formatPi(item.unit_price)}
                        </p>

                        <p className="text-xs mt-1">
                          Status:{" "}
                          <span className="text-blue-500 font-medium">
                            {item.status}
                          </span>
                        </p>
                      </div>

                    </div>
                  ))}
                </div>

                {/* FOOTER */}

                   <div className="flex justify-between items-center px-4 py-3 border-t">

  <span className="text-sm font-semibold">
    {t.total}: π{formatPi(o.total)}
  </span>


                  <button
                    onClick={() =>
                      router.push(`/customer/orders/${o.id}`)
                    }
                    className="border px-3 py-1 text-xs rounded"
                  >
                    {t.order_detail ?? "Chi tiết"}
                  </button>

                </div>

              </div>
            ))}

          </div>
        )}

      </section>
    </main>
  );
}
