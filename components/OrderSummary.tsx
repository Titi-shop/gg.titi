"use client";

import React, {
  useMemo,
  useCallback,
} from "react";

import { useRouter } from "next/navigation";
import useSWR from "swr";

import {
  Clock3,
  PackageCheck,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
} from "lucide-react";

import { getPiAccessToken } from "@/lib/piAuth";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import {
  ORDER_STATUS,
  type OrderStatus,
} from "@/constants/order-status";

/* =========================
   TYPES
========================= */

type OrderCountResponse =
  Partial<Record<OrderStatus, number>>;

/* =========================
   FETCHER
========================= */

async function fetcher(
  url: string
): Promise<OrderCountResponse | null> {
  try {
    const token =
      await getPiAccessToken();

    if (!token) return null;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data: unknown =
      await res.json();

    if (
      !data ||
      typeof data !== "object"
    ) {
      return null;
    }

    return data as OrderCountResponse;
  } catch {
    return null;
  }
}

/* =========================
   CONFIG
========================= */

type ItemConfig = {
  key: OrderStatus;
  icon: React.ReactNode;
  label: string;
  route?: string;
};

function getItems(
  t: Record<string, string>
): ItemConfig[] {
  return [
    {
      key:
        ORDER_STATUS.PENDING_FULFILLMENT,
      icon: <Clock3 size={20} />,
      label:
        t.pending_orders ??
        "Pending",
      route:
        ORDER_STATUS.PENDING_FULFILLMENT,
    },

    {
      key: ORDER_STATUS.PROCESSING,
      icon: <PackageCheck size={20} />,
      label:
        t.processing_orders ??
        "Processing",
      route:
        ORDER_STATUS.PROCESSING,
    },

    {
      key: ORDER_STATUS.SHIPPED,
      icon: <Truck size={20} />,
      label:
        t.shipping_orders ??
        "Shipping",
      route:
        ORDER_STATUS.SHIPPED,
    },

    {
      key: ORDER_STATUS.COMPLETED,
      icon: <CheckCircle2 size={20} />,
      label:
        t.completed_orders ??
        "Completed",
      route:
        ORDER_STATUS.COMPLETED,
    },

    {
      key: ORDER_STATUS.CANCELLED,
      icon: <XCircle size={20} />,
      label:
        t.cancelled_orders ??
        "Cancelled",
      route:
        ORDER_STATUS.CANCELLED,
    },

    {
      key: ORDER_STATUS.RETURNS,
      icon: <RotateCcw size={20} />,
      label:
        t.returns_orders ??
        "Returns",
      route: "returns",
    },
  ];
}

/* =========================
   COMPONENT
========================= */

export default function OrderSummary() {
  const router = useRouter();

  const { t } =
    useTranslation();

  const {
    data,
    isLoading,
  } = useSWR(
    "/api/orders/count",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  /* =========================
     NAVIGATION
  ========================= */

  const go = useCallback(
    (tab: string) => {
      if (tab === "returns") {
        router.push(
          "/customer/returns"
        );
      } else {
        router.push(
          `/customer/orders?tab=${tab}`
        );
      }
    },
    [router]
  );

  /* =========================
     COUNTS
  ========================= */

  const counts = useMemo(() => {
    return {
      [ORDER_STATUS.PENDING]:
        data?.pending ?? 0,

      [ORDER_STATUS.PENDING_FULFILLMENT]:
        data?.pending_fulfillment ??
        0,

      [ORDER_STATUS.PROCESSING]:
        data?.processing ?? 0,

      [ORDER_STATUS.SHIPPED]:
        data?.shipped ?? 0,

      [ORDER_STATUS.COMPLETED]:
        data?.completed ?? 0,

      [ORDER_STATUS.CANCELLED]:
        data?.cancelled ?? 0,

      [ORDER_STATUS.RETURNS]:
        data?.returns ?? 0,

      [ORDER_STATUS.DELIVERED]:
        data?.delivered ?? 0,

      [ORDER_STATUS.REFUNDED]:
        data?.refunded ?? 0,
    };
  }, [data]);

  const items = useMemo(
    () => getItems(t),
    [t]
  );

  return (
    <section
      className="
        mx-4
        mt-4
        overflow-hidden
        rounded-3xl
        border
        shadow-sm
        transition-colors
      "
      style={{
        backgroundColor:
          "var(--card-bg)",

        borderColor:
          "var(--border-color)",
      }}
    >
      {/* HEADER */}
      <button
        type="button"
        onClick={() =>
          router.push(
            "/customer/orders"
          )
        }
        className="
          flex
          w-full
          items-center
          justify-between
          px-5
          py-4
          transition
          active:scale-[0.995]
        "
      >
        <div className="text-left">
          <h2
            className="
              text-[17px]
              font-semibold
            "
            style={{
              color:
                "var(--foreground)",
            }}
          >
            {t.orders ?? "Orders"}
          </h2>

          <p
            className="
              mt-0.5
              text-xs
            "
            style={{
              color:
                "var(--muted-foreground)",
            }}
          >
            {t.track_orders ??
              "Track, manage and review purchases"}
          </p>
        </div>

        <ChevronRight
          size={18}
          style={{
            color:
              "var(--muted-foreground)",
          }}
        />
      </button>

      {/* DIVIDER */}
      <div
        className="h-px"
        style={{
          backgroundColor:
            "var(--border-color)",
        }}
      />

      {/* GRID */}
      <div
        className="
          grid
          grid-cols-3
          gap-y-5
          px-3
          py-5
          sm:grid-cols-6
        "
      >
        {items.map((item) => (
          <OrderItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            count={
              counts[item.key] ?? 0
            }
            loading={isLoading}
            onClick={() =>
              go(
                item.route ??
                  item.key
              )
            }
          />
        ))}
      </div>
    </section>
  );
}

/* =========================
   ITEM
========================= */

type OrderItemProps = {
  icon: React.ReactNode;
  label: string;
  count: number;
  loading: boolean;
  onClick: () => void;
};

function OrderItem({
  icon,
  label,
  count,
  loading,
  onClick,
}: OrderItemProps) {
  const badge = useMemo(() => {
    if (loading) {
      return (
        <span
          className="
            absolute
            -right-1
            -top-1
            h-[18px]
            w-[18px]
            animate-pulse
            rounded-full
          "
          style={{
            backgroundColor:
              "var(--border-color)",
          }}
        />
      );
    }

    if (count > 0) {
      return (
        <span
          className="
            absolute
            -right-1
            -top-1
            flex
            h-[18px]
            min-w-[18px]
            items-center
            justify-center
            rounded-full
            bg-red-500
            px-1
            text-[10px]
            font-semibold
            text-white
          "
        >
          {count > 99
            ? "99+"
            : count}
        </span>
      );
    }

    return null;
  }, [count, loading]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group
        flex
        flex-col
        items-center
        px-1
        transition-all
        active:scale-95
      "
    >
      {/* ICON */}
      <div
        className="
          relative
          mb-2
          flex
          h-12
          w-12
          items-center
          justify-center
          rounded-full
          border
          shadow-sm
          transition-all
          group-active:scale-95
        "
        style={{
          backgroundColor:
            "var(--soft-bg)",

          borderColor:
            "var(--border-color)",

          color:
            "var(--foreground)",
        }}
      >
        {icon}
        {badge}
      </div>

      {/* LABEL */}
      <span
        className="
          line-clamp-2
          text-center
          text-[11px]
          font-medium
          leading-tight
        "
        style={{
          color:
            "var(--foreground)",
        }}
      >
        {label}
      </span>
    </button>
  );
}
