"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
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

interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  shipping_name: string;
  shipping_phone: string;
  order_items: any[];
}

/* ================= FETCH ================= */

const fetcher = async (): Promise<Order[]> => {
  const res = await apiAuthFetch("/api/seller/orders", {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((o: any) => {
    const statuses = (o.order_items ?? []).map((i: any) =>
      String(i.status ?? "").toLowerCase()
    );

    let status: OrderStatus = "pending";

    if (statuses.includes("shipping")) status = "shipping";
    else if (statuses.includes("completed")) status = "completed";
    else if (statuses.includes("returned")) status = "returned";
    else if (statuses.includes("confirmed")) status = "confirmed";
    else if (statuses.includes("cancelled")) status = "cancelled";

    return {
      id: o.id,
      order_number: o.order_number,
      status,
      total: Number(o.total ?? 0),
      created_at: o.created_at,
      shipping_name: o.shipping_name ?? "",
      shipping_phone: o.shipping_phone ?? "",
      order_items: o.order_items ?? [],
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

  const [modal, setModal] = useState<null | {
    type: "confirm" | "cancel" | "shipping";
    orderId: string;
  }>(null);

  const [selectedReason, setSelectedReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);

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

  /* ================= ACTION ================= */

  async function handleAction() {
    if (!modal) return;
    const id = modal.orderId;

    try {
      setProcessingId(id);

      if (modal.type === "confirm") {
        await apiAuthFetch(`/api/seller/orders/${id}/confirm`, {
          method: "PATCH",
          body: JSON.stringify({
            seller_message: t.thank_you ?? "Thank you",
          }),
        });
        setToast(t.confirm_success ?? "Confirmed");
      }

      if (modal.type === "cancel") {
        if (!selectedReason) return;
        await apiAuthFetch(`/api/seller/orders/${id}/cancel`, {
          method: "PATCH",
          body: JSON.stringify({
            cancel_reason: selectedReason,
          }),
        });
        setToast(t.cancel_success ?? "Cancelled");
      }

      if (modal.type === "shipping") {
        await apiAuthFetch(`/api/seller/orders/${id}/shipping`, {
          method: "PATCH",
        });
        setToast(t.shipping_success ?? "Shipping started");
      }

      setModal(null);
      mutate();
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= TOAST AUTO HIDE ================= */

  useEffect(() => {
    if (!toast) return;
    const tmr = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(tmr);
  }, [toast]);

  /* ================= LOADING ================= */

  if (isLoading || authLoading) {
    return <p className="text-center mt-10">{t.loading ?? "Loading..."}</p>;
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

      {/* LIST */}
      <OrdersList
        orders={orders}
        onClick={() => {}}
        initialTab="all"
        renderActions={(o) => (
          <OrderActions
            status={o.status}
            loading={processingId === o.id}

            onDetail={() =>
              router.push(`/seller/orders/${o.id}`)
            }

            onConfirm={() =>
              setModal({ type: "confirm", orderId: o.id })
            }

            onCancel={() =>
              setModal({ type: "cancel", orderId: o.id })
            }

            onShipping={() =>
              setModal({ type: "shipping", orderId: o.id })
            }
          />
        )}
      />

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 w-80">

            <p className="text-sm text-center mb-4">
              {modal.type === "confirm" && (t.confirm_order ?? "Confirm order?")}
              {modal.type === "cancel" && (t.cancel_order ?? "Cancel order?")}
              {modal.type === "shipping" && (t.confirm_shipping ?? "Start shipping?")}
            </p>

            {modal.type === "cancel" && (
              <div className="space-y-2 mb-3">
                {SELLER_CANCEL_REASONS.map((r) => (
                  <label key={r} className="flex gap-2 text-sm">
                    <input
                      type="radio"
                      checked={selectedReason === r}
                      onChange={() => setSelectedReason(r)}
                    />
                    {r}
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 border py-2 rounded"
              >
                {t.cancel ?? "Cancel"}
              </button>

              <button
                onClick={handleAction}
                className="flex-1 bg-gray-800 text-white py-2 rounded active:scale-95"
              >
                {processingId === modal.orderId
                  ? t.processing ?? "Processing..."
                  : t.ok ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-lg text-sm">
          {toast}
        </div>
      )}
    </main>
  );
}
