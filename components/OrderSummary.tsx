"use client";

import React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { getPiAccessToken } from "@/lib/piAuth";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import {
  Clock3,
  PackageCheck,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
} from "lucide-react";

/* =====================================================
   FETCHER
===================================================== */

const fetcher = async (url: string) => {
  try {
    const token = await getPiAccessToken();
    if (!token) return null;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    return await res.json();
  } catch {
    return null;
  }
};

/* =====================================================
   COMPONENT
===================================================== */

export default function OrderSummary() {
  const router = useRouter();
  const { t } = useTranslation();

  const { data, isLoading } = useSWR(
    "/api/orders/count",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  const counts = {
    pending: Number(data?.pending ?? 0),
    confirmed: Number(data?.confirmed ?? 0),
    shipping: Number(data?.shipping ?? 0),
    completed: Number(data?.completed ?? 0),
    cancelled: Number(data?.cancelled ?? 0),
    returns: Number(data?.returns ?? 0),
  };

  const go = (tab: string) => {
    router.push(`/customer/orders?tab=${tab}`);
  };

  return (
    <section className="mx-4 mt-4 overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-sm">
      {/* HEADER */}
      <button
        type="button"
        onClick={() =>
          router.push("/customer/orders")
        }
        className="w-full px-5 py-4 flex items-center justify-between active:bg-gray-50 transition"
      >
        <div className="text-left">
          <h2 className="text-[17px] font-semibold text-gray-900">
            {t.orders ?? "Orders"}
          </h2>

          <p className="text-xs text-gray-500 mt-0.5">
            {t.track_orders ??
              "Track, manage and review purchases"}
          </p>
        </div>

        <ChevronRight
          size={18}
          className="text-gray-400"
        />
      </button>

      <div className="h-px bg-gray-100" />

      {/* GRID */}
      <div className="grid grid-cols-4 gap-y-5 px-3 py-5">
        <Item
          icon={<Clock3 size={20} />}
          label={
            t.pending_orders ??
            "Pending"
          }
          count={counts.pending}
          loading={isLoading}
          onClick={() =>
            go("pending")
          }
        />

        <Item
          icon={
            <PackageCheck size={20} />
          }
          label={
            t.confirmed_orders ??
            "Confirmed"
          }
          count={counts.confirmed}
          loading={isLoading}
          onClick={() =>
            go("confirmed")
          }
        />

        <Item
          icon={<Truck size={20} />}
          label={
            t.shipping_orders ??
            "Shipping"
          }
          count={counts.shipping}
          loading={isLoading}
          onClick={() =>
            go("shipping")
          }
        />

        <Item
          icon={
            <CheckCircle2 size={20} />
          }
          label={
            t.completed_orders ??
            "Completed"
          }
          count={counts.completed}
          loading={isLoading}
          onClick={() =>
            go("completed")
          }
        />

        <Item
          icon={<XCircle size={20} />}
          label={
            t.cancelled_orders ??
            "Cancelled"
          }
          count={counts.cancelled}
          loading={isLoading}
          onClick={() =>
            go("cancelled")
          }
        />

        {/* RETURNS => PAGE RIÊNG */}
        <Item
          icon={
            <RotateCcw size={20} />
          }
          label={
            t.returns_orders ??
            "Returns"
          }
          count={counts.returns}
          loading={isLoading}
          onClick={() =>
            router.push(
              "/customer/returns"
            )
          }
        />
      </div>
    </section>
  );
}

/* =====================================================
   ITEM
===================================================== */

function Item({
  icon,
  label,
  count,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center px-1 active:scale-95 transition-transform"
    >
      {/* ICON */}
      <div className="relative mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-700 shadow-sm transition group-active:bg-orange-50">
        {icon}

        {/* BADGE */}
        {loading ? (
          <span className="absolute -right-1 -top-1 h-[18px] w-[18px] rounded-full bg-gray-300 animate-pulse" />
        ) : typeof count ===
            "number" &&
          count > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {count > 99
              ? "99+"
              : count}
          </span>
        ) : null}
      </div>

      {/* TEXT */}
      <span className="text-[11px] leading-tight text-center text-gray-700 font-medium line-clamp-2">
        {label}
      </span>
    </button>
  );
}
