"use client";

import { useState } from "react";

import { getPiAccessToken } from "@/lib/piAuth";

import {
  ORDER_STATUS,
  type OrderStatus,
} from "@/constants/order-status";

import type {
  CancelReasonKey,
  Order,
} from "@/types/orders";

type TranslateObject = Record<
  string,
  string | undefined
>;

type Props = {
  mutate: () => Promise<unknown>;

  markReviewed: (
    orderId: string
  ) => void;

  showToast: (
    message: string
  ) => void;

  t: TranslateObject;

  onCloseReview: () => void;

  onCloseCancel: () => void;
};

export function useOrderActions({
  mutate,
  markReviewed,
  showToast,
  t,
  onCloseReview,
  onCloseCancel,
}: Props) {
  const [
    processingId,
    setProcessingId,
  ] = useState<string | null>(
    null
  );

  const [
    selectedReason,
    setSelectedReason,
  ] = useState<
    CancelReasonKey | ""
  >("");

  const [
    customReason,
    setCustomReason,
  ] = useState("");

  const [rating, setRating] =
    useState(5);

  const [comment, setComment] =
    useState("");

  function resetCancel() {
    setSelectedReason("");
    setCustomReason("");
    onCloseCancel();
  }

  function resetReview() {
    setRating(5);
    setComment("");
    onCloseReview();
  }

  async function handleCancel(
    orderId: string
  ) {
    const reason =
      selectedReason ===
      "cancel_reason_other"
        ? customReason.trim()
        : selectedReason;

    if (!reason) {
      showToast(
        t.select_cancel_reason ??
          "Select reason"
      );

      return;
    }

    setProcessingId(orderId);

    try {
      const token =
        await getPiAccessToken();

      if (!token) {
        showToast(
          t.login_required ??
            "Login required"
        );

        return;
      }

      const res = await fetch(
        `/api/orders/${orderId}/cancel`,
        {
          method: "PATCH",
          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            cancel_reason: reason,
          }),
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      await mutate();

      resetCancel();

      showToast(
        t.cancel_success ??
          "Cancelled"
      );
    } catch {
      showToast(
        t.cancel_failed ??
          "Cancel failed"
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReceived(
    orderId: string
  ) {
    if (processingId) {
      return;
    }

    setProcessingId(orderId);

    try {
      const token =
        await getPiAccessToken();

      if (!token) {
        showToast(
          t.login_required ??
            "Login required"
        );

        return;
      }

      const res = await fetch(
        `/api/orders/${orderId}/complete`,
        {
          method: "PATCH",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      await mutate();

      showToast(
        t.received_success ??
          "Order received"
      );
    } catch {
      showToast(
        t.action_failed ??
          "Failed"
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReview(
    order: Order
  ) {
    if (processingId) {
      return;
    }

    const status =
      (order.fulfillment_status ??
        ORDER_STATUS.PENDING) as OrderStatus;

    if (
      status !==
        ORDER_STATUS.DELIVERED &&
      status !==
        ORDER_STATUS.COMPLETED
    ) {
      showToast(
        t.review_not_available ??
          "Review not available"
      );

      return;
    }

    setProcessingId(order.id);

    try {
      const token =
        await getPiAccessToken();

      if (!token) {
        showToast(
          t.login_required ??
            "Login required"
        );

        return;
      }

      const productId =
        order.order_items?.[0]
          ?.product_id;

      if (!productId) {
        showToast(
          t.review_failed ??
            "Review failed"
        );

        return;
      }

      const res = await fetch(
        "/api/reviews",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            order_id: order.id,
            product_id: productId,
            rating,
            comment:
              comment.trim() ||
              "Good product",
          }),
        }
      );

      if (!res.ok) {
        throw new Error();
      }

      markReviewed(order.id);

      await mutate();

      resetReview();

      showToast(
        t.review_success ??
          "Review success"
      );
    } catch {
      showToast(
        t.review_failed ??
          "Review failed"
      );
    } finally {
      setProcessingId(null);
    }
  }

  return {
    processingId,

    selectedReason,
    setSelectedReason,

    customReason,
    setCustomReason,

    rating,
    setRating,

    comment,
    setComment,

    resetCancel,
    resetReview,

    handleCancel,
    handleReceived,
    handleReview,
  };
}
