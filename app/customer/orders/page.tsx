"use client";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
import useSWR from "swr";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import CustomerOrdersList from "@/components/CustomerOrdersList";
import {
  ORDER_STATUS,
  type OrderStatus,
} from "@/constants/order-status";

/* =====================================================
   TYPES
===================================================== */

type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

type OrderItem = {
  product_id: string;
  product_name?: string | null;
  thumbnail?: string | null;
  quantity?: number;
};

type Order = {
  id: string;
  order_number: string;
  payment_status: PaymentStatus;
  fulfillment_status: OrderStatus;

  total: number | string;
  currency: string;
  created_at: string;
  order_items?: OrderItem[];
};

type OrdersResponse = {
  orders?: Order[];
};

/* =====================================================
   CANCEL REASONS
===================================================== */

const CANCEL_REASON_KEYS = [
  "cancel_reason_change_mind",
  "cancel_reason_wrong_product",
  "cancel_reason_change_variant",
  "cancel_reason_better_price",
  "cancel_reason_delivery_slow",
  "cancel_reason_update_address",
  "cancel_reason_other",
] as const;

type CancelReasonKey = (typeof CANCEL_REASON_KEYS)[number];

/* =====================================================
   HELPERS
===================================================== */

function normalizeOrder(order: Order): Order {
  return {
    ...order,
    fulfillment_status:
      order.fulfillment_status ?? ORDER_STATUS.PENDING_FULFILLMENT,
  };
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* =====================================================
   FETCHER
===================================================== */

const fetcher = async (): Promise<Order[]> => {
  const token = await getPiAccessToken();
  if (!token) return [];

  const res = await fetch("/api/orders", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await safeJson<unknown>(res);

  if (!data || typeof data !== "object") return [];

  if (Array.isArray(data)) {
    return (data as Order[]).map(normalizeOrder);
  }

  const typed = data as OrdersResponse;
  const orders = Array.isArray(typed.orders) ? typed.orders : [];

  return orders.map(normalizeOrder);
};

/* =====================================================
   PAGE
===================================================== */

export default function CustomerOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [optimisticOrder, setOptimisticOrder] = useState<Order | null>(null);

  const { data: orders = [], isLoading, mutate } = useSWR<Order[]>(
    user ? "/api/orders" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: true,
      revalidateOnReconnect: true,
      dedupingInterval: 3000,
    }
  );

  /* ================= OPTIMISTIC ================= */

  useEffect(() => {
    void mutate();
  }, [user, mutate]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem("optimistic_order");
    if (!raw) return;

    try {
      setOptimisticOrder(JSON.parse(raw) as Order);
    } catch {}
  }, []);

  const mergedOrders = useMemo(() => {
    if (!optimisticOrder) return orders;

    const exists = orders.some(o => o.id === optimisticOrder.id);
    return exists ? orders : [optimisticOrder, ...orders];
  }, [orders, optimisticOrder]);

  useEffect(() => {
    if (!optimisticOrder) return;

    const exists = orders.some(o => o.id === optimisticOrder.id);
    if (!exists) return;

    localStorage.removeItem("optimistic_order");
    setOptimisticOrder(null);
  }, [orders, optimisticOrder]);

  const totalPi = useMemo(
    () => mergedOrders.reduce((s, o) => s + Number(o.total ?? 0), 0),
    [mergedOrders]
  );
useEffect(() => {
  async function loadReviews() {
    try {
      const token = await getPiAccessToken();

      if (!token) return;

      const res = await fetch(
        "/api/reviews",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, boolean> = {};
      for (const review of data.reviews ?? []) {
        map[review.order_id] = true;
      }

      setReviewedMap(map);
    } catch (err) {
      console.error(err);
    }
  }

  loadReviews();
}, []);
  /* ================= STATE ================= */

  const [toast, setToast] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [showCancelFor, setShowCancelFor] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<CancelReasonKey | "">("");
  const [customReason, setCustomReason] = useState("");

  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const [reviewedMap, setReviewedMap] = useState<Record<string, boolean>>({});

  const [confirmReceivedFor, setConfirmReceivedFor] = useState<string | null>(null);

  /* ================= HELPERS ================= */

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2400);
  };

  const resetCancel = () => {
    setShowCancelFor(null);
    setSelectedReason("");
    setCustomReason("");
  };

  const resetReview = () => {
    setActiveReviewId(null);
    setRating(5);
    setComment("");
  };

  /* ================= ACTIONS ================= */

  async function handleCancel(orderId: string) {
    const reason =
      selectedReason === "cancel_reason_other"
        ? customReason.trim()
        : selectedReason;

    if (!reason) return showToast(t.select_cancel_reason ?? "Select reason");

    setProcessingId(orderId);

    try {
      const token = await getPiAccessToken();
      if (!token) return showToast(t.login_required ?? "Login required");

      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancel_reason: reason }),
      });

      if (!res.ok) throw new Error();

      await mutate();
      resetCancel();
      showToast(t.cancel_success ?? "Cancelled");
    } catch {
      showToast(t.cancel_failed ?? "Cancel failed");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReceived(orderId: string) {
  if (processingId) return;

  setProcessingId(orderId);

  try {
    const token = await getPiAccessToken();

    if (!token) {
      return showToast(
        t.login_required ??
        "Login required"
      );
    }

    const res = await fetch(
      `/api/orders/${orderId}/complete`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error();
    }

    await mutate();

    showToast(
      t.received_success ??
      "Order received"
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
  async function handleReview(order: Order) {
  if (processingId) return;

  setProcessingId(order.id);

  try {
    const token = await getPiAccessToken();

    if (!token) {
      return showToast(
        t.login_required ??
        "Login required"
      );
    }

    const productId =
      order.order_items?.[0]?.product_id;

    if (!productId) {
      return showToast(
        t.review_failed ??
        "Review failed"
      );
    }

    const res = await fetch(
      "/api/reviews",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.id,
          product_id: productId,
          rating,
          comment:
            comment.trim() ||
            "Good product",
        }),
      }
    );

    if (!res.ok) {
      throw new Error();
    }

    setReviewedMap(prev => ({
  ...prev,
  [order.id]: true,
}));

await mutate();
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
    <main className="min-h-screen bg-[var(--background)] p-4 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="
            h-28 rounded-2xl animate-pulse
            border border-orange-500/20
            bg-[var(--card-bg)]
          "
        />
      ))}
    </main>
  );
}

  /* ================= UI ================= */

  return (
  <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pb-32 transition-colors duration-300">

    {toast && (
  <div
    className="
      fixed top-16 left-1/2 z-50
      -translate-x-1/2
      rounded-full
      border border-orange-500
      bg-[var(--card-bg)]
      px-4 py-2
      text-sm font-medium
      text-[var(--foreground)]
      shadow-lg
    "
  >
    {toast}
  </div>
)}

    <header className="px-4 py-4">
  <div
    className="
      rounded-2xl
      border border-orange-500/30
      bg-[var(--card-bg)]
      p-4
      shadow-sm
    "
  >
    <p className="text-sm font-semibold text-[var(--foreground)]">
      {t.orders ?? "Orders"}
    </p>

    <p className="mt-1 text-xs text-[var(--text-muted)]">
      {mergedOrders.length} · π{formatPi(totalPi)}
    </p>
  </div>
</header>

    <Suspense fallback={
      <div className="p-4 text-sm text-center text-[var(--text-muted)]">
        Loading...
      </div>
    }>
      <CustomerOrdersList
        initialTab="all"
        orders={mergedOrders}
        reviewedMap={reviewedMap}
        onDetail={(id) => router.push(`/customer/orders/${id}`)}
        onCancel={setShowCancelFor}
        onReceived={setConfirmReceivedFor}
        onReview={setActiveReviewId}
      />
    </Suspense>

    {/* CANCEL POPUP */}
    {showCancelFor && (
      <div className="fixed inset-0 z-50">
        <div onClick={resetCancel} className="absolute inset-0 bg-black/40" />

        <div className="
  absolute bottom-0 left-0 right-0
  rounded-t-3xl
  border-t border-orange-500/30
  bg-[var(--card-bg)]
  p-5
  pb-[calc(env(safe-area-inset-bottom)+80px)]
  text-[var(--foreground)]
">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />

          <h3 className="text-center text-lg font-semibold">
            {t.cancel_order ?? "Cancel Order"}
          </h3>

          <div className="mt-5 space-y-2">
            {CANCEL_REASON_KEYS.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedReason(key)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selectedReason === key
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                    : "border-[var(--border)]"
                }`}
              >
                {t[key] ?? key}
              </button>
            ))}
          </div>

          {selectedReason === "cancel_reason_other" && (
            <textarea
              rows={3}
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              className={`
  w-full rounded-2xl border px-4 py-3 text-left transition-all
  ${
    selectedReason === key
      ? `
        border-orange-500
        bg-orange-500/10
        text-orange-500
      `
      : `
        border-orange-500/20
        bg-[var(--card-secondary)]
        text-[var(--foreground)]
      `
  }
`}
              placeholder={t.enter_cancel_reason ?? "Enter reason"}
            />
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={resetCancel}
              className="rounded-xl border border-[var(--border)] py-3"
            >
              {t.close ?? "Close"}
            </button>

            <button
  type="button"
  disabled={
    processingId === showCancelFor
  }
  onClick={() => {
    if (processingId) return;

    void handleCancel(showCancelFor);
  }}
  className={`
    rounded-xl py-3 text-white transition
    ${
      processingId === showCancelFor
        ? `
          bg-orange-400
          opacity-70
          cursor-not-allowed
        `
        : `
          bg-[var(--color-primary)]
          active:scale-95
        `
    }
  `}
>
  {processingId === showCancelFor
    ? (t.cancelling ?? "Cancelling...")
    : (t.confirm ?? "Confirm")}
</button>
          </div>
        </div>
      </div>
    )}

    {/* REVIEW POPUP */}
    {activeReviewId && (
      <div className="fixed inset-0 z-50">
        <div onClick={resetReview} className="absolute inset-0 bg-black/40" />

        <div className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-[var(--card-bg)] text-[var(--foreground)] p-5 pb-[calc(env(safe-area-inset-bottom)+80px)] border-t border-[var(--border)]">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />

          <h3 className="text-center text-lg font-semibold">
            {t.review_orders ?? "Review"}
          </h3>

          <div className="mt-5 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={
                  star <= rating
                    ? "text-3xl text-yellow-500"
                    : "text-3xl text-gray-400"
                }
              >
                ★
              </button>
            ))}
          </div>

          <textarea
            rows={4}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={t.default_review_comment ?? "Write review..."}
            className="
  mt-3 w-full rounded-2xl
  border border-orange-500/20
  bg-[var(--card-secondary)]
  p-3
  text-[var(--foreground)]
  placeholder:text-[var(--text-muted)]
  outline-none
"
          />

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={resetReview}
              className="
  rounded-2xl
  border border-orange-500/30
  bg-[var(--card-secondary)]
  py-3
  text-[var(--foreground)]
"
            >
              {t.close ?? "Close"}
            </button>

            <button
  type="button"
  disabled={
    processingId === activeReviewId
  }
  onClick={() => {
    if (processingId) return;

    const order = mergedOrders.find(
      item => item.id === activeReviewId
    );

    if (order) {
      void handleReview(order);
    }
  }}
  className={`
    rounded-2xl
    py-3
    font-semibold
    text-white
    transition
    ${
      processingId === activeReviewId
        ? `
          bg-orange-400
          opacity-70
          cursor-not-allowed
        `
        : `
          bg-orange-500
          active:scale-95
        `
    }
  `}
>
  {processingId === activeReviewId
    ? (
        t.processing ??
        "Submitting..."
      )
    : (
        t.submit_review ??
        "Submit"
      )}
</button>
          </div>
        </div>
      </div>
    )}

    {/* RECEIVED POPUP */}
    {confirmReceivedFor && (
      <div className="fixed inset-0 z-50">
        <div
          onClick={() => setConfirmReceivedFor(null)}
          className="absolute inset-0 bg-black/40"
        />

        <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-[var(--card-bg)] text-[var(--foreground)] p-5 pb-[calc(env(safe-area-inset-bottom)+80px)] border-t border-[var(--border)]">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />

          <h3 className="text-center text-lg font-semibold">
            {t.received ?? "Received"}
          </h3>

          <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
            {t.confirm_received_order ?? "Confirm that you received this order?"}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirmReceivedFor(null)}
              className="rounded-xl border border-[var(--border)] py-3"
            >
              {t.cancel ?? "Cancel"}
            </button>

            <button
  type="button"
  disabled={processingId === confirmReceivedFor}
  onClick={async () => {
    if (processingId) return;

    await handleReceived(confirmReceivedFor);
    setConfirmReceivedFor(null);
  }}
  className={`
    rounded-xl py-3 text-white transition
    ${
      processingId === confirmReceivedFor
        ? "bg-green-400 opacity-70 cursor-not-allowed"
        : "bg-green-600 active:scale-95"
    }
  `}
>
  {processingId === confirmReceivedFor
    ? (t.processing ?? "Processing...")
    : (t.ok ?? "OK")}
</button>
          </div>
        </div>
      </div>
    )}
  </main>
);
}
