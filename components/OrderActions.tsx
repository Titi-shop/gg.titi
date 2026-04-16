"use client";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled"
  | "returned";

type Props = {
  status: OrderStatus;
  orderId: string;
  loading?: boolean;

  onDetail?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onShipping?: () => void;
};

/* ================= COMPONENT ================= */

export default function OrderActions({
  status,
  loading,
  onDetail,
  onConfirm,
  onCancel,
  onShipping,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="flex gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* DETAIL */}
      {onDetail && (
        <button
          onClick={onDetail}
          className="px-3 py-1.5 text-xs border rounded-lg"
        >
          {t.detail ?? "Detail"}
        </button>
      )}

      {/* PENDING */}
      {status === "pending" && (
        <>
          {onConfirm && (
            <button
              disabled={loading}
              onClick={onConfirm}
              className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded-lg disabled:opacity-50"
            >
              {t.confirm ?? "Confirm"}
            </button>
          )}

          {onCancel && (
            <button
              disabled={loading}
              onClick={onCancel}
              className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-50"
            >
              {t.cancel ?? "Cancel"}
            </button>
          )}
        </>
      )}

      {/* CONFIRMED */}
      {status === "confirmed" && onShipping && (
        <button
          disabled={loading}
          onClick={onShipping}
          className="px-3 py-1.5 text-xs bg-gray-800 text-white rounded-lg disabled:opacity-50"
        >
          {t.start_shipping ?? "Start shipping"}
        </button>
      )}
    </div>
  );
}
