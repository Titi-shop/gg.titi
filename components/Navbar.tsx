"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useMemo } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { availableLanguages } from "@/app/lib/i18n";
import { useCart } from "@/app/context/CartContext";

export default function Navbar() {
  const { t, lang, setLang } = useTranslation();
  const { cart } = useCart();

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  return (
    <header
      className="
        fixed top-0 left-0 right-0 z-50
        bg-orange-500 text-white
        shadow-md
      "
      style={{
        paddingTop: "env(safe-area-inset-top)", // 🔥 iPhone notch
      }}
    >
      <div className="h-[56px] px-3 flex items-center justify-between">
        
        {/* 🛒 CART */}
        <Link
          href="/cart"
          className="flex items-center gap-1 relative"
        >
          <ShoppingCart size={20} />
          <span>{t.cart || "Cart"}</span>

          {cartCount > 0 && (
            <span className="absolute -top-2 -right-3 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
              {cartCount}
            </span>
          )}
        </Link>

        {/* 🌐 LANGUAGE */}
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="bg-white text-black text-xs px-2 py-1 rounded"
        >
          {Object.entries(availableLanguages).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
