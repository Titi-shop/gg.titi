"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { formatPi } from "@/lib/pi";
import OrdersList, { Order } from "@/components/OrdersList";

/* ================= FETCHER ================= */

const fetcher = async (): Promise<Order[]> => {
  try {
    const res = await apiAuthFetch(
      "/api/seller/orders?status=shipping",
      { cache: "no-store" }
    );

    if (!res.ok) return [];

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((o: any): Order => ({
      id: String(o.id),
      order_number: String(o.order_number ?? ""),
      created_at: String(o.created_at ?? ""),
      status: "shipping",

      shipping_name: o.shipping_name ?? "",
      shipping_phone: o.shipping_phone ?? "",
      shipping_address: o.shipping_address_line ?? "",

      total: Number(o.total ?? 0),

      order_items: Array.isArray(o.order_items)
        ? o.order_items.map((i: any) => ({
            id: String(i.id),
            product_id: i.product_id ?? null,
            product_name: String(i.product_name ?? ""),
            thumbnail: String(i.thumbnail ?? ""),
            images: Array.isArray(i.images) ? i.images : [],
            quantity: Number(i.quantity ?? 0),
            unit_price: Number(i.unit_price ?? 0),
            total_price: Number(i.total_price ?? 0),
            status: "shipping",
          }))
        : [],
    }));
  } catch {
    return [];
  }
};

/* ================= PAGE ================= */

export default function SellerShippingOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const { data: orders = [], isLoading } = useSWR(
    !authLoading && user
      ? "/api/seller/orders?status=shipping"
      : null,
    fetcher
  );

  const totalPi = useMemo(
    () => orders.reduce((sum, o) => sum + o.total, 0),
    [orders]
  );

  if (isLoading || authLoading) {
    return (
      <p className="text-center mt-10 text-gray-400">
        {t.loading ?? "Loading..."}
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="bg-gray-600 text-white px-4 py-4">
        <div className="bg-gray-500 rounded-lg p-4">
          <p>{t.shipping_orders ?? "Shipping orders"}</p>
          <p className="text-xs">
            {t.orders}: {orders.length} · π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* LIST */}
      <OrdersList
        orders={orders}
        initialTab="shipping"
        onClick={(id) => router.push(`/seller/orders/${id}`)}
      />

    </main>
  );
}
