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
  className="
    px-3 py-1.5 text-xs border rounded-lg
    active:scale-95
    transition-all duration-150
    hover:bg-gray-100
  "
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
  className={`
    px-3 py-1.5 text-xs rounded-lg text-white
    bg-gray-700
    active:scale-95
    transition-all duration-150
    ${loading ? "opacity-50" : "hover:bg-gray-800"}
  `}
>
  {loading ? "..." : t.confirm ?? "Confirm"}
</button>
          )}

          {onCancel && (
            <button
  disabled={loading}
  onClick={onCancel}
  className={`
    px-3 py-1.5 text-xs rounded-lg border
    active:scale-95
    transition-all duration-150
    ${loading ? "opacity-50" : "hover:bg-gray-100"}
  `}
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
  className={`
    px-3 py-1.5 text-xs rounded-lg text-white
    bg-blue-600
    active:scale-95
    transition-all duration-150
    ${loading ? "opacity-50" : "hover:bg-blue-700"}
  `}
>
  {loading ? "..." : t.start_shipping ?? "Start shipping"}
</button>
      )}
    </div>
  );
}
