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
  total: number;
  shipping: ShippingInfo | null;
  unitPrice: number;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  processingRef: { current: boolean };
  t: Record<string, string>;
  user: unknown;
  router: {
    push: (path: string) => void;
    replace: (path: string) => void;
  };
  onClose: () => void;
  zone: Region | null;
  product: { variant_id?: string | null };
  showMessage: (text: string, type?: "error" | "success") => void;
  validate: () => boolean;
  preview: { total: number } | null;
};

/* =========================
   PREVIEW DIRECT (OPTIONAL)
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
    PI_APPROVE_FAILED: "payment_approve_failed",
    PI_COMPLETE_FAILED: "payment_complete_failed",
    INVALID_TXID: "payment_invalid_txid",
  };

  return map[code || ""] || "unknown_error";
};

/* =========================
   VALIDATE
========================= */

export function validateBeforePay({
  user,
  piReady,
  shipping,
  zone,
  item,
  quantity,
  maxStock,
  pilogin,
  showMessage,
  t,
}: ValidateParams): boolean {
  if (!user) {
    localStorage.setItem("pending_checkout", "1");
    pilogin?.();
    showMessage(t.please_login ?? "please_login");
    return false;
  }

  if (!piReady) {
    showMessage(t.pi_not_ready ?? "pi_not_ready");
    return false;
  }

  if (!shipping) {
    showMessage(t.please_add_shipping_address ?? "no_address");
    return false;
  }

  if (!shipping.country) {
    showMessage(t.invalid_shipping_country ?? "invalid_country");
    return false;
  }

  if (!shipping.region) {
    showMessage(t.invalid_shipping_region ?? "invalid_region");
    return false;
  }

  if (!zone) {
    showMessage(t.shipping_required ?? "select_region");
    return false;
  }

  if (!item || !item.id) {
    showMessage(t.invalid_product ?? "invalid_product");
    return false;
  }

  if (quantity < 1 || quantity > maxStock) {
    showMessage(t.invalid_quantity ?? "invalid_quantity");
    return false;
  }

  if (item.stock <= 0) {
    showMessage(t.out_of_stock ?? "out_of_stock");
    return false;
  }
   return true;

}
/* =========================
   PAY
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
}: UseCheckoutPayParams) {
  return useCallback(async () => {
    if (processingRef.current || processing) return;
    if (!validate()) return;

    processingRef.current = true;
    setProcessing(true);

    try {
      let finalPreview = preview;

      if (!finalPreview && shipping && zone && item) {
        try {
          finalPreview = await previewOrderDirect({
            shipping,
            zone,
            item,
            quantity,
            variant_id: product.variant_id ?? null,
          });
        } catch (err) {
          const key = getErrorKey((err as Error).message);
          showMessage(t[key] ?? key);
          throw err;
        }
      }

      /* =========================
         CREATE PAYMENT INTENT
      ========================= */

      const token = await getPiAccessToken();

      const intentRes = await fetch("/api/payments/pi/create-intent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: item?.id,
          variant_id: product.variant_id ?? null,
          quantity,
          country: shipping?.country,
          zone,
          shipping: {
            name: shipping?.name,
            phone: shipping?.phone,
            address_line: shipping?.address_line,
            ward: shipping?.ward,
            district: shipping?.district,
            region: shipping?.region,
            postal_code: shipping?.postal_code,
          },
        }),
      });

      const intentData = await intentRes.json().catch(() => null);

      if (!intentRes.ok) {
        showMessage(
          t.payment_intent_failed ??
            intentData?.error ??
            "payment_intent_failed"
        );
        throw new Error(intentData?.error || "PAYMENT_INTENT_FAILED");
      }

      const paymentIntentId = intentData.paymentIntentId;

      const lockedAmount = Number(Number(intentData.amount || 0).toFixed(7));

      const lockedMemo =
        typeof intentData.memo === "string" && intentData.memo.trim()
          ? intentData.memo.trim().slice(0, 120)
          : (t.payment_memo_order ?? "Order payment");

      console.log("🟢 [CHECKOUT] INTENT_OK", {
        paymentIntentId,
        lockedAmount,
        lockedMemo,
      });

      if (!window.Pi || typeof window.Pi.createPayment !== "function") {
        processingRef.current = false;
        setProcessing(false);
        showMessage("Pi Wallet SDK not ready");
        return;
      }

      /* =========================
         OPEN PI WALLET
      ========================= */

      window.Pi.createPayment(
        {
          amount: lockedAmount,
          memo: lockedMemo,
          metadata: {
            payment_intent_id: paymentIntentId,
          },
        },
        {
          /* =========================================
             STAGE 1 = SERVER APPROVAL ONLY
             CALL /authorize
          ========================================= */
          onReadyForServerApproval: async (paymentId, callback) => {
            try {
              console.log("🟡 [CHECKOUT] APPROVAL_STAGE", { paymentId });

              const token = await getPiAccessToken();

              const res = await fetch("/api/payments/pi/authorize", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  payment_intent_id: paymentIntentId,
                  pi_payment_id: paymentId,
                }),
              });

              const data = await res.json().catch(() => null);

              console.log("🟡 [CHECKOUT] AUTHORIZE_RESPONSE", {
                status: res.status,
                data,
              });

              if (!res.ok) {
                const key = getErrorKey(data?.error);
                showMessage(t[key] ?? data?.error ?? "approve_failed");
                throw new Error(data?.error || "AUTHORIZE_FAILED");
              }

              console.log("🟢 [CHECKOUT] AUTHORIZE_OK");

              callback();
            } catch (err) {
              console.error("🔥 [CHECKOUT] APPROVAL_FAIL", err);
              processingRef.current = false;
              setProcessing(false);
              throw err;
            }
          },

          /* =========================================
             STAGE 2 = BLOCKCHAIN COMPLETE
             CALL /submit
          ========================================= */
          onReadyForServerCompletion: (paymentId, txid, callback) => {
  console.log("🟡 [CHECKOUT] COMPLETION_STAGE", {
    paymentId,
    txid,
  });

  /* release Pi Wallet immediately */
  try {
    callback();
    console.log("🟢 [CHECKOUT] PI_CALLBACK_OK");
  } catch (sdkErr) {
    console.warn("🟠 [CHECKOUT] PI_CALLBACK_WARN", sdkErr);
  }

  /* run backend settlement async after wallet closes */
  setTimeout(async () => {
    try {
      const token = await getPiAccessToken();

      console.log("🟡 [CHECKOUT] SUBMIT_STAGE");

      const res = await fetch("/api/payments/pi/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
          pi_payment_id: paymentId,
          txid,
        }),
      });

      const data = await res.json().catch(() => null);

      console.log("🟡 [CHECKOUT] SUBMIT_RESPONSE", {
        status: res.status,
        data,
      });

      if (!res.ok) {
        const key = getErrorKey(data?.error);
        showMessage(t[key] ?? data?.error ?? "payment_failed");
        processingRef.current = false;
        setProcessing(false);
        return;
      }

      console.log("🟢 [CHECKOUT] SUBMIT_OK");

      const token2 = await getPiAccessToken();

      console.log("🟡 [CHECKOUT] RECONCILE_STAGE");

      const reconcileRes = await fetch("/api/payments/pi/reconcile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token2}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
          pi_payment_id: paymentId,
          txid,
        }),
      });

      const reconcileData = await reconcileRes.json().catch(() => null);

      console.log("🟡 [CHECKOUT] RECONCILE_RESPONSE", {
        status: reconcileRes.status,
        data: reconcileData,
      });

      if (!reconcileRes.ok) {
        const key = getErrorKey(reconcileData?.error);
        showMessage(t[key] ?? reconcileData?.error ?? "reconcile_failed");
        processingRef.current = false;
        setProcessing(false);
        return;
      }

      console.log("🟢 [CHECKOUT] RECONCILE_OK");

      onClose();
      router.replace("/customer/orders?tab=pending");
      showMessage(t.payment_success ?? "success", "success");
    } catch (err) {
      console.error("🔥 [CHECKOUT] COMPLETION_ASYNC_FAIL", err);
      showMessage(t.transaction_failed ?? "transaction_failed");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, 50);
},

          onCancel: () => {
            console.warn("🟡 [CHECKOUT] USER_CANCELLED");
            processingRef.current = false;
            setProcessing(false);
            showMessage(t.payment_cancelled ?? "cancelled");
          },

          onError: (err) => {
            console.error("🔥 [CHECKOUT] PI_SDK_ERROR", err);
            processingRef.current = false;
            setProcessing(false);
            showMessage(t.payment_failed ?? "payment_failed");
          },
        }
      );
    } catch (err) {
      console.error("🔥 [CHECKOUT] PAY_ERROR", err);
      processingRef.current = false;
      setProcessing(false);
      showMessage(t.transaction_failed ?? "transaction_failed");
    }
  }, [
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
    product.variant_id,
    preview,
    validate,
    showMessage,
  ]);
}
