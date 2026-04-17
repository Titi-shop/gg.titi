"use client";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type Props = {
  status: string;
  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
};

export default function CustomerOrderActions({
  status,
  onDetail,
  onCancel,
  onReceived,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="flex gap-2 flex-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      {/* DETAIL */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDetail();
        }}
        className="px-3 py-1.5 border rounded-lg text-sm"
      >
        {t.detail ?? "Detail"}
      </button>

      {/* CANCEL */}
      {status === "pending" && onCancel && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          className="px-3 py-1.5 border border-red-500 text-red-500 rounded-lg text-sm"
        >
          {t.cancel_order ?? "Cancel"}
        </button>
      )}

      {/* RECEIVED */}
      {status === "shipping" && onReceived && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReceived();
          }}
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm"
        >
          {t.received ?? "Received"}
        </button>
      )}
    </div>
  );
}
