"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import CustomerOrdersList from "@/components/CustomerOrdersList";

/* ================= FETCHER ================= */

const fetcher = async () => {
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
    return data.orders ?? [];
  } catch {
    return [];
  }
};

export default function CustomerOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, loading } = useAuth();

  const {
    data: orders = [],
    isLoading,
  } = useSWR(
    user ? "/api/orders" : null,
    fetcher
  );

  const totalPi = useMemo(
    () =>
      orders.reduce(
        (sum: number, o: any) =>
          sum +
          Number(o.total ?? 0),
        0
      ),
    [orders]
  );

  if (loading || isLoading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 space-y-4">
        {Array.from({
          length: 4,
        }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-white rounded-xl animate-pulse"
          />
        ))}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="bg-orange-500 text-white px-4 py-4 shadow">
        <div className="bg-orange-400 rounded-xl p-4">
          <p className="text-sm">
            {t.orders ??
              "Orders"}
          </p>

          <p className="text-xs mt-1">
            {orders.length} · π
            {formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* LIST */}
      <CustomerOrdersList
        orders={orders}
        onDetail={(id) =>
          router.push(
            `/customer/orders/${id}`
          )
        }
      />
    </main>
  );
}
