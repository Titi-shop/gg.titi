              "use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import CustomerOrdersList from "@/components/CustomerOrdersList";
import { formatPi } from "@/lib/pi";
import { useOrders } from "./hooks/useOrders";
import { useOrderReviews } from "./hooks/useOrderReviews";
import { useOptimisticOrders } from "./hooks/useOptimisticOrders";
import { useOrderActions } from "./hooks/useOrderActions";

import CancelOrderModal from "./modals/CancelOrderModal";
import ReviewOrderModal from "./modals/ReviewOrderModal";
import ConfirmReceivedModal from "./modals/ConfirmReceivedModal";

export default function CustomerOrdersPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const { user, loading } = useAuth();

  const [toast, setToast] = useState("");

  const [showCancelFor, setShowCancelFor] =
    useState<string | null>(null);

  const [activeReviewId, setActiveReviewId] =
    useState<string | null>(null);

  const [confirmReceivedFor, setConfirmReceivedFor] =
    useState<string | null>(null);

  const {
    orders,
    totalPi,
    mutate,
    isLoading,
  } = useOrders(user);

  const mergedOrders =
    useOptimisticOrders(orders);

  const {
    reviewedMap,
    markReviewed,
  } = useOrderReviews();

  const {
    processingId,

    rating,
    setRating,

    comment,
    setComment,

    selectedReason,
    setSelectedReason,

    customReason,
    setCustomReason,

    resetReview,
    resetCancel,

    handleCancel,
    handleReceived,
    handleReview,
  } = useOrderActions({
    mutate,
    markReviewed,
    showToast: setToast,
    t,
    onCloseReview: () =>
      setActiveReviewId(null),
    onCloseCancel: () =>
      setShowCancelFor(null),
  });

  if (loading || isLoading) {
    return (
      <main className="min-h-screen bg-[var(--background)] p-4 space-y-4">
        {Array.from({ length: 4 }).map(
          (_, index) => (
            <div
              key={index}
              className="
                h-28
                rounded-2xl
                animate-pulse
                border border-orange-500/20
                bg-[var(--card-bg)]
              "
            />
          )
        )}
      </main>
    );
  }

  return (
    <main
      className="
        min-h-screen
        bg-[var(--background)]
        text-[var(--foreground)]
        pb-32
        transition-colors
        duration-300
      "
    >
      {toast && (
        <div
          className="
            fixed top-16 left-1/2 z-50
            -translate-x-1/2
            rounded-full
            border border-orange-500
            bg-[var(--card-bg)]
            px-4 py-2
            text-sm font-medium
            text-[var(--foreground)]
            shadow-lg
          "
        >
          {toast}
        </div>
      )}

      <header className="px-4 py-4">
        <div
          className="
            rounded-2xl
            border border-orange-500/30
            bg-[var(--card-bg)]
            p-4
            shadow-sm
          "
        >
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {t.orders ?? "Orders"}
          </p>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {mergedOrders.length}
            {" · "}
            π{formatPi(totalPi)}
          </p>
        </div>
      </header>

      <CustomerOrdersList
        initialTab="all"
        orders={mergedOrders}
        reviewedMap={reviewedMap}
        onDetail={(id) =>
          router.push(
            `/customer/orders/${id}`
          )
        }
        onCancel={setShowCancelFor}
        onReceived={
          setConfirmReceivedFor
        }
        onReview={
          setActiveReviewId
        }
      />

      <CancelOrderModal
        open={Boolean(showCancelFor)}
        processingId={processingId}
        selectedReason={selectedReason}
        customReason={customReason}
        setSelectedReason={
          setSelectedReason
        }
        setCustomReason={
          setCustomReason
        }
        onClose={resetCancel}
        onConfirm={() => {
          if (!showCancelFor) {
            return;
          }

          void handleCancel(
            showCancelFor
          );
        }}
        t={t}
      />

      <ReviewOrderModal
        open={Boolean(
          activeReviewId
        )}
        rating={rating}
        comment={comment}
        processingId={
          processingId
        }
        setRating={setRating}
        setComment={setComment}
        onClose={resetReview}
        onSubmit={() => {
          const order =
            mergedOrders.find(
              item =>
                item.id ===
                activeReviewId
            );

          if (!order) {
            return;
          }

          void handleReview(order);
        }}
        t={t}
      />

      <ConfirmReceivedModal
        open={Boolean(
          confirmReceivedFor
        )}
        processingId={
          processingId
        }
        onClose={() =>
          setConfirmReceivedFor(
            null
          )
        }
        onConfirm={async () => {
          if (
            !confirmReceivedFor
          ) {
            return;
          }

          await handleReceived(
            confirmReceivedFor
          );

          setConfirmReceivedFor(
            null
          );
        }}
        t={t}
      />
    </main>
  );
}
