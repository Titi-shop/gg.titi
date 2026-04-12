import { useCallback } from "react";
import { getPiAccessToken } from "@/lib/piAuth";

import type { ShippingInfo, Region } from "./checkout.types";
/* =========================
   PREVIEW DIRECT
========================= */
async function previewOrderDirect({
  shipping,
  zone,
  item,
  quantity,
}: any) {
  const token = await getPiAccessToken();

  const res = await fetch("/api/orders/preview", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
  country: shipping?.country?.toUpperCase(),
  zone,

  shipping: {
    region: shipping?.region,
    district: shipping?.district,
    ward: shipping?.ward,
  },

  items: [
    {
      product_id: item.id,
      quantity,
    },
  ],
   }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "PREVIEW_FAILED");
  }

  return data;
}
/* =========================
   MESSAGE
========================= */

export const getErrorKey = (code?: string) => {
  const map: Record<string, string> = {
    UNSUPPORTED_COUNTRY: "unsupported_country",
    PREVIEW_FAILED: "order_preview_failed",
    INVALID_REGION: "invalid_region",
    SHIPPING_NOT_AVAILABLE: "shipping_not_available",
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
}: any) {
  console.log("🟡 VALIDATE START");

  if (!user) {
    console.log("🔴 NOT LOGIN");

    localStorage.setItem("pending_checkout", "1");
    pilogin?.();

    showMessage(t.please_login || "Please login");
    return false;
  }

  if (!window.Pi || !piReady) {
    console.log("🔴 PI NOT READY");

    showMessage(t.pi_not_ready || "Pi is not ready");
    return false;
  }

  if (!shipping) {
    console.log("🔴 NO SHIPPING");

    showMessage(
      t.please_add_shipping_address || "Please add shipping address"
    );
    return false;
  }

  if (!shipping?.country) {
    showMessage(t.invalid_shipping_country);
    return false;
  }
   if (!shipping?.region) {
  showMessage(t.invalid_shipping_region || "Invalid region");
  return false;
}

  if (!zone) {
    console.log("🔴 NO REGION");

    showMessage(t.shipping_required || "Select shipping region");
    return false;
  }

  if (!item) {
    showMessage(t.invalid_product || "Invalid product");
    return false;
  }

  if (quantity < 1 || quantity > maxStock) {
    showMessage(t.invalid_quantity || "Invalid quantity");
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
}: any) {
  return useCallback(async () => {
    console.log("🟡 PAY START");

    if (!validate()) return;

    let finalPreview = preview;

if (!finalPreview) {
  try {
    console.log("🟡 FORCE PREVIEW BEFORE PAY");
    finalPreview = await previewOrderDirect({
      console.log("🟡 PREVIEW DIRECT DATA:", {
  shipping,
  zone,
  item,
  quantity,
});
  } catch (err: any) {
    const key = getErrorKey(err.message);
showMessage(t[key] || key);
    return;
  }
}
if (!finalPreview) {
  console.log("🔴 FINAL PREVIEW NULL");
  showMessage(t.order_preview_error);
  return;
}
    if (processingRef.current) return;

    processingRef.current = true;
    setProcessing(true);

    try {
      console.log("🟢 CALL PI PAYMENT");

      await window.Pi?.createPayment(
        {
          amount: finalPreview.total,
          memo: t.payment_memo_order || "Order payment",
          metadata: {
            shipping,
            zone,
            product: {
              id: item!.id,
              name: item!.name,
              image: item!.thumbnail || "",
              price: unitPrice,
            },
            quantity,
          },
        },
        {
          onReadyForServerApproval: async (paymentId, callback) => {
            console.log("🔥 CLIENT PAYMENT_ID:", paymentId);

            try {
              console.log("🟡 APPROVE START:", paymentId);

              const token = await getPiAccessToken();

              const res = await fetch("/api/pi/approve", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ paymentId }),
              });

              const text = await res.text();

              console.log("🟢 APPROVE RES:", res.status, text);

              if (!res.ok) {
                console.log("🔴 APPROVE FAILED FULL:", text);

                setProcessing(false);
                processingRef.current = false;

                showMessage(t.payment_approve_failed);
                return;
              }

              callback();
            } catch {
              setProcessing(false);
              processingRef.current = false;

              showMessage(t.payment_approve_error);
            }
          },

          onReadyForServerCompletion: async (paymentId, txid) => {
            try {
              console.log("🟡 COMPLETE START:", paymentId, txid);

              const token = await getPiAccessToken();

              const res = await fetch("/api/pi/complete", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  paymentId,
                  txid,
                  product_id: item!.id,
                  variant_id: product.variant_id ?? null,
                  quantity,
                  shipping,
                  zone,
                }),
              });

              console.log("🟢 COMPLETE RES:", res.status);

              if (!res.ok) {
                console.log("🔴 COMPLETE FAILED");

                setProcessing(false);
                processingRef.current = false;

                showMessage(t.payment_complete_failed);
                return;
              }

              console.log("🟢 PAYMENT SUCCESS");

              setProcessing(false);
              processingRef.current = false;

              onClose();
              router.push("/customer/pending");

              showMessage(t.payment_success, "success");
            } catch {
              setProcessing(false);
              processingRef.current = false;

              showMessage(t.payment_failed);
            }
          },

          onCancel: () => {
            console.log("🟡 PAYMENT CANCEL");

            setProcessing(false);
            processingRef.current = false;

            showMessage(t.payment_cancelled);
          },

          onError: () => {
            setProcessing(false);
            processingRef.current = false;

            showMessage(t.payment_failed);
          },
        }
      );
    } catch {
      setProcessing(false);
      processingRef.current = false;

      showMessage(t.transaction_failed);
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
  product?.variant_id,
  preview,
  validate,
  showMessage,
]);
}
