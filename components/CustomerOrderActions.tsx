"use client";

import type { MouseEvent } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* =======================================================
   TYPES
======================================================= */

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled"
  | string;

type Props = {
  status: OrderStatus;
  reviewed?: boolean;

  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
  onReview?: () => void;
};

/* =======================================================
   COMPONENT
======================================================= */

export default function CustomerOrderActions({
  status,
  reviewed = false,
  onDetail,
  onCancel,
  onReceived,
  onReview,
}: Props) {
  const { t } = useTranslation();

  function stopAndRun(
    fn?: () => void
  ) {
    return (
      e: MouseEvent<HTMLButtonElement>
    ) => {
      e.preventDefault();
      e.stopPropagation();
      fn?.();
    };
  }

  const baseBtn =
    "px-3 py-2 rounded-xl text-sm font-medium transition active:scale-95";

  return (
    <div
      className="flex flex-wrap justify-end gap-2"
      onClick={(e) =>
        e.stopPropagation()
      }
    >
      {/* DETAIL */}
      <button
        type="button"
        onClick={stopAndRun(
          onDetail
        )}
        className={`${baseBtn} border border-gray-300 bg-white text-gray-700`}
      >
        {t.detail ??
          "Detail"}
      </button>

      {/* PENDING -> CANCEL */}
      {status ===
        "pending" &&
        onCancel && (
          <button
            type="button"
            onClick={stopAndRun(
              onCancel
            )}
            className={`${baseBtn} border border-red-500 bg-white text-red-500`}
          >
            {t.cancel_order ??
              "Cancel"}
          </button>
        )}

      {/* SHIPPING -> RECEIVED */}
      {status ===
        "shipping" &&
        onReceived && (
          <button
            type="button"
            onClick={stopAndRun(
              onReceived
            )}
            className={`${baseBtn} bg-green-600 text-white`}
          >
            {t.received ??
              "Received"}
          </button>
        )}

      {/* COMPLETED -> REVIEW */}
      {status ===
        "completed" &&
        !reviewed &&
        onReview && (
          <button
            type="button"
            onClick={stopAndRun(
              onReview
            )}
            className={`${baseBtn} border border-orange-500 bg-white text-orange-500`}
          >
            {t.review_orders ??
              "Review"}
          </button>
        )}

      {/* COMPLETED -> REVIEWED */}
      {status ===
        "completed" &&
        reviewed && (
          <button
            type="button"
            disabled
            className={`${baseBtn} cursor-default bg-green-100 text-green-600`}
          >
            {t.order_review ??
              "Reviewed"}
          </button>
        )}
    </div>
  );
}
