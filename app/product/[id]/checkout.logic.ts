

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
  router: { push: (path: string) => void };
  onClose: () => void;
  zone: Region | null;
  product: { variant_id?: string | null };
  showMessage: (text: string, type?: "error" | "success") => void;
  validate: () => boolean;
  preview: { total: number } | null;
};

/* =========================
   PREVIEW DIRECT (SAFE)
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
   PAY (PRODUCTION SAFE)
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
    /* ===== BLOCK DOUBLE CLICK ===== */
    if (processingRef.current || processing) return;

    if (!validate()) return;
if (!preview || typeof preview.total !== "number") {
  showMessage(t.order_preview_error ?? "Đang tính giá, vui lòng chờ...");
  return;
}

    processingRef.current = true;
    setProcessing(true);

    try {
      /* ===== ENSURE PREVIEW ===== */
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

      if (!finalPreview) {
        showMessage(t.order_preview_error ?? "preview_error");
        return;
      }

      /* ===== PI PAYMENT ===== */
      /* =========================
   CREATE PAYMENT INTENT FIRST
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

const intentData = await intentRes.json();

if (!intentRes.ok) {
  showMessage(t.payment_intent_failed ?? intentData?.error ?? "payment_intent_failed");
  throw new Error(intentData?.error || "PAYMENT_INTENT_FAILED");
}

const paymentIntentId = intentData.paymentIntentId;
const lockedAmount = Number(intentData.amount);
const lockedMemo = intentData.memo || (t.payment_memo_order ?? "order_payment");

/* =========================
   OPEN PI WALLET
========================= */

window.Pi?.createPayment(
  {
    amount: lockedAmount,
    memo: lockedMemo,
    metadata: {
      payment_intent_id: paymentIntentId,
      product_id: item?.id,
      variant_id: product.variant_id ?? null,
      quantity,
    },
  },
  {
    /* =========================
       MERCHANT APPROVAL
    ========================= */
    onReadyForServerApproval: async (paymentId, callback) => {
      try {
        const token = await getPiAccessToken();

        const res = await fetch("/api/payments/pi/submit", {
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

        if (!res.ok) {
          showMessage(t.payment_approve_failed ?? data?.error ?? "approve_failed");
          throw new Error(data?.error || "APPROVE_FAILED");
        }

        callback();
      } catch (err) {
        processingRef.current = false;
        setProcessing(false);
        showMessage(t.payment_approve_error ?? "approve_error");
        throw err;
      }
    },

    /* =========================
       BLOCKCHAIN COMPLETE
    ========================= */
    onReadyForServerCompletion: async (paymentId, txid, callback) => {
      try {
        const token = await getPiAccessToken();

        const res = await fetch("/api/payments/pi/reconcile", {
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

        if (!res.ok) {
          showMessage(t.payment_complete_failed ?? data?.error ?? "complete_failed");
          throw new Error(data?.error || "RECONCILE_FAILED");
        }

        callback();

        onClose();
        router.replace("/customer/orders?tab=pending");
        showMessage(t.payment_success ?? "success", "success");
      } catch (err) {
        processingRef.current = false;
        setProcessing(false);
        showMessage(t.payment_failed ?? "payment_failed");
        throw err;
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

    onError: (err) => {
      console.error("PI SDK ERROR:", err);
      processingRef.current = false;
      setProcessing(false);
      showMessage(t.payment_failed ?? "payment_failed");
    },
  }
);
    /* =========================
       SUCCESS → REDIRECT
    ========================= */
    onClose();

    router.replace("/customer/orders?tab=pending");

    showMessage(t.payment_success ?? "success", "success");

  } catch (err) {
    console.error("COMPLETE ERROR:", err);

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
    } catch {
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
