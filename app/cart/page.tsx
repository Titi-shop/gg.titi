"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useCart } from "@/app/context/CartContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

import { formatPi } from "@/lib/pi";

interface Message {
  text: string;
  type: "error" | "success";
}

export default function CartPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const { cart, updateQty, removeFromCart } = useCart();
  const [openCheckout, setOpenCheckout] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
useEffect(() => {
  if (typeof window === "undefined") return;

  const raw = localStorage.getItem("checkout_payload");
  if (!raw) return;

  try {
    const data = JSON.parse(raw);

    // ✅ đúng product thì mới mở
    if (data.product_id === product.id) {
      localStorage.removeItem("checkout_payload");

      setTimeout(() => {
        setOpenCheckout(true);
      }, 300);
    }
  } catch {
    localStorage.removeItem("checkout_payload");
  }
}, [product.id]);
  /* ================= MESSAGE ================= */

  const showMessage = (text: string, type: "error" | "success" = "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  /* ================= SELECT ================= */

  const selectedItems = useMemo(
    () => cart.filter((i) => selectedIds.includes(i.id)),
    [cart, selectedIds]
  );

  /* ================= TOTAL ================= */

  const total = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const unit =
          typeof item.sale_price === "number"
            ? item.sale_price
            : item.price;

        return sum + unit * item.quantity;
      }, 0),
    [selectedItems]
  );

  /* ================= TOGGLE ================= */

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  /* ================= CHECKOUT ================= */

  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      showMessage(t.please_select_product);
      return;
    }

    if (selectedItems.length > 1) {
      showMessage(t.only_one_product_supported);
      return;
    }

    const item = selectedItems[0];

    if (!item?.product_id) {
      showMessage(t.invalid_product);
      return;
    }

    const handleCheckout = () => {
  if (selectedItems.length === 0) {
    showMessage(t.please_select_product);
    return;
  }

  if (selectedItems.length > 1) {
    showMessage(t.only_one_product_supported);
    return;
  }

  const item = selectedItems[0];

  if (!item?.product_id) {
    showMessage(t.invalid_product);
    return;
  }

  // 🔥 chỉ set flag checkout
  localStorage.setItem(
    "checkout_payload",
    JSON.stringify({
      product_id: item.product_id,
      quantity: item.quantity,
      variant_id: item.variant?.id ?? null,
    })
  );

  router.push(`/product/${item.product_id}`);
};
  /* ================= EMPTY ================= */

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

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-50 pb-36 relative">
      {/* MESSAGE */}
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

      {/* CART LIST */}
      <div className="bg-white divide-y">
        {cart.map((item) => {
          const unit =
            typeof item.sale_price === "number"
              ? item.sale_price
              : item.price;

          const hasSale =
            typeof item.sale_price === "number" &&
            item.sale_price < item.price;

          const maxStock = item.variant?.stock ?? item.stock ?? 99;

          return (
            <div key={item.id} className="flex items-center gap-3 p-4">
              {/* CHECKBOX */}
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => toggleItem(item.id)}
              />

              {/* IMAGE */}
              <div className="relative">
                <img
                  src={item.thumbnail || "/placeholder.png"}
                  alt={item.name}
                  className="h-16 w-16 rounded object-cover"
                />

                {hasSale && (
                  <div className="absolute top-0 left-0 bg-red-500 text-white text-[10px] px-1 rounded-br">
                    SALE
                  </div>
                )}
              </div>

              {/* INFO */}
              <div className="flex-1">
                <p className="text-sm font-medium line-clamp-2">
                  {item.name}
                </p>

                {/* PRICE */}
                <div className="mt-1 flex items-center gap-2">
                  {hasSale && (
                    <span className="text-xs text-gray-400 line-through">
                      {formatPi(item.price)} π
                    </span>
                  )}

                  <span className="text-sm font-semibold text-orange-600">
                    {formatPi(unit)} π
                  </span>
                </div>

                {/* QTY */}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <button
                      onClick={() =>
                        updateQty(item.id, item.quantity - 1)
                      }
                      disabled={item.quantity <= 1}
                      className="px-3 py-1 text-lg bg-gray-100 disabled:opacity-30"
                    >
                      −
                    </button>

                    <div className="px-4 text-sm font-medium">
                      {item.quantity}
                    </div>

                    <button
                      onClick={() =>
                        updateQty(
                          item.id,
                          Math.min(item.quantity + 1, maxStock)
                        )
                      }
                      disabled={item.quantity >= maxStock}
                      className="px-3 py-1 text-lg bg-gray-100 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>

                  {/* TOTAL */}
                  <div className="text-right">
                    <p className="font-semibold text-orange-600">
                      {formatPi(unit * item.quantity)} π
                    </p>

                    {item.quantity >= maxStock && (
                      <p className="text-[10px] text-red-500">
                        {t.max_stock_reached}
                      </p>
                    )}
                  </div>
                </div>

                {/* DELETE */}
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-xs text-red-500 mt-1"
                >
                  {t.delete}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="fixed bottom-7 left-0 right-0 border-t bg-white p-5 pb-8">
        <div className="mb-3 flex justify-between">
          <span>{t.total}</span>
          <span className="font-bold text-orange-600">
            {formatPi(total)} π
          </span>
          <CheckoutSheet
  open={openCheckout}
  onClose={() => setOpenCheckout(false)}
  product={product}
/>
        </div>

        <button
          onClick={handleCheckout}
          className="w-full rounded-lg py-3 text-white bg-orange-600"
        >
          {t.checkout}
        </button>
      </div>
    </main>
  );
}
