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

/* ================= FETCH ================= */

const fetcher = async (): Promise<Order[]> => {
  const res = await apiAuthFetch("/api/seller/orders", {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((o: RawOrder) => {
    const status =
      (o.order_items?.[0]?.status as OrderStatus) ??
      "pending";

    return {
      id: o.id,
      order_number: o.order_number,
      status,
      total: Number(o.total ?? 0),
      created_at: o.created_at,
      shipping_name: o.shipping_name ?? "",
      shipping_phone: o.shipping_phone ?? "",
      order_items: (o.order_items ?? []).map((i) => ({
        id: i.id,
        product_name: i.product_name ?? "",
        thumbnail: i.thumbnail ?? "",
        quantity: Number(i.quantity ?? 0),
        unit_price: Number(i.unit_price ?? 0),
      })),
    };
  });
};

/* ================= PAGE ================= */

export default function SellerOrdersPage() {
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

  const [confirmShippingId, setConfirmShippingId] = useState<string | null>(null);

  /* ================= TOTAL ================= */

  const totalPi = useMemo(
    () => orders.reduce((s, o) => s + o.total, 0),
    [orders]
  );

  /* ================= ACTIONS ================= */

  async function handleConfirm(id: string) {
    if (!sellerMessage.trim()) return;

    try {
      setProcessingId(id);

      await apiAuthFetch(`/api/seller/orders/${id}/confirm`, {
        method: "PATCH",
        body: JSON.stringify({ seller_message: sellerMessage }),
      });

      setShowConfirmFor(null);
      mutate();
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCancel(id: string) {
    if (!selectedReason) return;

    try {
      setProcessingId(id);

      await apiAuthFetch(`/api/seller/orders/${id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ cancel_reason: selectedReason }),
      });

      setShowCancelFor(null);
      mutate();
    } finally {
      setProcessingId(null);
    }
  }

  async function handleShipping(id: string) {
    try {
      setProcessingId(id);

      await apiAuthFetch(`/api/seller/orders/${id}/shipping`, {
        method: "PATCH",
      });

      setConfirmShippingId(null);
      mutate();
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= LOADING ================= */

  if (isLoading || authLoading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <header className="bg-gray-600 text-white px-4 py-4">
        <div className="bg-gray-500 rounded-lg p-4">
          <p>{t.orders ?? "Orders"}</p>
          <p className="text-xs">
            {orders.length} · π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      <OrdersList
        orders={orders}
        onClick={() => {}}
        initialTab="pending"

        renderActions={(o) => (
          <OrderActions
            status={o.status}
            loading={processingId === o.id}

            onDetail={() =>
              router.push(`/seller/orders/${o.id}`)
            }

            onConfirm={() => {
              setShowConfirmFor(o.id);
              setShowCancelFor(null);
            }}

            onCancel={() => {
              setShowCancelFor(o.id);
              setShowConfirmFor(null);
            }}

            onShipping={() => {
              setConfirmShippingId(o.id);
            }}
          />
        )}

        renderExtra={(o) => (
          <>
            {/* CONFIRM */}
            {showConfirmFor === o.id && (
              <div className="bg-white p-3 rounded border mt-2">
                <textarea
                  value={sellerMessage}
                  onChange={(e) => setSellerMessage(e.target.value)}
                  className="w-full border p-2"
                />
                <button
                  onClick={() => handleConfirm(o.id)}
                  className="mt-2 bg-green-600 text-white px-3 py-1 rounded"
                >
                  OK
                </button>
              </div>
            )}

            {/* CANCEL */}
            {showCancelFor === o.id && (
              <div className="bg-white p-3 rounded border mt-2">
                <label>
                  <input
                    type="radio"
                    onChange={() => setSelectedReason("Out of stock")}
                  />
                  Out of stock
                </label>

                <button
                  onClick={() => handleCancel(o.id)}
                  className="mt-2 bg-red-500 text-white px-3 py-1 rounded"
                >
                  OK
                </button>
              </div>
            )}

            {/* SHIPPING */}
            {confirmShippingId === o.id && (
              <div className="bg-white p-3 rounded border mt-2">
                <p>Confirm shipping?</p>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setConfirmShippingId(null)}
                    className="flex-1 border rounded"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() => handleShipping(o.id)}
                    className="flex-1 bg-gray-800 text-white rounded"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      />
    </main>
  );
}
