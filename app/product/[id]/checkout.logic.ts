"use client";

import { useCallback ,useRef} from "react";
import { getPiAccessToken } from "@/lib/piAuth";
import type {
  ShippingInfo,
  ValidateParams,
  UseCheckoutPayParams,
} from "@/types/checkout";
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
    PAYMENT_INTENT_FAILED: "payment_intent_failed",
    RECONCILE_FAILED: "reconcile_failed",
    SUBMIT_FAILED: "payment_submit_failed",
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
  item,
  quantity,
  maxStock,
  pilogin,
  showMessage,
  t,
}: ValidateParams): boolean {
  console.log("🟡 [VALIDATE] START", {
    user,
    piReady,
    shipping,
    item,
    quantity,
  });

  /* =========================
     USER CHECK
  ========================= */
if (!user) {
  localStorage.setItem("pending_checkout", "1");
  showMessage(
    t.logging_in_pi ??
      "Connecting to Pi account...",
    "info"
  );

  setTimeout(() => {
    pilogin?.();
  }, 500);
  return false;
}

  /* =========================
     PI READY CHECK
  ========================= */
  if (!piReady) {
    showMessage(t.pi_not_ready ?? "pi_not_ready");
    return false;
  }

  /* =========================
     SHIPPING CHECK
  ========================= */
  if (!shipping) {
    showMessage(t.please_add_shipping_address ?? "no_address");
    return false;
  }

  if (!shipping.country) {
    showMessage(t.invalid_shipping_country ?? "invalid_country");
    return false;
  }
  /* =========================
     ITEM CHECK
  ========================= */
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

  /* =========================
     ZONE CHECK (NON-BLOCKING)
  ========================= */

  console.log("🟢 [VALIDATE] PASSED");
  return true;
}
/* =========================
   PAY
========================= */

export function useCheckoutPay(params: UseCheckoutPayParams) {
  const {
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
    product,
    showMessage,
    validate,
  } = params;

  const completionLockedRef = useRef(false);
  return useCallback(async () => {
    if (processingRef.current || processing) return;
    if (!validate()) return;

    processingRef.current = true;
    setProcessing(true);
showMessage(
     t.creating_order ??   "Creating order...",  "info");
    try {
      const token = await getPiAccessToken();

      const intentRes = await fetch("/api/payments/pi/create-intent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: item.id,
          variant_id: product?.selectedVariant?.id ?? null,
          quantity,
          address_id: shipping?.id,
        
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

      const paymentIntentId =
        intentData.payment_intent_id || intentData.paymentIntentId;

      if (!paymentIntentId) {
        throw new Error("PAYMENT_INTENT_ID_MISSING");
      }

      const lockedAmount = Number(Number(intentData.amount || 0).toFixed(7));
      const lockedMemo =
        typeof intentData.memo === "string" && intentData.memo.trim()
          ? intentData.memo.trim().slice(0, 120)
          : (t.payment_memo_order ?? "Order payment");

      console.log("🟢 [CHECKOUT] INTENT_OK", {
        paymentIntentId,
        lockedAmount,
      });

   showMessage(
  t.opening_pi_wallet ??
    "Opening Pi Wallet...",
  "info"
);
      
      if (!window.Pi || typeof window.Pi.createPayment !== "function") {
        throw new Error("PI_SDK_NOT_READY");
      }

      window.Pi.createPayment(
        {
          amount: lockedAmount,
          memo: lockedMemo,
          metadata: {
            payment_intent_id: paymentIntentId,
          },
        },
        {
          onReadyForServerApproval: async (paymentId, callback) => {
  try {
    console.log("🟡 [CHECKOUT] APPROVAL_STAGE", {
      paymentId,
      paymentIntentId,
    });

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

    if (!res.ok || !data?.success) {
      throw new Error(data?.error || "AUTHORIZE_FAILED");
    }

    console.log("🟢 [CHECKOUT] AUTHORIZE_OK", {
      paymentId,
    });

    callback();
  } catch (err) {
    console.error("🔥 [CHECKOUT] APPROVAL_FAIL", err);
    processingRef.current = false;
    setProcessing(false);
    showMessage(
      t.payment_approve_failed ?? "payment_approve_failed"
    );
  }
},


      onReadyForServerCompletion: async (paymentId, txid, callback) => {
  if (completionLockedRef.current) {
    console.warn("🟠 [CHECKOUT] COMPLETION_LOCKED");
    return;
  }

  completionLockedRef.current = true;

  try {
    console.log("🟡 [CHECKOUT] COMPLETION_STAGE", {
      paymentId,
      txid,
      paymentIntentId,
    });

    const token = await getPiAccessToken();

    const submitRes = await fetch("/api/payments/pi/submit", {
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

    const submitData = await submitRes.json().catch(() => null);

    if (!submitRes.ok || !submitData?.success) {
      throw new Error(submitData?.error || "SUBMIT_FAILED");
    }

    callback?.();

    const successMessage =
  t.order_created_success ??
  "Order created successfully. Please check Pending orders.";

showMessage(successMessage, "success");

window.dispatchEvent(
  new CustomEvent("global-alert", {
    detail: successMessage,
  })
);
    setTimeout(() => {
      onClose();
    }, 1500);

  } catch (err) {
    console.error("🔥 [CHECKOUT] COMPLETION_FAIL", err);

    const key = getErrorKey((err as Error).message);
    showMessage(t[key] ?? key);
  } finally {
    completionLockedRef.current = false;
    setProcessing(false);
  }
},

          onCancel: () => {
            console.warn("🟡 [CHECKOUT] USER_CANCELLED");
            processingRef.current = false;
            setProcessing(false);
            showMessage(
            t.payment_cancelled ??
            "Payment cancelled by user",
            "error"
);
          },

          onError: (err) => {
            console.error("🔥 [CHECKOUT] PI_SDK_ERROR", err);
            processingRef.current = false;
            setProcessing(false);
            showMessage(
            t.payment_failed ??
           "Payment failed. Please try again.",
          "error"
       );
          },
        }
      );
    } catch (err) {
      console.error("🔥 [CHECKOUT] PAY_ERROR", err);
      processingRef.current = false;
      setProcessing(false);
      showMessage(
    t.transaction_failed ??
    "Transaction failed. Please try again.",
  "error"
   );
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
    product?.variant_id,
    validate,
    showMessage,
  ]);
}
