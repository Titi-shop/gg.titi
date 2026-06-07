"use client";

import { useState, type MouseEvent } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import {
  ORDER_STATUS,
  type OrderStatus,
} from "@/constants/order-status";

type Props = {
  status: OrderStatus;
  reviewed?: boolean;

  onDetail: () => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
  onReceived?: () => Promise<void> | void;
  onReview?: () => Promise<void> | void;
};

export default function CustomerOrderActions({
  status,
  reviewed = false,
  onDetail,
  onCancel,
  onReceived,
  onReview,
}: Props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState<
    "detail" | "cancel" | "received" | "review" | null
  >(null);

  const handleAction =
    (
      key: "detail" | "cancel" | "received" | "review",
      fn?: () => Promise<void> | void
    ) =>
    async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (!fn || loading) return;

      try {
        setLoading(key);
        await fn();
      } finally {
        setLoading(null);
      }
    };

  const base =
    "px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:pointer-events-none";

  const isPending =
    status === ORDER_STATUS.PENDING;

  const isPendingFulfillment =
    status === ORDER_STATUS.PENDING_FULFILLMENT;

  const isProcessing =
    status === ORDER_STATUS.PROCESSING;

  const isShipped =
    status === ORDER_STATUS.SHIPPED;

  const isDelivered =
    status === ORDER_STATUS.DELIVERED;

  const isCompleted =
    status === ORDER_STATUS.COMPLETED;

  return (
    <div
      className="flex flex-wrap justify-end gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* DETAIL */}
      <button
        disabled={loading !== null}
        onClick={handleAction("detail", onDetail)}
        className={`${base} border bg-white text-gray-700`}
      >
        {loading === "detail"
          ? t.loading ?? "Loading..."
          : t.detail ?? "Detail"}
      </button>

      {/* CANCEL */}
      {(isPending || isPendingFulfillment) &&
        onCancel && (
          <button
            disabled={loading !== null}
            onClick={handleAction(
              "cancel",
              onCancel
            )}
            className={`${base} border border-red-500 text-red-500`}
          >
            {loading === "cancel"
              ? t.processing ?? "Processing..."
              : t.cancel_order ?? "Cancel"}
          </button>
        )}

      {/* PROCESSING */}
      {isProcessing && (
        <span
          className={`${base} bg-blue-50 text-blue-600`}
        >
          {t.processing ?? "Processing"}
        </span>
      )}

      {/* SHIPPED */}
{isShipped && onReceived && (
  <button
    disabled={loading !== null}
    onClick={handleAction("received", onReceived)}
    className={`${base} bg-green-600 text-white`}
  >
    {loading === "received"
      ? t.processing ?? "Processing..."
      : t.received ?? "Received"}
  </button>
)}

{/* DELIVERED - CHƯA REVIEW */}
{isDelivered && !reviewed && onReview && (
  <button
    disabled={loading !== null}
    onClick={handleAction("review", onReview)}
    className={`${base} border border-orange-500 text-orange-500`}
  >
    {loading === "review"
      ? t.processing ?? "Processing..."
      : t.review_orders ?? "Review"}
  </button>
)}

{/* DELIVERED - ĐÃ REVIEW */}
{isDelivered && reviewed && (
  <span
    className={`${base} bg-green-100 text-green-600`}
  >
    {t.order_reviewed ?? "Reviewed"}
  </span>
)}

{/* COMPLETED - CHƯA REVIEW */}
{isCompleted && !reviewed && onReview && (
  <button
    disabled={loading !== null}
    onClick={handleAction("review", onReview)}
    className={`${base} border border-orange-500 text-orange-500`}
  >
    {loading === "review"
      ? t.processing ?? "Processing..."
      : t.review_orders ?? "Review"}
  </button>
)}

{/* COMPLETED - ĐÃ REVIEW */}
{isCompleted && reviewed && (
  <span
    className={`${base} bg-green-100 text-green-600`}
  >
    {t.order_reviewed ?? "Reviewed"}
  </span>
)}
    </div>
  );
          }
