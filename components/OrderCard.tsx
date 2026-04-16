"use client";

type Props = {
  status: string;
  orderId: string;
  loading?: boolean;

  onDetail?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
};

export default function OrderActions({
  status,
  loading,
  onDetail,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="flex gap-2">

      {/* DETAIL */}
      {onDetail && (
        <button
          onClick={onDetail}
          className="px-3 py-1.5 text-xs border rounded-lg"
        >
          Detail
        </button>
      )}

      {/* 🔥 PENDING */}
      {status === "pending" && (
        <>
          <button
            disabled={loading}
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded-lg disabled:opacity-50"
          >
            Confirm
          </button>

          <button
            disabled={loading}
            onClick={onCancel}
            className="px-3 py-1.5 text-xs border border-gray-400 rounded-lg"
          >
            Cancel
          </button>
        </>
      )}

      {/* SHIPPING */}
      {status === "confirmed" && (
        <button className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg">
          Shipping
        </button>
      )}
    </div>
  );
}
