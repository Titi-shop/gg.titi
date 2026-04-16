"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import { useAuth } from "@/context/AuthContext";
import OrderCard from "@/components/OrderCard";
import OrdersList from "@/components/OrdersList";
import OrderActions from "@/components/OrderActions";

/* ================= TYPES ================= */

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "returned"
  | "cancelled";

interface RawOrderItem {
  id: string;
  product_name?: string;
  thumbnail?: string;
  quantity?: number;
  unit_price?: number;
  status?: string;
}

interface RawOrder {
  id: string;
  order_number: string;
  total: number | string;
  created_at: string;
  shipping_name?: string;
  shipping_phone?: string;
  order_items?: RawOrderItem[];
}

interface OrderItem {
  id: string;
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  shipping_name: string;
  shipping_phone: string;
  order_items: OrderItem[];
}

/* ================= FETCHER ================= */

const fetcher = async (): Promise<Order[]> => {
  try {
    const res = await apiAuthFetch("/api/seller/orders", {
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((o) => {
      const order = o as RawOrder;

      // ✅ derive status từ order_items
      const itemStatuses = (order.order_items ?? []).map((i) =>
        String(i.status ?? "").toLowerCase().trim()
      );

      let status: OrderStatus = "pending";

      if (itemStatuses.includes("shipping")) status = "shipping";
      else if (itemStatuses.includes("completed")) status = "completed";
      else if (itemStatuses.includes("returned")) status = "returned";
      else if (itemStatuses.includes("confirmed")) status = "confirmed";
      else if (itemStatuses.includes("cancelled")) status = "cancelled";
      else if (itemStatuses.includes("pending")) status = "pending";

      return {
        id: order.id,
        order_number: order.order_number,
        status,
        total: Number(order.total ?? 0),
        created_at: order.created_at,
        shipping_name: order.shipping_name ?? "",
        shipping_phone: order.shipping_phone ?? "",

        order_items: (order.order_items ?? []).map((i) => ({
          id: i.id,
          product_name: i.product_name ?? "",
          thumbnail: i.thumbnail ?? "",
          quantity: Number(i.quantity ?? 0),
          unit_price: Number(i.unit_price ?? 0),
        })),
      };
    });
  } catch {
    return [];
  }
};

/* ================= PAGE ================= */

export default function SellerPendingOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const { data: orders = [], isLoading, mutate } = useSWR(
    !authLoading && user ? "/api/seller/orders" : null,
    fetcher
  );

  /* ================= STATE ================= */

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showConfirmFor, setShowConfirmFor] = useState<string | null>(null);
  const [sellerMessage, setSellerMessage] = useState("");

  const [showCancelFor, setShowCancelFor] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const SELLER_CANCEL_REASONS = [
    t.cancel_reason_out_of_stock ?? "Out of stock",
    t.cancel_reason_discontinued ?? "Discontinued",
    t.cancel_reason_wrong_price ?? "Wrong price",
    t.cancel_reason_other ?? "Other",
  ];

  /* ================= TOTAL ================= */

  const totalPi = useMemo(
    () => orders.reduce((s, o) => s + o.total, 0),
    [orders]
  );

  /* ================= ACTIONS ================= */

  async function handleConfirm(orderId: string) {
    if (!sellerMessage.trim()) return;

    try {
      setProcessingId(orderId);

      const prev = orders;
      await mutate(orders.filter((o) => o.id !== orderId), false);

      const res = await apiAuthFetch(
        `/api/seller/orders/${orderId}/confirm`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seller_message: sellerMessage }),
        }
      );

      if (!res.ok) {
        await mutate(prev, false);
        return;
      }

      setShowConfirmFor(null);
      setSellerMessage("");
      mutate();
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCancel(orderId: string) {
    const reason =
      selectedReason === (t.cancel_reason_other ?? "Other")
        ? customReason
        : selectedReason;

    if (!reason.trim()) return;

    try {
      setProcessingId(orderId);

      const prev = orders;
      await mutate(orders.filter((o) => o.id !== orderId), false);

      const res = await apiAuthFetch(
        `/api/seller/orders/${orderId}/cancel`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cancel_reason: reason }),
        }
      );

      if (!res.ok) {
        await mutate(prev, false);
        return;
      }

      setShowCancelFor(null);
      setSelectedReason("");
      setCustomReason("");
      mutate();
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= LOADING ================= */

  if (isLoading || authLoading) {
    return (
      <p className="text-center mt-10">
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
          <p>{t.pending_orders ?? "Pending orders"}</p>
          <p className="text-xs">
            {orders.length} · π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* LIST */}
      <OrdersList
  orders={orders}
  onClick={() => {}}
  initialTab="pending"

  renderActions={(o) => (
    <OrderActions
      status={o.status}
      orderId={o.id}
      loading={processingId === o.id}
      onDetail={() =>
        router.push(`/seller/orders/${o.id}`)
      }
      onConfirm={() => {
        setSellerMessage("Thank you");
        setShowConfirmFor(o.id);
        setShowCancelFor(null);
      }}
      onCancel={() => {
        setShowCancelFor(o.id);
        setShowConfirmFor(null);
      }}
    />
  )}

  renderExtra={(o) => (
    <>
      {/* ✅ CONFIRM đúng order */}
      {showConfirmFor === o.id && (
        <div className="bg-white p-3 rounded-lg border mt-2">
          <textarea
            value={sellerMessage}
            onChange={(e) => setSellerMessage(e.target.value)}
            className="w-full border p-2"
          />

          <button
            onClick={() => handleConfirm(o.id)}
            className="mt-2 px-3 py-1 bg-green-600 text-white rounded"
          >
            OK
          </button>
        </div>
      )}

      {/* ✅ CANCEL đúng order */}
      {showCancelFor === o.id && (
        <div className="bg-white p-3 rounded-lg border mt-2">
          {SELLER_CANCEL_REASONS.map((r) => (
            <label key={r} className="block">
              <input
                type="radio"
                value={r}
                checked={selectedReason === r}
                onChange={(e) =>
                  setSelectedReason(e.target.value)
                }
              />
              {r}
            </label>
          ))}

          <button
            onClick={() => handleCancel(o.id)}
            className="mt-2 px-3 py-1 bg-red-500 text-white rounded"
          >
            OK
          </button>
        </div>
      )}
    </>
  )}
/>
    </main>
  );
}
