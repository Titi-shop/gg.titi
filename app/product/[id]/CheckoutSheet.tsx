"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useRef } from "react";

/* =========================
   PI TYPE
========================= */

type PiPayment = {
  createPayment: (
    data: {
      amount: number;
      memo: string;
      metadata: unknown;
    },
    callbacks: {
      onReadyForServerApproval: (
        paymentId: string,
        callback: () => void
      ) => void;
      onReadyForServerCompletion: (
        paymentId: string,
        txid: string
      ) => void;
      onCancel: () => void;
      onError: (error: unknown) => void;
    }
  ) => Promise<void>;
};

declare global {
  interface Window {
    Pi?: PiPayment;
  }
}
/* =========================
   TYPES
========================= */
type Region =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

interface ShippingInfo {
  name: string;
  phone: string;
  address_line: string;
  province: string;
  country?: string;
  postal_code?: string | null;
}

interface AddressApiItem {
  is_default: boolean;
  full_name: string;
  phone: string;
  address_line: string;
  province: string;
  country?: string;
  postal_code?: string | null;
}

interface AddressApiResponse {
  items?: AddressApiItem[];
}

interface Message {
  text: string;
  type: "error" | "success";
}

interface Props {
  open: boolean;
  onClose: () => void;
  product: {
    id: string;
   variant_id?: string | null;
    name: string;
    price: number;
    finalPrice?: number;
    thumbnail?: string;
    stock?: number;
    shipping_rates: {
  zone: string;
  price: number;
}[];
    
  };
}

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
const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  /* ========================= */

  const showMessage = (text: string, type: "error" | "success" = "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };
   const getErrorKey = (code?: string) => {
  const map: Record<string, string> = {
    UNSUPPORTED_COUNTRY: "unsupported_country",
    PREVIEW_FAILED: "order_preview_failed",
    INVALID_REGION: "invalid_region",
    SHIPPING_NOT_AVAILABLE: "shipping_not_available",
  };

  return map[code || ""] || "unknown_error";
};

  const item = useMemo(() => {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    finalPrice: product.finalPrice,
    thumbnail: product.thumbnail || "/placeholder.png",
    stock: product.stock ?? 1
  };
}, [product]);
const maxStock = Math.max(1, item?.stock ?? 0);

const quantity = useMemo(() => {
  const n = Number(qtyDraft);
  return Number.isInteger(n) && n >= 1 && n <= maxStock ? n : 1;
}, [qtyDraft, maxStock]);

  /* =========================
     LOAD ADDRESS
  ========================= */

  useEffect(() => {
    async function loadAddress() {
      try {
        console.log("🟡 [CHECKOUT] LOAD ADDRESS START");

    const token = await getPiAccessToken();
    console.log("🟢 TOKEN:", token);

    const res = await fetch("/api/address", {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("🟢 ADDRESS RES:", res.status);

    if (!res.ok) return;

    const data: AddressApiResponse = await res.json();
    console.log("🟢 ADDRESS DATA:", data);

    const def = data.items?.find((a) => a.is_default);
    if (!def) return;

    setShipping({
      name: def.full_name,
      phone: def.phone,
      address_line: def.address_line,
      province: def.province,
      country: def.country,
      postal_code: def.postal_code ?? null,
    });

    console.log("🟢 SHIPPING SET");
  } catch (err) {
    console.error("❌ LOAD ADDRESS ERROR:", err);
    setShipping(null);
  }
}

    if (open && user) loadAddress();
  }, [open, user]);

  /* =========================
     AUTO PAY AFTER LOGIN
  ========================= */

  useEffect(() => {
  console.log("🟡 AUTO PAY CHECK", {
    user,
    shipping,
    processing,
  });
  if (!user || !shipping || processing) return;

  const pending = localStorage.getItem("pending_checkout");
  if (!pending) return;

  localStorage.removeItem("pending_checkout");

  setTimeout(() => {
    console.log("🟢 AUTO PAY TRIGGER");
    handlePay();
  }, 300);
}, [user, shipping, processing]);

  /* ========================= */

  const unitPrice = useMemo(() => {
    if (!item) return 0;
    return typeof item.finalPrice === "number"
      ? item.finalPrice
      : item.price;
  }, [item]);
   const availableRegions = useMemo(() => {
  if (!shipping?.country) return [];

  const country = shipping.country.toUpperCase();

  return product.shipping_rates.filter((r) => {
    if (country === "VN") return r.zone === "domestic";

    // TODO: sau này map theo shipping_zone_countries từ backend
    return true;
  });
}, [shipping?.country, product.shipping_rates]);
  const shippingFee = useMemo(() => {
  if (!selectedRegion || !Array.isArray(product.shipping_rates)) {
    console.log("❌ NO SHIPPING RATES");
    return 0;
  }

  console.log("👉 SELECTED:", selectedRegion);
  console.log("👉 RATES:", product.shipping_rates);

   const found = availableRegions.find(
    (r) => r.zone === selectedRegion
  );
  console.log("👉 FOUND:", found);

  return found?.price ?? 0;
}, [selectedRegion, availableRegions]);

  const total = useMemo(
  () => Number((unitPrice * quantity + shippingFee).toFixed(6)),
  [unitPrice, quantity, shippingFee]
);

   const previewOrder = async () => {
  try {
    console.log("🟡 PREVIEW START");

    const token = await getPiAccessToken();

    const payload = {
      country: shipping?.country,
      selectedRegion,
      items: [
        {
          product_id: item!.id,
          quantity,
        },
      ],
    };

    console.log("🟡 PREVIEW PAYLOAD:", payload);

    const res = await fetch("/api/orders/preview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("🟡 PREVIEW STATUS:", res.status);

    const data = await res.json();

    console.log("🟡 PREVIEW RESPONSE:", data);

    if (!res.ok) {
      console.log("🔴 PREVIEW ERROR:", data.error);
      showMessage(t[getErrorKey(data.error)]);
      return false;
    }

    console.log("🟢 PREVIEW OK");

    return true;
  } catch (err) {
    console.error("❌ PREVIEW EXCEPTION:", err);
    showMessage(t.order_preview_error);
    return false;
  }
};
  /* =========================
     VALIDATION
  ========================= */

  const validateBeforePay = () => {
  console.log("🟡 VALIDATE START");

  // ✅ chưa login → auto login
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

  if (!selectedRegion) {
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
};

  /* =========================
     PAY
  ========================= */

  const handlePay = useCallback(async () => {
     console.log("🟡 PAY START");
    if (!validateBeforePay()) return;
const ok = await previewOrder();
if (!ok) {
  console.log("🔴 PREVIEW BLOCK PAYMENT");
  return;
}
if (processingRef.current) return;

processingRef.current = true;
setProcessing(true);
    try {
       console.log("🟢 CALL PI PAYMENT");
      await window.Pi?.createPayment(
        {
          amount: total,
          memo: t.payment_memo_order || "Order payment",
          metadata: {
            shipping,
             zone: selectedRegion,
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
         console.log("🟢 APPROVE RES:", res.status);
              if (!res.ok) {
                 console.log("🔴 APPROVE FAILED");
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
               zone: selectedRegion, 
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
  }, [item, quantity, total, shipping, unitPrice, processing, t, user, router, onClose]);

  /* ========================= */

  if (!open || !item) return null;

   if (maxStock <= 0) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white p-4 rounded-lg text-center">
        <p className="text-red-500 font-semibold">
  {t.out_of_stock}
</p>
        <button
          onClick={onClose}
          className="mt-3 px-4 py-2 bg-gray-200 rounded"
        >
       {t.close}
    </button>
      </div>
    </div>
  );
}

  return (
    <div className="fixed inset-0 z-[100]">
      {message && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow-lg z-[200]
          ${message.type === "error" ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}
        >
          {message.text}
        </div>
      )}

      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl h-[65vh] flex flex-col">

        <div className="flex-1 overflow-y-auto px-4 py-3 pb-24">

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
                  {shipping.province} – {getCountryDisplay(shipping.country)} – {shipping.postal_code ?? ""}
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
    const active = selectedRegion === r.zone;

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
  setSelectedRegion(r.zone);
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

          <div className="flex items-center gap-3 border-b pb-3">
  <img
    src={item.thumbnail || "/placeholder.png"}
    alt={item.name}
    className="w-16 h-16 rounded object-cover"
  />

  <div className="flex-1">
    <p className="text-sm font-medium line-clamp-2">
      {item.name}
    </p>

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

  {/* ✅ PRICE BLOCK (ĐÚNG CHỖ) */}
  
    <div className="text-right">
  <p className="font-semibold text-orange-600 text-lg">
    {formatPi(total)} π
  </p>

  {!user && (
    <p className="text-xs text-red-500">
      {t.please_login || "Please login first"}
    </p>
  )}
</div>
</div>
           </div>  

        <div className="border-t p-4">
          <button
  onClick={handlePay}
  disabled={processing}
  
            className={`w-full py-3 text-white rounded-lg font-semibold ${
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
