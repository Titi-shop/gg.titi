"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";
import CustomerOrderCard from "./CustomerOrderCard";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* =======================================================
   TYPES
======================================================= */

export type OrderStatus =
  | "pending"
  | "pending_fulfillment"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

type OrderTab = OrderStatus | "all";

type Order = {
  id: string;
  fulfillment_status?: OrderStatus | null;
  payment_status?: "pending" | "paid" | "failed" | "refunded";
  status?: string;
  order_items?: unknown[];
};

/* =======================================================
   NORMALIZE STATUS (STATE MACHINE SAFE)
======================================================= */

function normalizeStatus(order: Order): OrderStatus {
  const f = order.fulfillment_status;
  const p = order.payment_status;
  const legacy = order.status;

  // 1. ưu tiên backend mới
  if (f && typeof f === "string") {
    return f as OrderStatus;
  }

  // 2. fallback payment status
  if (p === "pending") return "pending";
  if (p === "paid") return "pending_fulfillment";
  if (p === "failed") return "cancelled";
  if (p === "refunded") return "refunded";

  // 3. legacy support
  if (
    legacy &&
    [
      "pending",
      "pending_fulfillment",
      "processing",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
      "refunded",
    ].includes(legacy)
  ) {
    return legacy as OrderStatus;
  }

  return "pending";
}

/* =======================================================
   COMPONENT
======================================================= */

type Props = {
  orders: Order[];

  initialTab?: OrderTab;

  onDetail: (id: string) => void;
  onCancel?: (id: string) => void;
  onReceived?: (id: string) => void;
  onBuyAgain?: (id: string) => void;
  onReview?: (id: string) => void;

  reviewedMap?: Record<string, boolean>;
};

export default function CustomerOrdersList(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="p-4 h-12 rounded-xl bg-[var(--card-bg)] animate-pulse" />
      }
    >
      <Inner {...props} />
    </Suspense>
  );
}

/* =======================================================
   INNER
======================================================= */

function Inner({
  orders,
  initialTab = "all",
  onDetail,
  onCancel,
  onReceived,
  onBuyAgain,
  onReview,
  reviewedMap,
}: Props) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  const urlTab = searchParams.get("tab") as OrderTab | null;

  /* ================= SAFE TAB ================= */

  const safeTab: OrderTab =
    urlTab &&
    [
      "all",
      "pending",
      "pending_fulfillment",
      "processing",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
      "refunded",
    ].includes(urlTab)
      ? urlTab
      : initialTab;

  const [tab, setTab] = useState<OrderTab>(safeTab);

  useEffect(() => {
    setTab(safeTab);
  }, [safeTab]);

  /* ================= TABS ================= */

  const tabs: Array<[OrderTab, string]> = [
    ["all", t.all ?? "All"],
    ["pending", t.order_pending ?? "Pending"],
    ["pending_fulfillment", t.order_paid ?? "Paid"],
    ["processing", t.order_processing ?? "Processing"],
    ["shipped", t.order_shipped ?? "Shipped"],
    ["delivered", t.order_delivered ?? "Delivered"],
    ["completed", t.order_completed ?? "Completed"],
    ["cancelled", t.order_cancelled ?? "Cancelled"],
    ["refunded", t.order_refunded ?? "Refunded"],
  ];

  /* ================= COUNTS ================= */

  const counts = useMemo(() => {
    const map: Record<OrderTab, number> = {
      all: orders.length,
      pending: 0,
      pending_fulfillment: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
      refunded: 0,
    };

    for (const o of orders) {
      const s = normalizeStatus(o);
      map[s]++;
    }

    return map;
  }, [orders]);

  /* ================= FILTER ================= */

  const filtered = useMemo(() => {
    if (tab === "all") return orders;

    return orders.filter((o) => normalizeStatus(o) === tab);
  }, [orders, tab]);

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">

      {/* ================= TABS ================= */}
      <div className="sticky top-0 z-20 overflow-x-auto scrollbar-hide border-b border-orange-500/20 bg-[var(--background)]">
        <div className="flex min-w-max gap-2 px-3 py-2">
          {tabs.map(([key, label]) => {
            const active = tab === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`
                  shrink-0 rounded-xl border px-4 py-2
                  text-sm font-medium transition-all

                  ${
                    active
                      ? "border-orange-500 text-orange-500 bg-[var(--card-bg)]"
                      : "border-orange-500/20 text-[var(--foreground)] bg-[var(--card-bg)]"
                  }
                `}
              >
                {label} ({counts[key]})
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= LIST ================= */}
      <div className="p-4 space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-orange-500/20 bg-[var(--card-bg)] p-8 text-center text-sm text-[var(--text-muted)]">
            {t.no_orders ?? "No orders"}
          </div>
        ) : (
          filtered.map((order) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              reviewed={reviewedMap?.[order.id] ?? false}
              onDetail={() => onDetail(order.id)}
              onCancel={() => onCancel?.(order.id)}
              onReceived={() => onReceived?.(order.id)}
              onBuyAgain={() => onBuyAgain?.(order.id)}
              onReview={() => onReview?.(order.id)}
            />
          ))
        )}
      </div>
    </div>
  );
      }
