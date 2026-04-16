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
import OrderActions from "@/components/OrderActions";

/* ================= TYPES ================= */

type OrderStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "shipping"
  | "completed";

type RawOrderItem = {
  id: string;
  product_id?: string | null;
  product_name?: string;
  thumbnail?: string;
  images?: string[];
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  status?: string;
};

type RawOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number | string;
  created_at: string;

  shipping_name?: string;
  shipping_phone?: string;

  shipping_address_line?: string;
  shipping_ward?: string | null;
  shipping_district?: string | null;
  shipping_region?: string | null;

  shipping_provider?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;

  order_items?: RawOrderItem[];
};

interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  thumbnail: string;
  images: string[] | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: OrderStatus;
}

interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;

  shipping_name: string;
  shipping_phone: string;

  shipping_address_line: string;
  shipping_ward?: string | null;
  shipping_district?: string | null;
  shipping_region?: string | null;

  shipping_provider?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;

  order_items: OrderItem[];
}

/* ================= FETCHER ================= */

const fetcher = async (): Promise<Order[]> => {
  try {
    const res = await apiAuthFetch(
      "/api/seller/orders?status=pending",
      { cache: "no-store" }
    );

    if (!res.ok) return [];

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((o) => {
      const order = o as RawOrder;

      return {
        id: order.id,
        order_number: order.order_number,
        status: order.status,

        total: Number(order.total ?? 0),
        created_at: order.created_at,

        shipping_name: order.shipping_name ?? "",
        shipping_phone: order.shipping_phone ?? "",

        shipping_address_line: order.shipping_address_line ?? "",
        shipping_ward: order.shipping_ward ?? null,
        shipping_district: order.shipping_district ?? null,
        shipping_region: order.shipping_region ?? null,

        shipping_provider: order.shipping_provider ?? null,
        shipping_country: order.shipping_country ?? null,
        shipping_postal_code: order.shipping_postal_code ?? null,

        order_items: (order.order_items ?? []).map((i) => ({
          id: i.id,
          product_id: i.product_id ?? null,
          product_name: i.product_name ?? "",
          thumbnail: i.thumbnail ?? "",
          images: i.images ?? [],
          quantity: Number(i.quantity ?? 0),
          unit_price: Number(i.unit_price ?? 0),
          total_price: Number(i.total_price ?? 0),
          status: (i.status as OrderStatus) ?? "pending",
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
    !authLoading && user
      ? "/api/seller/orders?status=pending"
      : null,
    fetcher
  );

  /* ================= STATE ================= */

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showConfirmFor, setShowConfirmFor] = useState<string | null>(null);
  const [sellerMessage, setSellerMessage] = useState<string>("");

  const [showCancelFor, setShowCancelFor] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");

  const SELLER_CANCEL_REASONS: string[] = [
    t.cancel_reason_out_of_stock ?? "Out of stock",
    t.cancel_reason_discontinued ?? "Discontinued",
    t.cancel_reason_wrong_price ?? "Wrong price",
    t.cancel_reason_other ?? "Other",
  ];

  /* ================= TOTAL ================= */

  const totalPi = useMemo(
    () => orders.reduce((s, o) => s + Number(o.total), 0),
    [orders]
  );

  /* ================= ACTIONS ================= */

  async function handleConfirm(orderId: string) {
    if (!sellerMessage.trim()) return;

    try {
      setProcessingId(orderId);
      const prev = orders;

      await mutate(
        orders.filter((o) => o.id !== orderId),
        false
      );

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

      await mutate(
        orders.filter((o) => o.id !== orderId),
        false
      );

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
    return <p className="text-center mt-10 text-gray-400">Loading...</p>;
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

      <section className="mt-6 px-4 space-y-4">

        {orders.map((o) => (
          <div key={o.id}>

            {/* CARD */}
            <OrderCard
              order={{
                id: o.id,
                order_number: o.order_number,
                created_at: o.created_at,
                status: o.status,
                shipping_name: o.shipping_name,
                total: o.total,
                order_items: o.order_items.map((i) => ({
                  id: i.id,
                  product_name: i.product_name,
                  thumbnail: i.thumbnail,
                  quantity: i.quantity,
                  unit_price: i.unit_price,
                })),
              }}
              onClick={() => router.push(`/seller/orders/${o.id}`)}
              actions={
                <OrderActions
                  status={o.status}
                  orderId={o.id}
                  loading={processingId === o.id}
                  onDetail={() =>
                    router.push(`/seller/orders/${o.id}`)
                  }
                  onConfirm={() => {
                    setSellerMessage("Thank you for your order");
                    setShowConfirmFor(o.id);
                    setShowCancelFor(null);
                  }}
                  onCancel={() => {
                    setShowCancelFor(o.id);
                    setShowConfirmFor(null);
                  }}
                />
              }
            />

            {/* CONFIRM UI */}
            {showConfirmFor === o.id && (
              <div className="bg-white p-3 rounded-lg border mt-2">
                <textarea
                  value={sellerMessage}
                  onChange={(e) => setSellerMessage(e.target.value)}
                  className="w-full border p-2"
                />

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleConfirm(o.id)}
                    className="px-3 py-1 bg-green-600 text-white rounded"
                  >
                    OK
                  </button>

                  <button
                    onClick={() => setShowConfirmFor(null)}
                    className="px-3 py-1 border rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* CANCEL UI */}
            {showCancelFor === o.id && (
              <div className="bg-white p-3 rounded-lg border mt-2">
                {SELLER_CANCEL_REASONS.map((r) => (
                  <label key={r} className="block text-sm">
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

                {selectedReason === "Other" && (
                  <textarea
                    value={customReason}
                    onChange={(e) =>
                      setCustomReason(e.target.value)
                    }
                    className="w-full border p-2 mt-2"
                  />
                )}

                <button
                  onClick={() => handleCancel(o.id)}
                  className="mt-2 px-3 py-1 bg-red-500 text-white rounded"
                >
                  OK
                </button>
              </div>
            )}

          </div>
        ))}

      </section>
    </main>
  );
}
