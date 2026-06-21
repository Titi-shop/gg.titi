"use client";
import Image from "next/image";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";

import type { ShippingRate } from "@/types/Product";
import type {
  CheckoutProps as Props,
  ShippingInfo,
  Message,
} from "@/types/checkout";

import {
  previewFetcher,
  fetchDefaultAddress,
  getCountryDisplay,
} from "./checkout.api";

import {
  validateBeforePay,
  useCheckoutPay,
} from "./checkout.logic";

/* =========================================================
COMPONENT
========================================================= */

export default function CheckoutSheet({
  open,
  onClose,
  product,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, piReady, pilogin } = useAuth();

  const processingRef = useRef(false);

  /* ================= STATE ================= */

  const [shipping, setShipping] = useState<ShippingInfo | null>(null);
  const [zone, setZone] = useState<Region | null>(null);
  const [qty, setQty] = useState("1");
  const [message, setMessage] = useState<Message | null>(null);
  const [processing, setProcessing] = useState(false);

  /* ================= ITEM ================= */

  const item = useMemo(() => {
    if (!product) return null;

    const v = product.selectedVariant;

    const price =
      v?.final_price ??
      v?.sale_price ??
      v?.price ??
      product.final_price ??
      product.price;

    return {
      id: product.id,
      name: product.name,
      price,
      final_price: price,
      thumbnail: product.thumbnail || "/placeholder.png",
      stock: v?.stock ?? product.stock ?? 0,
    };
  }, [product]);

  const maxStock = Math.max(1, item?.stock ?? 0);

  const quantity = useMemo(() => {
    const n = Number(qty);
    return Number.isInteger(n) && n >= 1 && n <= maxStock ? n : 1;
  }, [qty, maxStock]);

  /* ================= SHIPPING ================= */

  const regions = useMemo(() => {
    return Array.isArray(product?.shipping_rates)
      ? product.shipping_rates
      : [];
  }, [product?.shipping_rates]);

  /* ================= LOAD ADDRESS ================= */

  useEffect(() => {
  if (!open || !user) return;

  (async () => {
    const def = await fetchDefaultAddress();
    if (!def) return;

    setShipping(def);
  })();
}, [open, user]);

  /* ================= PREVIEW ================= */

  const previewKey = useMemo(() => {
    if (!open || !shipping || !item) return null;

    return [
      "/api/orders/preview",
      shipping.id,
      quantity,
      item.id,
      product?.selectedVariant?.id ?? null,
    ];
  }, [open, shipping, quantity, item, product]);

  const { data: preview, isLoading, isValidating } = useSWR(
    previewKey,
    previewFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  );

  const unitPrice = item?.final_price ?? 0;

  const total = useMemo(() => {
    if (preview?.total != null) return preview.total;
    return unitPrice * quantity;
  }, [preview?.total, unitPrice, quantity]);

  /* ================= RESOLVED REGION ================= */

  const resolvedRegion = useMemo(() => {
  const zone =  preview?.shipping_zone ??  preview?.buyer_zone;
  if (!zone) return null;
  return (
    regions.find((r) => r.zone === zone) ??
    null
  );
}, [
  preview?.shipping_zone,
  preview?.buyer_zone,
  regions,
]);

  /* ================= PAY ================= */
console.log("🧪 CHECKOUT_ZONE", {
  resolvedRegion,
  shippingCountry: shipping?.country,
  previewZone: preview?.shipping_zone,
});
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
    product,
    showMessage: (text, type = "error") => {
      setMessage({ text, type });
      setTimeout(() => setMessage(null), 3000);
    },
    validate: () =>
      validateBeforePay({
        user,
        piReady,
        shipping,
        item,
        quantity,
        maxStock,
        pilogin,
        showMessage: (text, type) =>
          setMessage({ text, type }),
        t,
      }),
  });

  /* ================= GUARD ================= */

  if (!open || !item) return null;

  /* =========================================================
  UI LABELS (i18n ONLY)
  ========================================================= */

  const zoneLabel = (r: ShippingRate) => {
  if (r.zone === "domestic") {
    return `${t.domestic_country ?? "Domestic"} (${r.domestic_country_code ?? "—"})`;
  }

  return (
    t[`shipping_${r.zone}` as keyof typeof t] ??
    r.zone
  );
};

  /* =========================================================
  RENDER
  ========================================================= */

  return (
    <div className="fixed inset-0 z-[100]">

      {/* OVERLAY */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* SHEET */}
      <div
  className="absolute bottom-0 left-0 right-0 h-[65vh] rounded-t-2xl flex flex-col"
  style={{
    background: "var(--card-bg)",
    color: "var(--foreground)",
    borderTop: "1px solid var(--nav-border)",
  }}
>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

         {/* ADDRESS */}
<div
  className="border rounded-xl p-3 cursor-pointer transition"
  onClick={() => router.push("/customer/address")}
  style={{
    borderColor: "var(--nav-border)",
  }}
>
  {shipping ? (
    <>
      <p className="font-medium">{shipping.name}</p>
      <p className="text-sm text-gray-500">{shipping.phone}</p>
      <p className="text-sm" style={{ color: "var(--text-muted)",
  }}
>
        {shipping.address_line}
      </p>
      <p className="text-sm text-gray-500">
        {[shipping.ward, shipping.district, shipping.region]
          .filter(Boolean)
          .join(", ")}{" "}
        – {getCountryDisplay(shipping.country)}
      </p>

      <p className="text-xs mt-2 text-orange-500 font-medium">
        {t.change_address ?? "Tap to change address"}
      </p>
    </>
  ) : (
    <p
  style={{
    color: "var(--text-muted)",
  }}
>
      ➕ {t.add_shipping}
    </p>
  )}
</div>
          {/* SHIPPING ZONE */}
          <div
  className="rounded-xl p-3"
  style={{
    border: "1px solid var(--nav-border)",
    background: "var(--card-bg)",
  }}
>
            <p className="font-medium mb-2">🌍 {t.shipping_zone}</p>

            {!resolvedRegion ? (
              <p
  className="text-sm"
  style={{
    color: "var(--danger)",
  }}
>
                {t.no_shipping_zone}
              </p>
            ) : (
              <>
                <div className="font-semibold text-sm">
                  {zoneLabel(resolvedRegion)}
                </div>

                <div className="text-xs opacity-70 mt-1">
                  {getCountryDisplay(shipping?.country)} ·{" "}
                  {formatPi(preview?.shipping_fee ?? 0)} π
                </div>
              </>
            )}
          </div>

          {/* PRODUCT */}
          <div className="flex items-center gap-3">

            <Image
  src={item.thumbnail}
  alt={item.name}
  width={64}
  height={64}
  className="w-16 h-16 rounded-lg object-cover"
  style={{
    border: "1px solid var(--nav-border)",
  }}
/>

            <div className="flex-1">
              <p className="font-medium line-clamp-2">{item.name}</p>

              <div className="flex items-center gap-2 mt-2">

                <button
                  onClick={() => setQty(String(Math.max(1, quantity - 1)))}
                  disabled={quantity <= 1}
                 className="w-8 h-8 rounded-lg"
style={{
  border: "1px solid var(--nav-border)",
  background: "var(--card-bg)",
}}
                >
                  -
                </button>

                <input
                  value={qty}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    if (!v) return setQty("");
                    if (Number(v) > maxStock) return;
                    setQty(v);
                  }}
                  className="w-12 text-center rounded-lg"
style={{
  border: "1px solid var(--nav-border)",
  background: "var(--card-bg)",
  color: "var(--foreground)",
}}
                />

                <button
                  onClick={() =>
                    setQty(String(Math.min(maxStock, quantity + 1)))
                  }
                  disabled={quantity >= maxStock}
                 className="w-8 h-8 rounded-lg"
style={{
  border: "1px solid var(--nav-border)",
  background: "var(--card-bg)",
}}
                >
                  +
                </button>

              </div>
            </div>

            <div
  className="text-right font-bold"
  style={{
    color: "var(--color-primary)",
  }}
>
              {formatPi(total)} π
            </div>

          </div>

        </div>

        {/* FOOTER */}
        <div
  className="p-4"
  style={{
    borderTop: "1px solid var(--nav-border)",
    background: "var(--card-bg)",
  }}
>

  {message && (
    <div
      style={{
  background:
    message.type === "success"
      ? "rgba(34,197,94,.15)"
      : message.type === "info"
      ? "rgba(59,130,246,.15)"
      : "rgba(239,68,68,.15)",
  color:
    message.type === "success"
      ? "var(--success)"
      : message.type === "info"
      ? "var(--info)"
      : "var(--danger)",
}}
    >
      {message.text}
    </div>
  )}

  <button
    onClick={handlePay}
    disabled={processing}
   className="w-full py-3 rounded-xl text-white font-bold transition-all"
style={{
  background: "var(--color-primary)",
}}
  >
    {processing ? t.processing : t.pay_now}
  </button>
</div>
      </div>
    </div>
  );
}
