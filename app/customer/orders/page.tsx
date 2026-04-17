"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import CustomerOrdersList from "@/components/CustomerOrdersList";

/* ================= CANCEL REASONS ================= */

const CANCEL_REASON_KEYS = [
  "cancel_reason_change_mind",
  "cancel_reason_wrong_product",
  "cancel_reason_change_variant",
  "cancel_reason_better_price",
  "cancel_reason_delivery_slow",
  "cancel_reason_update_address",
  "cancel_reason_other",
] as const;

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

  const { data: orders = [], isLoading, mutate } = useSWR(
    user ? "/api/orders" : null,
    fetcher
  );

  /* ================= STATE ================= */

  const [showCancelFor, setShowCancelFor] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
 const [activeReviewId, setActiveReviewId] =
  useState<string | null>(null);

  const [rating, setRating] =
  useState(5);

  const [comment, setComment] =
  useState("");

  const [reviewedMap, setReviewedMap] =
  useState<Record<string, boolean>>({});
  /* ================= TOTAL ================= */

  const totalPi = useMemo(
    () =>
      orders.reduce(
        (sum: number, o: any) =>
          sum + Number(o.total ?? 0),
        0
      ),
    [orders]
  );

  /* ================= HELPERS ================= */

  function resetCancel() {
    setShowCancelFor(null);
    setSelectedReason("");
    setCustomReason("");
  }

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(""), 2500);
  }

  /* ================= CANCEL ================= */

  async function handleCancel(orderId: string) {
    const reason =
      selectedReason === "cancel_reason_other"
        ? customReason
        : selectedReason;

    if (!reason.trim()) {
      showToast(
        t.select_cancel_reason ??
          "Please select reason"
      );
      return;
    }

    try {
      setProcessingId(orderId);

      const token = await getPiAccessToken();

      await fetch(`/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancel_reason: reason,
        }),
      });

      await mutate();

      resetCancel();

      showToast(
        t.cancel_success ??
          "Order cancelled successfully"
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= LOADING ================= */

  if (loading || isLoading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-white rounded-xl animate-pulse"
          />
        ))}
      </main>
    );
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* TOAST */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-sm px-4 py-2 rounded-full shadow-lg animate-bounce">
          {toast}
        </div>
      )}

      {/* HEADER */}
      <header className="bg-orange-500 text-white px-4 py-4 shadow">
        <div className="bg-orange-400 rounded-xl p-4">
          <p className="text-sm">
            {t.orders ?? "Orders"}
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
    router.push(`/customer/orders/${id}`)
  }

  onCancel={(id) =>
    setShowCancelFor(id)
  }

  onReceived={async (id) => {
    try {
      const token =
        await getPiAccessToken();

      await fetch(
        `/api/orders/${id}/complete`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      mutate();
    } catch {}
  }}
/>

      {/* PREMIUM POPUP */}
      {showCancelFor && (
        <div className="fixed inset-0 z-50">

          {/* overlay */}
          <div
            onClick={resetCancel}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 shadow-2xl animate-[slideUp_.25s_ease]">

            {/* handle */}
            <div className="w-14 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

            <h3 className="text-center font-semibold text-lg">
              {t.cancel_order ??
                "Cancel Order"}
            </h3>

            <p className="text-center text-xs text-gray-500 mt-1 mb-5">
              {t.choose_reason ??
                "Choose a reason"}
            </p>

            {/* reasons */}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {CANCEL_REASON_KEYS.map((key) => {
                const active =
                  selectedReason === key;

                return (
                  <button
                    key={key}
                    onClick={() =>
                      setSelectedReason(
                        key
                      )
                    }
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      active
                        ? "border-orange-500 bg-orange-50 text-orange-600"
                        : "border-gray-200"
                    }`}
                  >
                    {t[key] ?? key}
                  </button>
                );
              })}
            </div>

            {/* other */}
            {selectedReason ===
              "cancel_reason_other" && (
              <textarea
                value={customReason}
                onChange={(e) =>
                  setCustomReason(
                    e.target.value
                  )
                }
                rows={3}
                placeholder={
                  t.enter_cancel_reason ??
                  "Enter reason"
                }
                className="w-full mt-3 border rounded-xl p-3 text-sm"
              />
            )}

            {/* buttons */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={resetCancel}
                className="py-3 rounded-xl border font-medium"
              >
                {t.close ?? "Close"}
              </button>

              <button
                disabled={
                  processingId ===
                  showCancelFor
                }
                onClick={() =>
                  handleCancel(
                    showCancelFor
                  )
                }
                className="py-3 rounded-xl bg-orange-500 text-white font-medium disabled:opacity-50"
              >
                {processingId ===
                showCancelFor
                  ? t.processing ??
                    "Processing..."
                  : t.confirm_cancel ??
                    "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* animation */}
      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
