"use client";

type Props = {
  open: boolean;

  rating: number;
  comment: string;

  processingId: string | null;

  setRating: (
    value: number
  ) => void;

  setComment: (
    value: string
  ) => void;

  onClose: () => void;

  onSubmit: () => void;

  t: Record<
    string,
    string | undefined
  >;
};

export default function ReviewOrderModal({
  open,
  rating,
  comment,
  processingId,
  setRating,
  setComment,
  onClose,
  onSubmit,
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
          max-h-[88vh]
          overflow-y-auto
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
          {t.review_orders ??
            "Review"}
        </h3>

        <div className="mt-5 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(
            star => (
              <button
                key={star}
                type="button"
                onClick={() =>
                  setRating(star)
                }
                className={
                  star <= rating
                    ? "text-3xl text-yellow-500"
                    : "text-3xl text-gray-400"
                }
              >
                ★
              </button>
            )
          )}
        </div>

        <textarea
          rows={4}
          value={comment}
          onChange={e =>
            setComment(
              e.target.value
            )
          }
          placeholder={
            t.default_review_comment ??
            "Write review..."
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

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="
              rounded-2xl
              border border-orange-500/30
              bg-[var(--card-secondary)]
              py-3
              text-[var(--foreground)]
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
            onClick={onSubmit}
            className={`
              rounded-2xl
              py-3
              font-semibold
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
                    bg-orange-500
                    active:scale-95
                  `
              }
            `}
          >
            {processingId
              ? (
                  t.processing ??
                  "Submitting..."
                )
              : (
                  t.submit_review ??
                  "Submit"
                )}
          </button>
        </div>
      </div>
    </div>
  );
}
