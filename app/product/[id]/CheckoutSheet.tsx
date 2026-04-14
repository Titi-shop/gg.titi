"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import { getPiAccessToken } from "@/lib/piAuth"; // ✅ FIX
import useSWR from "swr";

import type {
  Props,
  Region,
  ShippingInfo,
  Message,
  AddressApiResponse, // ✅ FIX
} from "./checkout.types";

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
  const router = useRouter();
  const { t } = useTranslation();
  const { user, piReady, pilogin } = useAuth();

  const processingRef = useRef(false);

  const [shipping, setShipping] = useState<ShippingInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [qtyDraft, setQtyDraft] = useState("1");
  const [message, setMessage] = useState<Message | null>(null);
  const [zone, setZone] = useState<Region | null>(null);
console.log("🟣 SHIPPING STATE:", shipping);
  /* ========================= */

  const showMessage = (text: string, type: "error" | "success" = "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  /* ========================= */

  const item = useMemo(() => {
  if (!product) return null;
  const selected = product.selectedVariant;

  /* ================= VARIANT ================= */
  if (selected) {
    const price =
      typeof selected.finalPrice === "number"
        ? selected.finalPrice
        : selected.salePrice && selected.salePrice > 0
        ? selected.salePrice
        : selected.price;

    return {
      id: product.id,
      name: product.name,
      price,
      finalPrice: price,
      thumbnail: product.thumbnail || "/placeholder.png",
      stock: selected.stock ?? 0,
    };
  }

  /* ================= PRODUCT ================= */
  const price =
    typeof product.finalPrice === "number"
      ? product.finalPrice
      : product.salePrice && product.salePrice > 0
      ? product.salePrice
      : product.price;

  return {
    id: product.id,
    name: product.name,
    price,
    finalPrice: price,
    thumbnail: product.thumbnail || "/placeholder.png",
    stock: product.stock ?? 0,
  };
}, [product]);

  const maxStock = Math.max(1, item?.stock ?? 0);

  const quantity = useMemo(() => {
    const n = Number(qtyDraft);
    return Number.isInteger(n) && n >= 1 && n <= maxStock ? n : 1;
  }, [qtyDraft, maxStock]);

  /* ========================= */

  const previewKey =
  open && shipping?.country && zone && item
    ? [
        "/api/orders/preview",
        {
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
     quantity,
    variant_id: product.selectedVariant?.id ?? null, 
   },
   ],
    : null;

  const { data: preview, error: previewError } = useSWR(
    previewKey,
    previewFetcher
  );

  /* =========================
     LOAD ADDRESS (FIXED)
  ========================= */

  useEffect(() => {
  async function loadAddress() {
    try {
      const token = await getPiAccessToken();

      const res = await fetch("/api/address", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data: AddressApiResponse = await res.json();

      const def = data.items?.find((a) => a.is_default);
      if (!def) return;
   console.log("🟢 SHIPPING SET:", def);
      setShipping({
  name: def.full_name,
  phone: def.phone,
  address_line: def.address_line,
  region: def.region,
  district: def.district ?? "",
  ward: def.ward ?? "",
  country: def.country,
  postal_code: def.postal_code ?? null,
   });
    } catch (err) {
      console.error(err);
    }
  }

  if (!open || !user) return;
  loadAddress();
}, [open, user]);

  /* ========================= */

  useEffect(() => {
    if (!previewError) return;
    const key = getErrorKey(previewError.message);
    showMessage(t[key] ?? key);
  }, [previewError]);

  /* ========================= */

  const unitPrice = item?.finalPrice ?? 0;

  const availableRegions = useMemo(() => {
  if (!shipping?.country) return [];

  const country = shipping.country.toUpperCase();

  // ✅ FIX CRASH / UNDEFINED
  const rates = Array.isArray(product?.shippingRates)
    ? product.shippingRates
    : [];
  console.log("🚚 SHIPPING RATES:", rates);
  return rates.filter((r) => {
    if (country === "VN") return r.zone === "domestic";
    return true;
  });
}, [shipping?.country, product?.shippingRates]);

  const total = preview?.total ?? unitPrice * quantity;

  /* ========================= */

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
        <div className="fixed top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500 text-white rounded">
          {message.text}
        </div>
      )}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl h-[65vh] flex flex-col">

        {/* SCROLL */}
        <div className="flex-1 overflow-y-auto px-4 py-3">

          {/* ADDRESS */}
            <div
            className="border rounded-lg p-3 cursor-pointer mb-4"
            onClick={() => router.push("/customer/address")}
          >
            {shipping ? (
              <>
                <p className="font-medium">{shipping.name}</p>
                <p className="text-sm text-gray-600">{shipping.phone}</p>
                <p className="text-sm text-gray-500 mt-1">{shipping.address_line}</p>
                <p className="text-sm text-gray-500 mt-1 whitespace-nowrap">
            {[shipping.ward, shipping.district, shipping.region]
            .filter(Boolean)
            .join(", ")}{" "}
           – {getCountryDisplay(shipping.country)} – {shipping.postal_code ?? ""}
                </p>
              </>
            ) : (
              <p className="text-gray-500">➕ {t.add_shipping}</p>
            )}
          </div>
                     {/* SHIPPING REGION */}
<div className="border rounded-xl p-3 mb-4">
  <p className="text-sm font-medium mb-2">
    🌍 {t.select_region || "Select region"}
  </p>

 <div className="flex gap-2 overflow-x-auto">
  {availableRegions.map((r) => {
    const active = zone === r.zone;

    const labelMap: Record<string, string> = {
  domestic: t.region_domestic,
  sea: t.region_sea,
  asia: t.region_asia,
  europe: t.region_europe,
  north_america: t.region_us,
  rest_of_world: t.region_global,
};

    return (
      <button
        key={r.zone}
        onClick={() => {
  if (!r.zone) return;
  setZone(r.zone as Region);
}}
        className={`min-w-[90px] rounded-xl border px-3 py-2 text-xs text-center transition
          ${
            active
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-gray-50 border-gray-300"
          }
        `}
      >
        <div className="font-medium">
          {labelMap[r.zone] ?? r.zone}
        </div>

        <div className="text-[11px] opacity-80">
          {formatPi(r.price)} π
        </div>
      </button>
    );
  })}
</div>
</div>

          {/* PRODUCT */}
          <div className="flex items-center gap-3">
            <img
  src={item.thumbnail || "/placeholder.png"}
     className="w-16 h-16 rounded object-cover"
        />

            <div className="flex-1">
              <p>{item.name}</p>

              {/* QUANTITY */}
                  <div className="flex items-center gap-2 mt-1">
      <button
        onClick={() => {
          const val = Math.max(1, quantity - 1);
          setQtyDraft(String(val));
        }}
        disabled={quantity <= 1}
        className="w-8 h-8 border rounded text-lg disabled:opacity-30"
      >
        -
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={qtyDraft}
        onChange={(e) => {
          if (!/^\d+$/.test(e.target.value)) return;

          const val = Number(e.target.value || "0");
          if (val > maxStock) return;

          setQtyDraft(e.target.value);
        }}
        onBlur={() => {
          const val = Number(qtyDraft || "0");

          if (val < 1) setQtyDraft("1");
          else if (val > maxStock) setQtyDraft(String(maxStock));
        }}
        className="w-12 text-center border rounded py-1 text-sm"
      />

      <button
        onClick={() => {
          const val = Math.min(maxStock, quantity + 1);
          setQtyDraft(String(val));
        }}
        disabled={quantity >= maxStock}
        className="w-8 h-8 border rounded text-lg disabled:opacity-30"
      >
        +
      </button>
    </div>
  </div>

            <div className="text-right">
  <p className="font-semibold text-orange-600 text-lg">
    {formatPi(total)} π
  </p>

  {!preview && (
    <p className="text-xs text-gray-400">
      Đang tính phí...
    </p>
  )}
</div>
          </div>
        </div>

        {/* PAY BUTTON (FIX POSITION) */}
        <div className="border-t p-4">
          <button
  onClick={handlePay}
  disabled={processing}
  className={`w-full py-3 text-white rounded ${
    processing ? "bg-gray-400" : "bg-orange-600"
  }`}
          >
            {processing ? t.processing : t.pay_now}
          </button>
        </div>
      </div>
    </div>
  );
}
