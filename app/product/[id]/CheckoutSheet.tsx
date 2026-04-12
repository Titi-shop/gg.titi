"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import useSWR from "swr";

import type { Props, Region, ShippingInfo, Message } from "./checkout.types";
import { previewFetcher } from "./checkout.api";
import {
  getErrorKey,
  validateBeforePay,
  useCheckoutPay,
} from "./checkout.logic";

/* ========================= */

function getCountryDisplay(country?: string) {
  return country ?? "";
}

/* ========================= */

export default function CheckoutSheet({ open, onClose, product }: Props) {
  console.log("PRODUCT DATA:", product);

  const router = useRouter();
  const { t } = useTranslation();
  const { user, piReady, pilogin } = useAuth();

  const processingRef = useRef(false);

  const [shipping, setShipping] = useState<ShippingInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [qtyDraft, setQtyDraft] = useState("1");
  const [message, setMessage] = useState<Message | null>(null);
  const [zone, setZone] = useState<Region | null>(null);

  /* ========================= */

  const showMessage = (text: string, type: "error" | "success" = "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  /* ========================= */

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

  /* =========================
     PREVIEW
  ========================= */

  const previewKey =
    open && shipping?.country && zone && item
      ? [
          "/api/orders/preview",
          {
            country: shipping.country.toUpperCase(),
            zone,
            items: [{ product_id: item.id, quantity }],
          },
        ]
      : null;

  const {
    data: preview,
    error: previewError,
    isLoading: previewLoading,
  } = useSWR(previewKey, previewFetcher, {
    dedupingInterval: 3000,
    revalidateOnFocus: false,
  });

  /* =========================
     LOAD ADDRESS
  ========================= */

  useEffect(() => {
  async function loadAddress() {
    try {
      const token = await getPiAccessToken();

      const res = await fetch("/api/address", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    } catch (err) {
      console.error(err);
    }
  }

  if (open && user) loadAddress();
}, [open, user]);

  /* ========================= */

  useEffect(() => {
    if (!previewError) return;

    const key = getErrorKey(previewError.message);
    showMessage(t[key] ?? key);
  }, [previewError]);

  /* ========================= */

  const unitPrice = useMemo(() => {
    if (!item) return 0;
    return item.finalPrice ?? item.price;
  }, [item]);

  const availableRegions = useMemo(() => {
    if (!shipping?.country) return [];

    const country = shipping.country.toUpperCase();

    return product.shippingRates.filter((r) => {
      if (country === "VN") return r.zone === "domestic";
      return true;
    });
  }, [shipping?.country, product.shippingRates]);

  const total = useMemo(() => {
    if (preview) return preview.total;
    return unitPrice * quantity;
  }, [preview, unitPrice, quantity]);

  /* =========================
     VALIDATE
  ========================= */

  const validate = () =>
    validateBeforePay({
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
    });

  /* =========================
     PAY
  ========================= */

  const handlePay = useCheckoutPay({
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
  });

  /* ========================= */

  if (!open || !item) return null;

  /* ========================= */

  return (
    <div className="fixed inset-0 z-[100]">
      {message && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow-lg z-[200] bg-red-500 text-white">
          {message.text}
        </div>
      )}

      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl h-[65vh] flex flex-col">

        <div className="flex-1 overflow-y-auto px-4 py-3 pb-24">

          {/* ADDRESS */}
          <div
            className="border rounded-lg p-3 cursor-pointer mb-4"
            onClick={() => router.push("/customer/address")}
          >
            {shipping ? (
              <>
                <p className="font-medium">{shipping.name}</p>
                <p className="text-sm text-gray-600">{shipping.phone}</p>
                <p className="text-sm text-gray-500">{shipping.address_line}</p>
                <p className="text-sm text-gray-500">
                  {shipping.province} – {getCountryDisplay(shipping.country)}
                </p>
              </>
            ) : (
              <p className="text-gray-500">➕ {t.add_shipping}</p>
            )}
          </div>

          {/* REGION */}
          <div className="border rounded-xl p-3 mb-4">
            <div className="flex gap-2 overflow-x-auto">
              {availableRegions.map((r) => (
                <button
                  key={r.zone}
                  onClick={() => setZone(r.zone as Region)}
                  className={`px-3 py-2 rounded ${
                    zone === r.zone ? "bg-orange-500 text-white" : "bg-gray-100"
                  }`}
                >
                  {formatPi(r.price)} π
                </button>
              ))}
            </div>
          </div>

          {/* PRODUCT */}
          <div className="flex items-center gap-3">
            <img
              src={item.thumbnail}
              className="w-16 h-16 rounded object-cover"
            />
            <div className="flex-1">
              <p>{item.name}</p>
            </div>
            <div>{formatPi(total)} π</div>
          </div>
        </div>

        {/* PAY */}
        <div className="border-t p-4">
          <button
            onClick={handlePay}
            disabled={processing}
            className="w-full py-3 bg-orange-600 text-white rounded-lg"
          >
            {processing ? t.processing : t.pay_now}
          </button>
        </div>
      </div>
    </div>
  );
}
