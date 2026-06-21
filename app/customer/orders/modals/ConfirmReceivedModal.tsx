"use client";

type Props = {
  open: boolean;

  processingId: string | null;

  onClose: () => void;

  onConfirm: () => Promise<void>;

  t: Record<
    string,
    string | undefined
  >;
};

export default function ConfirmReceivedModal({
  open,
  processingId,
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
          border-t border-[var(--border)]
          bg-[var(--card-bg)]
          p-5
          pb-[calc(env(safe-area-inset-bottom)+80px)]
          text-[var(--foreground)]
        "
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300" />

        <h3 className="text-center text-lg font-semibold">
          {t.received ??
            "Received"}
        </h3>

        <p
          className="
            mt-2
            text-center
            text-sm
            text-[var(--text-muted)]
          "
        >
          {t.confirm_received_order ??
            "Confirm that you received this order?"}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
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
            {t.cancel ??
              "Cancel"}
          </button>

          <button
            type="button"
            disabled={
              processingId !==
              null
            }
            onClick={() => {
              void onConfirm();
            }}
            className={`
              rounded-xl
              py-3
              text-white
              transition

              ${
                processingId
                  ? `
                    bg-green-400
                    opacity-70
                    cursor-not-allowed
                  `
                  : `
                    bg-green-600
                    active:scale-95
                  `
              }
            `}
          >
            {processingId
              ? (
                  t.processing ??
                  "Processing..."
                )
              : (
                  t.ok ??
                  "OK"
                )}
          </button>
        </div>
      </div>
    </div>
  );
}
