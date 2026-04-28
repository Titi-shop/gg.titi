
"use client";

import { useCallback } from "react";
import { getPiAccessToken } from "@/lib/piAuth";
import type { ShippingInfo, Region } from "./checkout.types";

/* =========================
   TYPES
========================= */

type Item = {
  id: string;
  name: string;
  thumbnail?: string;
  stock: number;
};

type PreviewPayload = {
  shipping: ShippingInfo;
  zone: Region;
  item: Item;
  quantity: number;
  variant_id?: string | null;
};

type ValidateParams = {
  user: unknown;
  piReady: boolean;
  shipping: ShippingInfo | null;
  zone: Region | null;
  item: Item | null;
  quantity: number;
  maxStock: number;
  pilogin?: () => void;
  showMessage: (text: string) => void;
  t: Record<string, string>;
};

type UseCheckoutPayParams = {
  item: Item | null;
  quantity: number;
  shipping: ShippingInfo | null;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  processingRef: { current: boolean };
  t: Record<string, string>;
  user: unknown;
  router: { replace: (path: string) => void };
  onClose: () => void;
  zone: Region | null;
  product: { variant_id?: string | null };
  showMessage: (text: string, type?: "error" | "success") => void;
  validate: () => boolean;
};

/* =========================
   PI SAFE CHECK
========================= */

function getPi() {
  if (typeof window === "undefined") return null;
  return (window as any).Pi || null;
}

/* =========================
   PREVIEW (OPTIONAL UI ONLY)
========================= */

async function previewOrderDirect({
  shipping,
  zone,
  item,
  quantity,
  variant_id,
}: PreviewPayload) {
  const token = await getPiAccessToken();

  const res = await fetch("/api/orders/preview", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      country: shipping.country.toUpperCase(),
      zone,
      shipping: {
        region: shipping.region,
        district: shipping.district,
        ward: shipping.ward,
      },
      items: [
        {
          product_id: item.id,
          variant_id: variant_id ?? null,
          quantity,
        },
      ],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "PREVIEW_FAILED");
  }

  return data as { total: number };
}

/* =========================
   ERROR MAP
========================= */

export const getErrorKey = (code?: string) => {
  const map: Record<string, string> = {
    UNSUPPORTED_COUNTRY: "unsupported_country",
    PREVIEW_FAILED: "order_preview_failed",
    INVALID_REGION: "invalid_region",
    SHIPPING_NOT_AVAILABLE: "shipping_not_available",
    OUT_OF_STOCK: "error_out_of_stock",
    INVALID_QUANTITY: "error_invalid_quantity",
  };

  return map[code || ""] || "unknown_error";
};

/* =========================
   PAY FLOW (FIXED)
========================= */

export function useCheckoutPay({
  item,
  quantity,
  shipping,
  processing,
  setProcessing,
  processingRef,
  t,
  user,
  router,
  onClose,
  zone,
  product,
  showMessage,
  validate,
}: UseCheckoutPayParams) {
  return useCallback(async () => {
    if (processing || processingRef.current) return;

    if (!validate()) return;

    const Pi = getPi();

    if (!Pi?.createPayment) {
      showMessage("Pi Wallet chưa sẵn sàng");
      return;
    }

    processingRef.current = true;
    setProcessing(true);

    try {
      /* =========================
         1. CREATE INTENT
      ========================= */

      const token = await getPiAccessToken();

      const intentRes = await fetch("/api/payments/pi/create-intent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: item!.id,
          variant_id: product.variant_id ?? null,
          quantity,
          country: shipping!.country,
          zone,
          shipping,
        }),
      });

      const intentData = await intentRes.json();

      if (!intentRes.ok || !intentData?.paymentIntentId) {
        throw new Error(intentData?.error || "CREATE_INTENT_FAILED");
      }

      /* =========================
         2. OPEN PI WALLET (CRITICAL FIX)
      ========================= */

      Pi.createPayment(
        {
          amount: intentData.amount, // ⚠️ IMPORTANT: use backend source of truth
          memo: t.payment_memo_order ?? "order_payment",
          metadata: {
            intent_id: intentData.paymentIntentId,
            product_id: item!.id,
            variant_id: product.variant_id ?? null,
            quantity,
          },
        },
        {
          /* =========================
             APPROVAL
          ========================= */
          onReadyForServerApproval: (paymentId, callback) => {
            callback();
          },

          /* =========================
             COMPLETION
          ========================= */
          onReadyForServerCompletion: async (piPaymentId, txid) => {
            try {
              const token = await getPiAccessToken();

              const res = await fetch("/api/payments/pi/submit", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  payment_intent_id: intentData.paymentIntentId,
                  pi_payment_id: piPaymentId,
                  txid,
                }),
              });

              const data = await res.json();

              if (!res.ok) {
                throw new Error(data?.error || "SUBMIT_FAILED");
              }

              onClose();
              router.replace("/customer/orders?tab=pending");
              showMessage(t.payment_success ?? "success", "success");
            } catch (err) {
              console.error(err);
              showMessage(t.payment_failed ?? "payment_failed");
            } finally {
              processingRef.current = false;
              setProcessing(false);
            }
          },

          /* =========================
             CANCEL
          ========================= */
          onCancel: () => {
            processingRef.current = false;
            setProcessing(false);
            showMessage(t.payment_cancelled ?? "cancelled");
          },

          /* =========================
             ERROR
          ========================= */
          onError: () => {
            processingRef.current = false;
            setProcessing(false);
            showMessage(t.payment_failed ?? "payment_failed");
          },
        }
      );
    } catch (err) {
      console.error("CHECKOUT ERROR:", err);
      processingRef.current = false;
      setProcessing(false);
      showMessage(t.transaction_failed ?? "transaction_failed");
    }
  }, [
    item,
    quantity,
    shipping,
    processing,
    setProcessing,
    processingRef,
    t,
    user,
    router,
    onClose,
    zone,
    product.variant_id,
    validate,
    showMessage,
  ]);
}
