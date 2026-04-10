"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { formatPi } from "@/lib/pi";

/* ================= TYPES ================= */

interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  thumbnail?: string;
  images?: string[];

  quantity: number;
  unit_price: number | string;
  total_price: number | string;
}

interface Order {
  id: string;
  order_number?: string;

  status: string;
  total: number | string;

  created_at?: string;

  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;

  shipping_provider?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;

  order_items: OrderItem[];
}

/* ================= FETCHER ================= */

const fetcher = async (): Promise<Order[]> => {
  try {
    const res = await apiAuthFetch(
      "/api/seller/orders?status=shipping",
      { cache: "no-store" }
    );

    if (!res.ok) return [];

    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as Order[]) : [];
  } catch {
    return [];
  }
};

/* ================= HELPERS ================= */

function formatDate(date?: string): string {
  if (!date) return "—";

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/* ================= PAGE ================= */

export default function SellerShippingOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  /* ================= SWR ================= */

  const {
    data: orders = [],
    isLoading,
    mutate,
  } = useSWR(
    !authLoading && user
      ? "/api/seller/orders?status=shipping"
      : null,
    fetcher
  );

  const [processingId, setProcessingId] = useState<string | null>(null);

  /* ================= TOTAL ================= */

  const totalPi = useMemo(
    () =>
      orders.reduce(
        (sum, o) => sum + Number(o.total ?? 0),
        0
      ),
    [orders]
  );

  /* ================= COMPLETE (OPTIMISTIC) ================= */

  async function markDelivered(orderId: string) {
    try {
      setProcessingId(orderId);

      const previous = orders;

      // 🚀 optimistic remove khỏi shipping list
      await mutate(
        orders.filter((o) => o.id !== orderId),
        false
      );

      const res = await apiAuthFetch(
        `/api/seller/orders/${orderId}/complete`,
        { method: "PATCH" }
      );

      if (!res.ok) {
        // 🔴 rollback nếu fail
        await mutate(previous, false);
        return;
      }

      mutate(); // sync lại server
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= LOADING ================= */

  if (isLoading || authLoading) {
    return (
      <p className="text-center mt-10 text-gray-400">
        {t.loading ?? "Loading..."}
      </p>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="bg-gray-600 text-white px-4 py-4">
        <div className="bg-gray-500 rounded-lg p-4">
          <p className="text-sm opacity-90">
            {t.shipping_orders ?? "Shipping orders"}
          </p>

          <p className="text-xs opacity-80 mt-1">
            {t.orders ?? "Orders"}: {orders.length} · π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* LIST */}
      <section className="mt-6 px-4 space-y-4">

        {orders.length === 0 ? (
          <p className="text-center text-gray-400">
            {t.no_shipping_orders ?? "No shipping orders"}
          </p>
        ) : (
          orders.map((order) => (

            <div
              key={order.id}
              onDoubleClick={() =>
                router.push(`/seller/orders/${order.id}`)
              }
              className="bg-white rounded-xl shadow-sm overflow-hidden border"
            >

              {/* HEADER */}
              <div className="flex justify-between px-4 py-3 border-b bg-gray-50">

                <div>
                  <p className="font-semibold text-sm">
                    #{order.order_number ?? order.id.slice(0, 8)}
                  </p>

                  <p className="text-xs text-gray-500">
                    {formatDate(order.created_at)}
                  </p>
                </div>

                <span className="text-blue-600 text-sm font-medium">
                  {t.status_shipping ?? "Shipping"}
                </span>

              </div>

              {/* SHIPPING */}
              <div className="px-4 py-3 text-sm space-y-1 border-b">

                <p>
                  <span className="text-gray-500">
                    {t.customer ?? "Customer"}:
                  </span>{" "}
                  {order.shipping_name}
                </p>

                <p>
                  <span className="text-gray-500">
                    {t.phone ?? "Phone"}:
                  </span>{" "}
                  {order.shipping_phone}
                </p>

                <p className="text-gray-600 text-xs">
                  {order.shipping_address}
                </p>

              </div>

              {/* PRODUCTS */}
              <div className="divide-y">

                {order.order_items.map((item) => (

                  <div key={item.id} className="flex gap-3 p-4">

                    <img
                      src={
                        item.thumbnail ??
                        item.images?.[0] ??
                        "/placeholder.png"
                      }
                      alt={item.product_name}
                      className="w-14 h-14 rounded-lg object-cover bg-gray-100"
                    />

                    <div className="flex-1 min-w-0">

                      <p className="text-sm font-medium line-clamp-1">
                        {item.product_name}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        x{item.quantity} · π{formatPi(Number(item.unit_price))}
                      </p>

                    </div>

                  </div>

                ))}

              </div>

              {/* FOOTER */}
              <div
                className="px-4 py-3 border-t bg-gray-50"
                onClick={(e) => e.stopPropagation()}
              >

                <div className="flex justify-between items-center">

                  <span className="font-semibold">
                    {t.total ?? "Total"}: π{formatPi(Number(order.total ?? 0))}
                  </span>

                  <button
                    disabled={processingId === order.id}
                    onClick={() => markDelivered(order.id)}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {t.mark_delivered ?? "Delivered"}
                  </button>

                </div>

              </div>

            </div>

          ))
        )}

      </section>
    </main>
  );
}
