import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import useSWR from "swr";
import { getErrorKey } from "./checkout.helpers";

export function useCheckout(product: any, open: boolean, onClose: () => void) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, piReady, pilogin } = useAuth();

  const processingRef = useRef(false);

  const [shipping, setShipping] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [qtyDraft, setQtyDraft] = useState("1");
  const [message, setMessage] = useState<any>(null);
  const [zone, setZone] = useState<any>(null);

  /* ================= ITEM ================= */

  const item = useMemo(() => {
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      finalPrice: product.finalPrice,
      thumbnail: product.thumbnail || "/placeholder.png",
      stock: product.stock ?? 1,
    };
  }, [product]);

  const maxStock = Math.max(1, item?.stock ?? 0);

  const quantity = useMemo(() => {
    const n = Number(qtyDraft);
    return Number.isInteger(n) && n >= 1 && n <= maxStock ? n : 1;
  }, [qtyDraft, maxStock]);

  /* ================= ADDRESS ================= */

  useEffect(() => {
    async function loadAddress() {
      try {
        const token = await getPiAccessToken();

        const res = await fetch("/api/address", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data = await res.json();
        const def = data.items?.find((a: any) => a.is_default);

        if (!def) return;

        setShipping({
          name: def.full_name,
          phone: def.phone,
          address_line: def.address_line,
          province: def.province,
          country: def.country,
          postal_code: def.postal_code ?? null,
        });
      } catch {
        setShipping(null);
      }
    }

    if (open && user) loadAddress();
  }, [open, user]);

  /* ================= PREVIEW ================= */

  const previewKey =
    open && shipping?.country && zone && item
      ? [
          "/api/orders/preview",
          {
            country: shipping.country.toUpperCase(),
            zone,
            items: [
              {
                product_id: item.id,
                quantity,
              },
            ],
          },
        ]
      : null;

  const { data: preview, error: previewError } = useSWR(previewKey);

  useEffect(() => {
    if (!previewError) return;
    const key = getErrorKey(previewError.message);
    setMessage({ text: t[key] ?? key, type: "error" });
  }, [previewError]);

  /* ================= PAY ================= */

  const handlePay = useCallback(async () => {
    if (!user) {
      localStorage.setItem("pending_checkout", "1");
      pilogin?.();
      return;
    }

    if (!window.Pi || !piReady) return;
    if (!shipping || !zone || !item) return;

    if (processingRef.current) return;

    processingRef.current = true;
    setProcessing(true);

    try {
      await window.Pi?.createPayment(
        {
          amount: preview?.total ?? item.finalPrice,
          memo: t.payment_memo_order,
          metadata: {
            shipping,
            zone,
            product: item,
            quantity,
          },
        },
        {
          onReadyForServerApproval: async (paymentId, callback) => {
            const token = await getPiAccessToken();

            await fetch("/api/pi/approve", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ paymentId }),
            });

            callback();
          },

          onReadyForServerCompletion: async (paymentId, txid) => {
            const token = await getPiAccessToken();

            await fetch("/api/pi/complete", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                paymentId,
                txid,
                product_id: item.id,
                variant_id: product.variant_id ?? null,
                quantity,
                shipping,
                zone,
              }),
            });

            setProcessing(false);
            processingRef.current = false;

            onClose();
            router.push("/customer/pending");
          },

          onCancel: () => {
            setProcessing(false);
            processingRef.current = false;
          },

          onError: () => {
            setProcessing(false);
            processingRef.current = false;
          },
        }
      );
    } catch {
      setProcessing(false);
      processingRef.current = false;
    }
  }, [item, quantity, shipping, zone, preview, user]);

  return {
    item,
    quantity,
    setQtyDraft,
    maxStock,
    shipping,
    setZone,
    zone,
    handlePay,
    processing,
    message,
    preview,
  };
}
