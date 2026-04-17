"use client";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type Props = {
  status: string;
  reviewed?: boolean;
  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
  onBuyAgain?: () => void;
  onReview?: () => void;
};

export default function CustomerOrderActions({
  status,
  reviewed,
  onDetail,
  onCancel,
  onReceived,
  onBuyAgain,
  onReview,
}: Props) {
  const { t } = useTranslation();

  function stop(
    e: React.MouseEvent<HTMLButtonElement>
  ) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div
      className="flex gap-2 flex-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      {/* DETAIL */}
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          onDetail();
        }}
        className="px-3 py-1.5 border rounded-lg text-sm"
      >
        {t.detail ?? "Detail"}
      </button>

      {/* PENDING */}
      {status === "pending" &&
        onCancel && (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onCancel();
            }}
            className="px-3 py-1.5 border border-red-500 text-red-500 rounded-lg text-sm"
          >
            {t.cancel_order ??
              "Cancel"}
          </button>
        )}

      {/* SHIPPING */}
      {status === "shipping" &&
        onReceived && (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onReceived();
            }}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm"
          >
            {t.received ??
              "Received"}
          </button>
        )}

      {/* COMPLETED */}
      {status === "completed" && (
        reviewed ? (
          <button
            disabled
            className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-sm"
          >
            {t.reviewed ??
              "Reviewed"}
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onReview?.();
            }}
            className="px-3 py-1.5 border border-orange-500 text-orange-500 rounded-lg text-sm"
          >
            {t.review_orders ??
              "Review"}
          </button>
        )
      )}
    </div>
  );
}
