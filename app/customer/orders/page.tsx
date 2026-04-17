"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import useSWR from "swr";
import {
  Suspense,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import CustomerOrdersList from "@/components/CustomerOrdersList";

/* =======================================================
   TYPES
======================================================= */

type OrderItem = {
  product_id: string;
  product_name: string;
  thumbnail?: string | null;
};

type Order = {
  id: string;
  order_number: string;
  total: number | string;
  status:
    | "pending"
    | "confirmed"
    | "shipping"
    | "completed"
    | "cancelled"
    | string;
  order_items?: OrderItem[];
};

/* =======================================================
   CANCEL REASONS
======================================================= */

const CANCEL_REASON_KEYS = [
  "cancel_reason_change_mind",
  "cancel_reason_wrong_product",
  "cancel_reason_change_variant",
  "cancel_reason_better_price",
  "cancel_reason_delivery_slow",
  "cancel_reason_update_address",
  "cancel_reason_other",
] as const;

/* =======================================================
   FETCHER
======================================================= */

const fetcher = async (): Promise<Order[]> => {
  try {
    const token = await getPiAccessToken();

    if (!token) return [];

    const res = await fetch("/api/orders", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data: unknown = await res.json();

    if (Array.isArray(data)) {
      return data as Order[];
    }

    if (
      typeof data === "object" &&
      data !== null &&
      "orders" in data
    ) {
      const orders =
        (
          data as {
            orders?: Order[];
          }
        ).orders ?? [];

      return Array.isArray(orders)
        ? orders
        : [];
    }

    return [];
  } catch {
    return [];
  }
};

/* =======================================================
   PAGE
======================================================= */

export default function CustomerOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, loading } = useAuth();

  const {
    data: orders = [],
    isLoading,
    mutate,
  } = useSWR<Order[]>(
    user ? "/api/orders" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  /* ================= STATE ================= */

  const [toast, setToast] =
    useState<string>("");

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  /* cancel */
  const [showCancelFor, setShowCancelFor] =
    useState<string | null>(null);

  const [selectedReason, setSelectedReason] =
    useState<string>("");

  const [customReason, setCustomReason] =
    useState<string>("");

  /* review */
  const [activeReviewId, setActiveReviewId] =
    useState<string | null>(null);

  const [rating, setRating] =
    useState<number>(5);

  const [comment, setComment] =
    useState<string>("");

  const [reviewedMap, setReviewedMap] =
    useState<Record<string, boolean>>(
      {}
    );

  /* received */
  const [
    confirmReceivedFor,
    setConfirmReceivedFor,
  ] = useState<string | null>(null);

  /* ================= TOTAL ================= */

  const totalPi = useMemo(() => {
    return orders.reduce(
      (
        sum: number,
        order: Order
      ) =>
        sum +
        Number(
          order.total ?? 0
        ),
      0
    );
  }, [orders]);

  /* ================= HELPERS ================= */

  function showToastMessage(
    text: string
  ) {
    setToast(text);

    setTimeout(() => {
      setToast("");
    }, 2400);
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

  /* =======================================================
     CANCEL ORDER
  ======================================================= */

  async function handleCancel(
    orderId: string
  ) {
    const reason =
      selectedReason ===
      "cancel_reason_other"
        ? customReason.trim()
        : selectedReason;

    if (!reason) {
      showToastMessage(
        t.select_cancel_reason ??
          "Select reason"
      );
      return;
    }

    try {
      setProcessingId(orderId);

      const token =
        await getPiAccessToken();

      if (!token) {
        showToastMessage(
          t.login_required ??
            "Login required"
        );
        return;
      }

      const res = await fetch(
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
            cancel_reason:
              reason,
          }),
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      await mutate();

      resetCancel();

      showToastMessage(
        t.cancel_success ??
          "Cancelled"
      );
    } catch {
      showToastMessage(
        t.cancel_failed ??
          "Cancel failed"
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* =======================================================
     RECEIVED
  ======================================================= */

  async function handleReceived(
    orderId: string
  ) {
    try {
      setProcessingId(orderId);

      const token =
        await getPiAccessToken();

      if (!token) {
        showToastMessage(
          t.login_required ??
            "Login required"
        );
        return;
      }

      const res = await fetch(
        `/api/orders/${orderId}/complete`,
        {
          method: "PATCH",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      await mutate();

      showToastMessage(
        t.received_success ??
          "Completed"
      );
    } catch {
      showToastMessage(
        t.action_failed ??
          "Failed"
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* =======================================================
     REVIEW
  ======================================================= */

  async function handleReview(
    order: Order
  ) {
    try {
      setProcessingId(order.id);

      const token =
        await getPiAccessToken();

      if (!token) {
        showToastMessage(
          t.login_required ??
            "Login required"
        );
        return;
      }

      const productId =
        order.order_items?.[0]
          ?.product_id;

      if (!productId) {
        showToastMessage(
          t.review_failed ??
            "Review failed"
        );
        return;
      }

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
            order_id:
              order.id,
            product_id:
              productId,
            rating,
            comment:
              comment.trim() ||
              t.default_review_comment ||
              "Good product",
          }),
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      setReviewedMap(
        (prev) => ({
          ...prev,
          [order.id]: true,
        })
      );

      resetReview();

      showToastMessage(
        t.review_success ??
          "Review success"
      );
    } catch {
      showToastMessage(
        t.review_failed ??
          "Review failed"
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

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

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="min-h-screen bg-gray-100 pb-32">
      {/* TOAST */}
      {toast && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black px-4 py-2 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* HEADER */}
      <header className="bg-orange-500 px-4 py-4 text-white shadow">
        <div className="rounded-xl bg-orange-400 p-4">
          <p className="text-sm">
            {t.orders ??
              "Orders"}
          </p>

          <p className="mt-1 text-xs">
            {orders.length} · π
            {formatPi(totalPi)}
          </p>
        </div>
      </header>

      {/* LIST */}
      <Suspense
        fallback={
          <div className="p-4 text-center text-sm text-gray-400">
            Loading...
          </div>
        }
      >
        <CustomerOrdersList
          initialTab="all"
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
            setShowCancelFor(
              id
            )
          }
          onReceived={(id) =>
            setConfirmReceivedFor(
              id
            )
          }
          onReview={(id) =>
            setActiveReviewId(
              id
            )
          }
        />
      </Suspense>

      {/* CANCEL POPUP */}
      {showCancelFor && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={
              resetCancel
            }
            className="absolute inset-0 bg-black/40"
          />

          <div className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />

            <h3 className="text-center text-lg font-semibold">
              {t.cancel_order ??
                "Cancel Order"}
            </h3>

            <div className="mt-5 space-y-2">
              {CANCEL_REASON_KEYS.map(
                (
                  key
                ) => (
                  <button
                    key={
                      key
                    }
                    type="button"
                    onClick={() =>
                      setSelectedReason(
                        key
                      )
                    }
                    className={`w-full rounded-xl border px-4 py-3 text-left ${
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
                    e.target
                      .value
                  )
                }
                className="mt-3 w-full rounded-xl border p-3"
                placeholder={
                  t.enter_cancel_reason ??
                  "Enter reason"
                }
              />
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={
                  resetCancel
                }
                className="rounded-xl border py-3"
              >
                {t.close ??
                  "Close"}
              </button>

              <button
                type="button"
                disabled={
                  processingId ===
                  showCancelFor
                }
                onClick={() =>
                  handleCancel(
                    showCancelFor
                  )
                }
                className="rounded-xl bg-orange-500 py-3 text-white disabled:opacity-50"
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

          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />

            <h3 className="text-center text-lg font-semibold">
              {t.review_orders ??
                "Review"}
            </h3>

            <div className="mt-5 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(
                (
                  star
                ) => (
                  <button
                    key={
                      star
                    }
                    type="button"
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

            <textarea
              rows={4}
              value={comment}
              onChange={(e) =>
                setComment(
                  e.target
                    .value
                )
              }
              placeholder={
                t.default_review_comment ??
                "Write review..."
              }
              className="mt-4 w-full rounded-xl border p-3"
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={
                  resetReview
                }
                className="rounded-xl border py-3"
              >
                {t.close ??
                  "Close"}
              </button>

              <button
                type="button"
                disabled={
                  processingId ===
                  activeReviewId
                }
                onClick={() => {
                  const order =
                    orders.find(
                      (
                        item
                      ) =>
                        item.id ===
                        activeReviewId
                    );

                  if (order) {
                    handleReview(
                      order
                    );
                  }
                }}
                className="rounded-xl bg-orange-500 py-3 text-white disabled:opacity-50"
              >
                {t.submit_review ??
                  "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVED POPUP */}
      {confirmReceivedFor && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={() =>
              setConfirmReceivedFor(
                null
              )
            }
            className="absolute inset-0 bg-black/40"
          />

          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />

            <h3 className="text-center text-lg font-semibold">
              {t.received ??
                "Received"}
            </h3>

            <p className="mt-2 text-center text-sm text-gray-500">
              {t.confirm_received_order ??
                "Confirm that you received this order?"}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setConfirmReceivedFor(
                    null
                  )
                }
                className="rounded-xl border py-3"
              >
                {t.cancel ??
                  "Cancel"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  await handleReceived(
                    confirmReceivedFor
                  );

                  setConfirmReceivedFor(
                    null
                  );
                }}
                className="rounded-xl bg-green-600 py-3 text-white"
              >
                {t.ok ??
                  "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
