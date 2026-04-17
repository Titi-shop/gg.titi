"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
import useSWR from "swr";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import {
  PackagePlus,
  Package,
  ClipboardList,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  RotateCcw,
  XCircle,
} from "lucide-react";

/* ================= PAGE ================= */

function SellerOrdersContent() {
  const { t } = useTranslation();
  const { user, loading, piReady } = useAuth();

  // ✅ 1. khai báo trước
  const isSeller = user?.role === "seller";

  // ✅ 2. fetcher trước
  const fetcher = (url: string) =>
    apiAuthFetch(url, { cache: "no-store" }).then((res) =>
      res.ok ? res.json() : null
    );

  // ✅ 3. SWR sau
  const { data, isLoading } = useSWR(
    isSeller && piReady ? "/api/seller/orders/count" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  // ✅ 4. stats sau cùng
  const stats = useMemo(
    () => ({
      pending: data?.pending ?? 0,
      confirmed: data?.confirmed ?? 0,
      shipping: data?.shipping ?? 0,
      completed: data?.completed ?? 0,
      returned: data?.returned ?? 0,
      cancelled: data?.cancelled ?? 0,
      total: data?.total ?? 0,
    }),
    [data]
  );
  

  if (loading || !piReady) {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-24 bg-gray-200 rounded-xl animate-pulse"
        />
      ))}
    </main>
  );
}

  if (!isSeller) {
    return (
      <div className="flex justify-center mt-16 text-gray-500 text-sm">
        {t.no_permission ?? "No permission"}
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8 bg-gray-100 min-h-screen">

      {/* HEADER */}
      <div className="bg-gray-200 border border-gray-300 rounded-xl p-4">
        <h1 className="text-lg font-semibold text-gray-800">
          🏪 {t.seller_dashboard ?? "Seller Dashboard"}
        </h1>
      </div>

      {/* MAIN ACTIONS */}
      <section className="grid grid-cols-3 gap-4">
        <MainCard
          href="/seller/post"
          icon={<PackagePlus size={18} />}
          label={t.post_product ?? "Post Product"}
        />

        <MainCard
          href="/seller/stock"
          icon={<Package size={18} />}
          label={t.stock ?? "Stock"}
        />

        <MainCard
          href="/seller/orders"
          icon={<ClipboardList size={18} />}
          label={t.all_orders ?? "All Orders"}
          badge={stats.total}
        />
      </section>

      {/* ORDER STATUS */}
      <section>
        <div className="bg-gray-200 border border-gray-300 rounded-xl p-3 mb-4">
          <h2 className="text-xs font-semibold text-gray-700 tracking-wide">
            {t.order_status ?? "ORDER STATUS"}
          </h2>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <StatusCard
  href="/seller/orders?tab=pending"
  icon={<Clock size={16} />}
  count={stats.pending}
  label={t.pending_orders ?? "Pending"}
/>

<StatusCard
  href="/seller/orders?tab=confirmed"
  icon={<CheckCircle2 size={16} />}
  count={stats.confirmed}
  label={t.confirmed_orders ?? "Confirmed"}
/>

<StatusCard
  href="/seller/orders?tab=shipping"
  icon={<Truck size={16} />}
  count={stats.shipping}
  label={t.shipping_orders ?? "Shipping"}
/>

<StatusCard
  href="/seller/orders?tab=completed"
  icon={<PackageCheck size={16} />}
  count={stats.completed}
  label={t.completed_orders ?? "Completed"}
/>

<StatusCard
  href="/seller/orders?tab=returned"
  icon={<RotateCcw size={16} />}
  count={stats.returned}
  label={t.returned_orders ?? "Returned"}
/>

<StatusCard
  href="/seller/orders?tab=cancelled"
  icon={<XCircle size={16} />}
  count={stats.cancelled}
  label={t.cancelled_orders ?? "Cancelled"}
/>
        </div>
      </section>
    </main>
  );
}

/* ================= MAIN CARD ================= */

function MainCard({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link href={href} className="block">
      <div className="relative bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm h-[96px] flex flex-col justify-center hover:shadow-md transition">

        {badge !== undefined && badge > 0 && (
          <span className="absolute top-2 right-2 text-[10px] bg-gray-800 text-white px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-700">
            {icon}
          </div>

          <span className="text-[12px] font-medium text-gray-700 text-center leading-tight">
            {label}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ================= STATUS CARD ================= */

function StatusCard({
  href,
  icon,
  count,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  count: number;
  label: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm h-[110px] flex flex-col justify-between hover:shadow-md transition">

        <div className="w-8 h-8 mx-auto rounded-full bg-gray-200 flex items-center justify-center text-gray-700">
          {icon}
        </div>

        <span className="text-[11px] text-gray-600 leading-tight px-1">
          {label}
        </span>

        <span className="text-sm font-semibold text-gray-800">
          {count}
        </span>
      </div>
    </Link>
  );
}
export default function SellerOrdersPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-100 p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white animate-pulse"
            />
          ))}
        </main>
      }
    >
      <SellerOrdersContent />
    </Suspense>
  );
}
