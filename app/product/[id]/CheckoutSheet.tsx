"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";

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
    name: string;
    price: number;
    finalPrice?: number;
    thumbnail?: string;
     stock?: number;
  };
}

/* ========================= */

function getCountryDisplay(country?: string) {
  return country ?? "";
}

/* ========================= */

export default function CheckoutSheet({ open, onClose, product }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, piReady, pilogin } = useAuth();

  const [shipping, setShipping] = useState<ShippingInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [qtyDraft, setQtyDraft] = useState("1");
  const [message, setMessage] = useState<Message | null>(null);

  /* ========================= */

  const showMessage = (text: string, type: "error" | "success" = "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };
  const quantity = useMemo(() => {
  const maxStock = item?.stock ?? 99;
    const n = Number(qtyDraft);
    return Number.isInteger(n) && n >= 1 && n <= 99 ? n : 1;
  }, [qtyDraft]);

  const item = useMemo(() => {
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      finalPrice: product.finalPrice,
      thumbnail: product.thumbnail || "",
     stock: product.stock ?? 99,
       
    };
  }, [product]);

  /* =========================
     LOAD ADDRESS
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

  /* =========================
     AUTO PAY AFTER LOGIN
  ========================= */

  useEffect(() => {
    if (!user || !shipping || processing) return;

    const pending = localStorage.getItem("pending_checkout");
    if (!pending) return;

    localStorage.removeItem("pending_checkout");

    setTimeout(() => {
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

  const total = useMemo(
    () => Number((unitPrice * quantity).toFixed(6)),
    [unitPrice, quantity]
  );

  /* =========================
     VALIDATION
  ========================= */

  const validateBeforePay = () => {

     
    if (!window.Pi || !piReady) {
      showMessage(t.pi_not_ready || "Pi is not ready");
      return false;
    }

      if (!user) {
  if (typeof window !== "undefined") {
    localStorage.setItem("pending_checkout", "1");
  }

  pilogin?.(); // ✅ mở login Pi

  showMessage(
    t.please_login || "Please login first",
    "error"
  );

  return false;
}

    if (!item) {
      showMessage(t.invalid_product || "Invalid product");
      return false;
    }

    if (!shipping) {
      showMessage(
        t.please_add_shipping_address || "Please add a shipping address"
      );
      return false;
    }

    if (quantity < 1 || quantity > 99) {
      showMessage(t.invalid_quantity || "Invalid quantity");
      return false;
    }

    return true;
  };

  /* =========================
     PAY
  ========================= */

  const handlePay = useCallback(async () => {
    if (!validateBeforePay()) return;
    if (processing) return;

    setProcessing(true);

    try {
      await window.Pi?.createPayment(
        {
          amount: total,
          memo: t.payment_memo_order || "Order payment",
          metadata: {
            shipping,
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
              const token = await getPiAccessToken();

              const res = await fetch("/api/pi/approve", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ paymentId }),
              });

              if (!res.ok) {
                setProcessing(false);
                showMessage(t.payment_approve_failed);
                return;
              }

              callback();
            } catch {
              setProcessing(false);
              showMessage(t.payment_approve_error);
            }
          },

          onReadyForServerCompletion: async (paymentId, txid) => {
            try {
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
                  quantity,
                  total,
                  shipping,
                  user: { pi_uid: user!.pi_uid },
                }),
              });

              if (!res.ok) {
                setProcessing(false);
                showMessage(t.payment_complete_failed);
                return;
              }

              setProcessing(false);
              onClose();
              router.push("/customer/pending");
              showMessage(t.payment_success, "success");
            } catch {
              setProcessing(false);
              showMessage(t.payment_failed);
            }
          },

          onCancel: () => {
            setProcessing(false);
            showMessage(t.payment_cancelled);
          },

          onError: () => {
            setProcessing(false);
            showMessage(t.payment_failed);
          },
        }
      );
    } catch {
      setProcessing(false);
      showMessage(t.transaction_failed);
    }
  }, [item, quantity, total, shipping, unitPrice, processing, t, user, router, onClose]);

  /* ========================= */

  if (!open || !item) return null;

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

      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl h-[45vh] flex flex-col">

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

          <div className="flex items-center gap-3 border-b pb-3">
            <img
              src={item.thumbnail || "/placeholder.png"}
              alt={item.name}
              className="w-16 h-16 rounded object-cover"
            />

            <div className="flex-1">
              <p className="text-sm font-medium line-clamp-2">{item.name}</p>

              <div className="flex items-center gap-2 mt-1">

  {/* NÚT - */}
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

  {/* INPUT */}
  <input
    type="text"
    inputMode="numeric"
    value={qtyDraft}
    onChange={(e) => {
      if (!/^\d*$/.test(e.target.value)) return;

      const val = Number(e.target.value || "0");

      if (val > maxStock) {
        setQtyDraft(String(maxStock)); // ✅ không vượt kho
        return;
      }

      setQtyDraft(e.target.value);
    }}
    onBlur={() => {
      const val = Number(qtyDraft || "0");

      if (val < 1) setQtyDraft("1");
      else if (val > maxStock) setQtyDraft(String(maxStock));
    }}
    className="w-12 text-center border rounded py-1 text-sm"
  />

  {/* NÚT + */}
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
              <p className="font-semibold text-orange-600">
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
