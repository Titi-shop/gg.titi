"use client";

import {
  CANCEL_REASON_KEYS,
  type CancelReasonKey,
} from "@/types/orders";

type Props = {
  open: boolean;

  processingId: string | null;

  selectedReason:
    | CancelReasonKey
    | "";

  customReason: string;

  setSelectedReason: (
    value:
      | CancelReasonKey
      | ""
  ) => void;

  setCustomReason: (
    value: string
  ) => void;

  onClose: () => void;

  onConfirm: () => void;

  t: Record<
    string,
    string | undefined
  >;
};

export default function CancelOrderModal({
  open,
  processingId,
  selectedReason,
  customReason,
  setSelectedReason,
  setCustomReason,
  onClose,
  onConfirm,
  t,
}: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        className="
          absolute bottom-0 left-0 right-0
          rounded-t-3xl
          border-t border-orange-500/30
          bg-[var(--card-bg)]
          p-5
          pb-[calc(env(safe-area-inset-bottom)+80px)]
          text-[var(--foreground)]
        "
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />

        <h3 className="text-center text-lg font-semibold">
          {t.cancel_order ??
            "Cancel Order"}
        </h3>

        <div className="mt-5 space-y-2">
          {CANCEL_REASON_KEYS.map(
            reason => (
              <button
                key={reason}
                type="button"
                onClick={() =>
                  setSelectedReason(
                    reason
                  )
                }
                className={`
                  w-full
                  rounded-xl
                  border
                  px-4
                  py-3
                  text-left
                  transition
                  ${
                    selectedReason ===
                    reason
                      ? `
                        border-[var(--color-primary)]
                        bg-[var(--color-primary)]/10
                        text-[var(--color-primary)]
                      `
                      : `
                        border-[var(--border)]
                      `
                  }
                `}
              >
                {t[reason] ??
                  reason}
              </button>
            )
          )}
        </div>

        {selectedReason ===
          "cancel_reason_other" && (
          <textarea
            rows={3}
            value={customReason}
            onChange={e =>
              setCustomReason(
                e.target.value
              )
            }
            placeholder={
              t.enter_cancel_reason ??
              "Enter reason"
            }
            className="
              mt-3
              w-full
              rounded-2xl
              border border-orange-500/20
              bg-[var(--card-secondary)]
              p-3
              text-[var(--foreground)]
              placeholder:text-[var(--text-muted)]
              outline-none
            "
          />
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="
              rounded-xl
              border
              border-[var(--border)]
              py-3
            "
          >
            {t.close ??
              "Close"}
          </button>

          <button
            type="button"
            disabled={
              processingId !==
              null
            }
            onClick={onConfirm}
            className={`
              rounded-xl
              py-3
              text-white
              transition

              ${
                processingId
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
            {processingId
              ? (
                  t.cancelling ??
                  "Cancelling..."
                )
              : (
                  t.confirm ??
                  "Confirm"
                )}
          </button>
        </div>
      </div>
    </div>
  );
}
