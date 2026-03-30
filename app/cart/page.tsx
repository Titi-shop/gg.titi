"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useCart } from "@/app/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";

interface ShippingInfo {
  name: string;
  phone: string;
  address_line: string;
  country?: string;
  postal_code?: string | null;
}

interface AddressItem {
  is_default: boolean;
  full_name: string;
  phone: string;
  address_line: string;
  country?: string;
  postal_code?: string | null;
}

interface Message {
  text: string;
  type: "error" | "success";
}

export default function CartPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const { cart, updateQty, removeFromCart, clearCart } = useCart();
  const { user, piReady, pilogin } = useAuth();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shipping, setShipping] = useState<ShippingInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const showMessage = (text: string, type: "error" | "success" = "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const selectedItems = useMemo(
    () => cart.filter((i) => selectedIds.includes(i.id)),
    [cart, selectedIds]
  );

  const total = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const unit =
          typeof item.sale_price === "number" ? item.sale_price : item.price;
        return sum + unit * item.quantity;
      }, 0),
    [selectedItems]
  );

  useEffect(() => {
    async function loadAddress() {
      try {
        const token = await getPiAccessToken();
        const res = await fetch("/api/address", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data: { items?: AddressItem[] } = await res.json();
        const def = data.items?.find((a) => a.is_default);
        if (!def) return;

        setShipping({
          name: def.full_name,
          phone: def.phone,
          address_line: def.address_line,
          country: def.country,
          postal_code: def.postal_code ?? null,
        });
      } catch {
        //
      }
    }

    if (user) {
      void loadAddress();
    }
  }, [user]);

  useEffect(() => {
  if (!user) return;
  if (!shipping) return; // ✅ QUAN TRỌNG
  if (processing) return;

  if (typeof window === "undefined") return;

  const pending = localStorage.getItem("pending_checkout");

  if (!pending) return;

  // ✅ tránh loop
  localStorage.removeItem("pending_checkout");

  setTimeout(() => {
    handlePay();
  }, 300);
}, [user, shipping, processing]);

  useEffect(() => {
  async function loadCart() {
    try {
      const token = await getPiAccessToken();

      const res = await fetch("/api/cart", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return;

      const data: unknown = await res.json();

      if (!Array.isArray(data)) return;

      setCart(data);
    } catch {}
  }

  if (user) {
    void loadCart();
  }
}, [user]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const validateBeforePay = (): boolean => {

    if (!window.Pi || !piReady) {
  showMessage(t.pi_not_ready || "Pi is not ready");
  return false;
}

    
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

  if (!shipping) {
    showMessage(
      t.please_add_shipping_address || "Please add a shipping address"
    );
    return false;
  }

  if (selectedItems.length === 0) {
    showMessage(t.please_select_product || "Please select a product");
    return false;
  }

  if (selectedItems.length > 1) {
    showMessage(
      t.only_one_product_supported || "Only 1 product is supported at a time"
    );
    return false;
  }

  const item = selectedItems[0];

  if (!item) {
    showMessage(t.invalid_product || "Invalid product");
    return false;
  }

  // ✅ check stock
  if (item.variant && item.variant.stock <= 0) {
  showMessage(t.out_of_stock || "Out of stock");
  return false;
}

  if (!item.variant && item.stock !== undefined && item.stock <= 0) {
    showMessage(t.out_of_stock || "Out of stock");
    return false;
  }

  // ✅ check quantity
  if (item.quantity < 1 || item.quantity > 100) {
    showMessage(t.invalid_quantity || "Invalid quantity");
    return false;
  }

  return true;
};

  const handlePay = async () => {
  if (!validateBeforePay()) return;

  const item = selectedItems[0]; // ✅ FIX QUAN TRỌNG

  const unit =
    typeof item.sale_price === "number" ? item.sale_price : item.price;

  const quantity = item.quantity;
  const totalPrice = Number((unit * quantity).toFixed(6));

  if (processing) return;
  setProcessing(true);

  try {
    await window.Pi?.createPayment(
      {
        amount: totalPrice,
        memo: t.payment_memo_order || "Order payment",
        metadata: {
          shipping,
          product: {
            id: item.id,
            name: item.name,
            image: item.thumbnail || "",
            price: unit,
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
                showMessage(
                  t.payment_approve_failed || "Payment approval failed",
                  "error"
                );
                return;
              }

              callback();
            } catch {
              setProcessing(false);
              showMessage(
                t.payment_approve_error || "Payment approval error",
                "error"
              );
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
                  product_id: item.id,
                  quantity,
                }),
              });

              if (!res.ok) {
                setProcessing(false);
                showMessage(
                  t.payment_complete_failed || "Payment completion failed",
                  "error"
                );
                return;
              }

              clearCart();
              setSelectedIds([]);
              setProcessing(false);
              router.push("/customer/pending");
              showMessage(t.payment_success || "Payment successful", "success");
            } catch {
              setProcessing(false);
              showMessage(t.payment_failed || "Payment failed", "error");
            }
          },

          onCancel: () => {
            setProcessing(false);
            showMessage(
              t.payment_cancelled || "Payment was cancelled",
              "error"
            );
          },

          onError: () => {
            setProcessing(false);
            showMessage(t.payment_failed || "Payment failed", "error");
          },
        }
      );
    } catch {
      setProcessing(false);
      showMessage(t.transaction_failed || "Transaction failed", "error");
    }
  };

  if (cart.length === 0) {
    return (
      <main className="p-8 text-center">
        <p className="text-gray-500 mb-3">{t.empty_cart}</p>
        <Link href="/" className="text-orange-600">
          {t.back_to_shop}
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-36 relative">
      {message && (
        <div
          className={`fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded px-4 py-2 shadow-lg ${
            message.type === "error"
              ? "bg-red-500 text-white"
              : "bg-green-500 text-white"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white divide-y">
        {cart.map((item) => {
          const unit =
            typeof item.sale_price === "number" ? item.sale_price : item.price;

          return (
            <div key={item.id} className="flex items-center gap-3 p-4">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => toggleItem(item.id)}
              />

              <img
                src={item.thumbnail || "/placeholder.png"}
                alt={item.name}
                className="h-16 w-16 rounded object-cover"
              />

              <div className="flex-1">
                <p className="text-sm font-medium line-clamp-2">{item.name}</p>

                <div className="mt-1 flex items-center gap-2">
                  <div className="flex items-center gap-2 mt-1">
  {/* - */}
  <button
    onClick={() => updateQty(item.id, item.quantity - 1)}
    disabled={item.quantity <= 1}
    className="w-8 h-8 border rounded"
  >
    -
  </button>

  {/* qty */}
  <span className="w-8 text-center">{item.quantity}</span>

  {/* + */}
  <button
    onClick={() => updateQty(item.id, item.quantity + 1)}
    disabled={
      item.quantity >= (item.variant?.stock ?? item.stock ?? 99)
    }
    className="w-8 h-8 border rounded"
  >
    +
  </button>

  <span className="text-xs text-gray-500">
    × {formatPi(unit)} π
  </span>
</div>
                  <span className="text-xs text-gray-500">
                    × {formatPi(unit)} π
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="font-semibold text-orange-600">
                  {formatPi(unit * item.quantity)} π
                </p>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-xs text-red-500"
                >
                  {t.delete}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-7 left-0 right-0 border-t bg-white p-5 pb-8">
        <div className="mb-3 flex justify-between">
          <span>{t.total}</span>
          <span className="font-bold text-orange-600">{formatPi(total)} π</span>
        </div>
          <button
  onClick={handlePay}
  disabled={processing}
  className={`w-full rounded-lg py-3 text-white ${
    processing ? "bg-gray-400" : "bg-orange-600"
  }`}
>
  {processing ? t.processing : t.pay_now}
        </button>
      </div>
    </main>
  );
}
