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

type PaymentIntentResponse = {
  paymentIntentId: string;
  amount: number;
  merchantWallet: string;
  memo: string;
  nonce: string;
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
  router: { replace: (path: string) => void };
  onClose: () => void;
  zone: Region | null;
  product: { variant_id?: string | null };
  showMessage: (text: string, type?: "error" | "success") => void;
  validate: () => boolean;
  preview: { total: number } | null;
};

/* =========================
   PREVIEW DIRECT (UI ONLY)
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
   CREATE PAYMENT INTENT
========================= */

async function createPiPaymentIntent(params: {
  item: Item;
  quantity: number;
  shipping: ShippingInfo;
  zone: Region;
  variantId?: string | null;
}) {
  const token = await getPiAccessToken();

  const res = await fetch("/api/payments/pi/create-intent", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: params.item.id,
      variant_id: params.variantId ?? null,
      quantity: params.quantity,
      country: params.shipping.country.toUpperCase(),
      shipping: {
        name: params.shipping.name,
        phone: params.shipping.phone,
        address_line: params.shipping.address_line,
        ward: params.shipping.ward,
        district: params.shipping.district,
        region: params.shipping.region,
        postal_code: params.shipping.postal_code,
      },
      zone: params.zone,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "CREATE_INTENT_FAILED");
  }

  return data as PaymentIntentResponse;
}

/* =========================
   SUBMIT PAYMENT
========================= */

async function submitPiPayment(params: {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;
}) {
  const token = await getPiAccessToken();

  const res = await fetch("/api/payments/pi/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "SUBMIT_FAILED");
  }

  return data as { success: true; orderId: string };
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
    CREATE_INTENT_FAILED: "payment_intent_failed",
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

  if (!shipping.country || !shipping.region) {
    showMessage(t.invalid_shipping_country ?? "invalid_country");
    return false;
  }

  if (!zone) {
    showMessage(t.shipping_required ?? "select_region");
    return false;
  }

  if (!item?.id) {
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
   PAY FINAL
========================= */

export function useCheckoutPay({
  item,
  quantity,
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
  shipping,
}: UseCheckoutPayParams) {
  return useCallback(async () => {
    if (processingRef.current || processing) return;
    if (!validate()) return;

    processingRef.current = true;
    setProcessing(true);

    try {
      if (!preview && shipping && zone && item) {
        await previewOrderDirect({
          shipping,
          zone,
          item,
          quantity,
          variant_id: product.variant_id ?? null,
        });
      }

      if (!shipping || !zone || !item) {
        throw new Error("INVALID_CHECKOUT_DATA");
      }

      const intent = await createPiPaymentIntent({
        item,
        quantity,
        shipping,
        zone,
        variantId: product.variant_id ?? null,
      });

      if (!window.Pi) {
  throw new Error("PI_SDK_NOT_LOADED");
}

await window.Pi.createPayment(
  {
    amount: Number(intent.amount),
    memo: String(intent.memo),
    metadata: {
      payment_intent_id: String(intent.paymentIntentId),
      nonce: String(intent.nonce),
    },
  },
  {
    onReadyForServerApproval: async (_paymentId, callback) => {
      callback();
    },

    onReadyForServerCompletion: async (piPaymentId, txid) => {
      try {
        await submitPiPayment({
          paymentIntentId: intent.paymentIntentId,
          piPaymentId,
          txid,
        });

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
    },

    onError: () => {
      processingRef.current = false;
      setProcessing(false);
    },
  }
);
    } catch (err) {
      processingRef.current = false;
      setProcessing(false);

      const key = getErrorKey((err as Error).message);
      showMessage(t[key] ?? key);
    }
  }, [
    item,
    quantity,
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
    shipping,
  ]);
}
