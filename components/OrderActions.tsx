"use client";

import { MouseEvent } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ======================================================
   TYPES
====================================================== */

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

type Props = {
  status: OrderStatus;
  orderId: string;
  loading?: boolean;

  onDetail?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onShipping?: () => void;
};

/* ======================================================
   COMPONENT
====================================================== */

export default function OrderActions({
  status,
  loading = false,
  onDetail,
  onConfirm,
  onCancel,
  onShipping,
}: Props) {
  const { t } = useTranslation();

  /* ======================================================
     SAFE CLICK
  ====================================================== */

  function stopClick(
    callback?: () => void
  ) {
    return (
      e: MouseEvent<HTMLButtonElement>
    ) => {
      e.preventDefault();
      e.stopPropagation();

      if (loading) return;

      callback?.();
    };
  }

  /* ======================================================
     BTN BASE
  ====================================================== */

  const baseBtn =
    "px-3 py-2 text-xs sm:text-sm rounded-xl font-medium transition active:scale-95 disabled:opacity-50 disabled:scale-100";

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div
      className="flex flex-wrap gap-2 justify-end"
      onClick={(e) =>
        e.stopPropagation()
      }
    >
      {/* DETAIL */}
      {onDetail && (
        <button
          type="button"
          onClick={stopClick(
            onDetail
          )}
          disabled={loading}
          className={`${baseBtn} border bg-white text-gray-700 hover:bg-gray-50`}
        >
          {t.detail ??
            "Detail"}
        </button>
      )}

      {/* PENDING */}
      {status ===
        "pending" && (
        <>
          {onConfirm && (
            <button
              type="button"
              onClick={stopClick(
                onConfirm
              )}
              disabled={loading}
              className={`${baseBtn} bg-gray-800 text-white hover:bg-gray-900`}
            >
              {loading
                ? "..."
                : t.confirm ??
                  "Confirm"}
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={stopClick(
                onCancel
              )}
              disabled={loading}
              className={`${baseBtn} border border-red-500 text-red-500 bg-white hover:bg-red-50`}
            >
              {t.cancel ??
                "Cancel"}
            </button>
          )}
        </>
      )}

      {/* PROCESSING */}
      {status ===
        "processing" &&
        onShipping && (
          <button
            type="button"
            onClick={stopClick(
              onShipping
            )}
            disabled={loading}
            className={`${baseBtn} bg-blue-600 text-white hover:bg-blue-700`}
          >
            {loading
              ? "..."
              : t.start_shipping ??
                "Start shipping"}
          </button>
        )}

      {/* SHIPPED */}
{status === "shipped" && (
  <span className="px-3 py-2 text-xs rounded-xl bg-blue-50 text-blue-600 font-medium">
    {t.order_shipping ?? "Shipping"}
  </span>
)}

{/* DELIVERED */}
{status === "delivered" && (
  <span className="px-3 py-2 text-xs rounded-xl bg-cyan-50 text-cyan-600 font-medium">
    {t.order_delivered ?? "Delivered"}
  </span>
)}

{/* COMPLETED */}
{status === "completed" && (
  <span className="px-3 py-2 text-xs rounded-xl bg-green-50 text-green-600 font-medium">
    {t.order_completed ?? "Completed"}
  </span>
)}

{/* CANCELLED */}
{status === "cancelled" && (
  <span className="px-3 py-2 text-xs rounded-xl bg-red-50 text-red-500 font-medium">
    {t.order_cancelled ?? "Cancelled"}
  </span>
)}

{/* REFUNDED */}
{status === "refunded" && (
  <span className="px-3 py-2 text-xs rounded-xl bg-orange-50 text-orange-600 font-medium">
    {t.order_refunded ?? "Refunded"}
  </span>
)}
    </div>
  );
}
