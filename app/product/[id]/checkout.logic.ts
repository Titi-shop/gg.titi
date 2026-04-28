"use client";

import { useCallback } from "react";
import { getPiAccessToken } from "@/lib/piAuth";
import type { ShippingInfo, Region } from "./checkout.types";

/* =========================
   TYPES (giữ nguyên)
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

/* =========================
   PAY HOOK
========================= */

export function useCheckoutPay({
  item,
  quantity,
  total,
  shipping,
  unitPrice,
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
  preview,
}: any) {
  return useCallback(async () => {
    /* =====================================================
       1. HARD GUARD (tránh double click + race condition)
    ===================================================== */
    if (processingRef.current || processing) return;

    if (!validate()) return;

    if (!window?.Pi) {
      showMessage("Pi Wallet not ready");
      return;
    }

    processingRef.current = true;
    setProcessing(true);

    const paymentStartedAt = Date.now();

    try {
      /* =====================================================
         2. ENSURE PREVIEW
      ===================================================== */
      let finalPreview = preview;

      if (!finalPreview && shipping && zone && item) {
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
                variant_id: product.variant_id ?? null,
                quantity,
              },
            ],
          }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "PREVIEW_FAILED");

        finalPreview = data;
      }

      if (!finalPreview?.total) {
        showMessage(t.order_preview_error ?? "preview_error");
        return;
      }

      /* =====================================================
         3. CREATE INTENT (DB ONLY)
      ===================================================== */
      const token = await getPiAccessToken();

      const intentRes = await fetch("/api/payments/pi/create-intent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: item.id,
          variant_id: product.variant_id ?? null,
          quantity,
          country: shipping.country,
          zone,
          shipping,
        }),
      });

      const intentData = await intentRes.json();

      if (!intentRes.ok) {
        throw new Error(intentData?.error || "CREATE_INTENT_FAILED");
      }

      if (!intentData?.paymentIntentId) {
        throw new Error("INVALID_INTENT_RESPONSE");
      }

      /* =====================================================
         4. PI PAYMENT (OPEN WALLET)
      ===================================================== */
      await window.Pi.createPayment(
        {
          amount: finalPreview.total,
          memo: t.payment_memo_order ?? "order_payment",

          metadata: {
            intent_id: String(intentData.paymentIntentId),
            product_id: item.id,
            variant_id: product.variant_id ?? null,
            quantity: String(quantity),
          },
        },
        {
          onReadyForServerApproval: (_paymentId, callback) => {
            callback();
          },

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

              if (!res.ok) throw new Error("SUBMIT_FAILED");

              onClose();
              router.replace("/customer/orders?tab=pending");
              showMessage(t.payment_success ?? "success", "success");
            } catch (err) {
              console.error("SUBMIT ERROR:", err);
              showMessage(t.payment_failed ?? "payment_failed");
            } finally {
              processingRef.current = false;
              setProcessing(false);
            }
          },

          onCancel: () => {
            processingRef.current = false;
            setProcessing(false);
            showMessage(t.payment_cancelled ?? "cancelled");
          },

          onError: () => {
            processingRef.current = false;
            setProcessing(false);
            showMessage(t.payment_failed ?? "payment_failed");
          },
        }
      );

      /* =====================================================
         5. TIMEOUT SAFETY CHECK
      ===================================================== */
      if (Date.now() - paymentStartedAt > 1000 * 180) {
        throw new Error("PAYMENT_TIMEOUT");
      }
    } catch (err) {
      console.error("PAY ERROR:", err);
      processingRef.current = false;
      setProcessing(false);
      showMessage(t.transaction_failed ?? "transaction_failed");
    }
  }, [
    item,
    quantity,
    shipping,
    zone,
    product?.variant_id,
    preview,
    validate,
    processing,
  ]);
}
