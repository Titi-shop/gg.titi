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

/* ================= PAGE ================= */

export default function CustomerOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, loading } = useAuth();

  const {
    data: orders = [],
    isLoading,
    mutate,
  } = useSWR(
    user ? "/api/orders" : null,
    fetcher
  );

  /* ================= STATE ================= */
const [confirmReceivedFor, setConfirmReceivedFor] =
  useState<string | null>(null);
  const [toast, setToast] =
    useState("");

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  /* cancel */
  const [showCancelFor, setShowCancelFor] =
    useState<string | null>(null);

  const [selectedReason, setSelectedReason] =
    useState("");

  const [customReason, setCustomReason] =
    useState("");

  /* review */
  const [activeReviewId, setActiveReviewId] =
    useState<string | null>(null);

  const [rating, setRating] =
    useState(5);

  const [comment, setComment] =
    useState("");

  const [reviewedMap, setReviewedMap] =
    useState<Record<string, boolean>>(
      {}
    );

  /* ================= TOTAL ================= */

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

  /* ================= HELPERS ================= */

  function showToast(text: string) {
    setToast(text);

    setTimeout(() => {
      setToast("");
    }, 2500);
  }

  function resetCancel() {
    setShowCancelFor(null);
    setSelectedReason("");
    setCustomReason("");
  }

  function resetReview() {
    setActiveReviewId(null);
    setRating(5);
    setComment("");
  }

  /* ================= CANCEL ================= */

  async function handleCancel(
    orderId: string
  ) {
    const reason =
      selectedReason ===
      "cancel_reason_other"
        ? customReason
        : selectedReason;

    if (!reason.trim()) {
      showToast(
        t.select_cancel_reason ??
          "Select reason"
      );
      return;
    }

    try {
      setProcessingId(orderId);

      const token =
        await getPiAccessToken();

      await fetch(
        `/api/orders/${orderId}/cancel`,
        {
          method: "PATCH",
          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            cancel_reason: reason,
          }),
        }
      );

      await mutate();

      resetCancel();

      showToast(
        t.cancel_success ??
          "Cancelled"
      );
    } catch {
      showToast(
        t.cancel_failed ??
          "Cancel failed"
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= RECEIVED ================= */

  async function handleReceived(
    orderId: string
  ) {
    try {
      setProcessingId(orderId);

      const token =
        await getPiAccessToken();

      await fetch(
        `/api/orders/${orderId}/complete`,
        {
          method: "PATCH",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      await mutate();

      showToast(
        t.received_success ??
          "Completed"
      );
    } catch {
      showToast(
        t.action_failed ??
          "Failed"
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= REVIEW ================= */

  async function handleReview(
    order: any
  ) {
    try {
      setProcessingId(order.id);

      const token =
        await getPiAccessToken();

      const productId =
        order.order_items?.[0]
          ?.product_id;

      const res = await fetch(
        "/api/reviews",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            order_id: order.id,
            product_id: productId,
            rating,
            comment:
              comment.trim() ||
              t.default_review_comment ||
              "Good product",
          }),
        }
      );

      if (!res.ok)
        throw new Error();

      setReviewedMap((prev) => ({
        ...prev,
        [order.id]: true,
      }));

      resetReview();

      showToast(
        t.review_success ??
          "Review success"
      );
    } catch {
      showToast(
        t.review_failed ??
          "Review failed"
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* ================= LOADING ================= */

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

  /* ================= UI ================= */

  return (
   <main className="min-h-screen bg-gray-100 pb-32">

      {/* TOAST */}
      {toast && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 bg-black text-white text-sm px-4 py-2 rounded-full shadow-xl">
          {toast}
        </div>
      )}

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
        reviewedMap={
          reviewedMap
        }
        onDetail={(id) =>
          router.push(
            `/customer/orders/${id}`
          )
        }
        onCancel={(id) =>
          setShowCancelFor(id)
        }
        onReceived={(id) =>
       setConfirmReceivedFor(id)
      }
        onReview={(id) =>
          setActiveReviewId(id)
        }
      />

      {/* CANCEL POPUP */}
      {showCancelFor && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={
              resetCancel
            }
            className="absolute inset-0 bg-black/40"
          />

          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto"

            <div className="w-14 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

            <h3 className="text-lg font-semibold text-center">
              {t.cancel_order ??
                "Cancel Order"}
            </h3>

            <div className="space-y-2 mt-5 max-h-72 overflow-y-auto">
              {CANCEL_REASON_KEYS.map(
                (key) => (
                  <button
                    key={key}
                    onClick={() =>
                      setSelectedReason(
                        key
                      )
                    }
                    className={`w-full text-left px-4 py-3 rounded-xl border ${
                      selectedReason ===
                      key
                        ? "border-orange-500 bg-orange-50 text-orange-600"
                        : "border-gray-200"
                    }`}
                  >
                    {t[key] ??
                      key}
                  </button>
                )
              )}
            </div>

            {selectedReason ===
              "cancel_reason_other" && (
              <textarea
                rows={3}
                value={
                  customReason
                }
                onChange={(
                  e
                ) =>
                  setCustomReason(
                    e.target.value
                  )
                }
                placeholder={
                  t.enter_cancel_reason ??
                  "Enter reason"
                }
                className="w-full border rounded-xl p-3 mt-3"
              />
            )}

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={
                  resetCancel
                }
                className="py-3 border rounded-xl"
              >
                {t.close ??
                  "Close"}
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
                className="py-3 bg-orange-500 text-white rounded-xl disabled:opacity-50"
              >
                {t.confirm ??
                  "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW POPUP */}
      {activeReviewId && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={
              resetReview
            }
            className="absolute inset-0 bg-black/40"
          />

          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto"

            <div className="w-14 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

            <h3 className="text-lg font-semibold text-center">
              {t.review_orders ??
                "Review"}
            </h3>

            {/* stars */}
            <div className="flex justify-center gap-2 mt-5">
              {[1,2,3,4,5].map(
                (star) => (
                  <button
                    key={
                      star
                    }
                    onClick={() =>
                      setRating(
                        star
                      )
                    }
                    className={
                      star <=
                      rating
                        ? "text-3xl text-yellow-500"
                        : "text-3xl text-gray-300"
                    }
                  >
                    ★
                  </button>
                )
              )}
            </div>

            {/* comment */}
            <textarea
              rows={4}
              value={comment}
              onChange={(e) =>
                setComment(
                  e.target.value
                )
              }
              placeholder={
                t.default_review_comment ??
                "Write review..."
              }
              className="w-full border rounded-xl p-3 mt-4"
            />

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={
                  resetReview
                }
                className="py-3 border rounded-xl"
              >
                {t.close ??
                  "Close"}
              </button>

              <button
                disabled={
                  processingId ===
                  activeReviewId
                }
                onClick={() => {
                  const order =
                    orders.find(
                      (
                        x: any
                      ) =>
                        x.id ===
                        activeReviewId
                    );

                  if (order)
                    handleReview(
                      order
                    );
                }}
                className="py-3 bg-orange-500 text-white rounded-xl disabled:opacity-50"
              >
                {t.submit_review ??
                  "Submit"}
              </button>
            </div>
{confirmReceivedFor && (
  <div className="fixed inset-0 z-50">
    <div
      onClick={() =>
        setConfirmReceivedFor(null)
      }
      className="absolute inset-0 bg-black/40"
    />

    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-[max(24px,env(safe-area-inset-bottom))]">

      <div className="w-14 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

      <h3 className="text-lg font-semibold text-center">
        {t.received ?? "Received"}
      </h3>

      <p className="text-sm text-gray-500 text-center mt-2">
        {t.confirm_received_order ??
          "Confirm that you received this order?"}
      </p>

      <div className="grid grid-cols-2 gap-3 mt-6">

        <button
          onClick={() =>
            setConfirmReceivedFor(null)
          }
          className="py-3 border rounded-xl font-medium"
        >
          {t.cancel ?? "Cancel"}
        </button>

        <button
          onClick={async () => {
            await handleReceived(
              confirmReceivedFor
            );

            setConfirmReceivedFor(null);
          }}
          className="py-3 bg-green-600 text-white rounded-xl font-medium"
        >
          {t.ok ?? "OK"}
        </button>

      </div>
    </div>
  </div>
)}
          </div>
        </div>
      )}

    </main>
  );
}
