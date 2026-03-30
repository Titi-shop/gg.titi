"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";

/* ================= TYPES ================= */

type CartItem = {
  id: string;
  product_id?: string;
 variant_id?: string | null;
  name: string;

  price: number;
  sale_price?: number | null;

  stock?: number;

  variant?: {
    optionValue?: string;
    stock?: number;
  };

  description?: string;
  thumbnail?: string;
  image?: string;
  images?: string[];

  quantity?: number;
};

type CartContextType = {
  cart: CartItem[];

  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;

  updateQty: (id: string, qty: number) => void;
  updateItem: (id: string, data: Partial<CartItem>) => void;

  total: number;
};

/* ================= CONTEXT ================= */

const CartContext = createContext<CartContextType | undefined>(undefined);

/* ================= PROVIDER ================= */

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { user } = useAuth();
const mergeCartOnLogin = async () => {
  try {
    const token = await getPiAccessToken();
    if (!token || !user) return;

    const localRaw = localStorage.getItem("cart");
    const localCart: CartItem[] = localRaw ? JSON.parse(localRaw) : [];

    // ✅ CASE 1: có local → POST lên DB
    if (localCart.length > 0) {
      await fetch("/api/cart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          localCart.map((item) => ({
            product_id: item.product_id ?? item.id,
            variant_id: item.variant_id ?? null,
            quantity: Math.min(
              item.quantity ?? 1,
              item.variant?.stock ?? item.stock ?? 99
            ),
          }))
        ),
      });

      // 🔥 QUAN TRỌNG NHẤT
      localStorage.removeItem("cart"); // clear local sau khi post
    }

    // ✅ luôn load lại DB (nguồn chuẩn)
    const res = await fetch("/api/cart", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return;

    const data = await res.json();
    setCart(data);

  } catch (err) {
    console.error("❌ MERGE CART ERROR:", err);
  }
};
  /* ================= LOAD LOCAL ================= */

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cart");

      if (!raw) {
        setCart([]);
        return;
      }

      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        setCart([]);
        return;
      }

      setCart(parsed as CartItem[]);
    } catch {
      setCart([]);
    }
  }, []);

  /* ================= SAVE LOCAL ================= */

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  /* ================= LOAD CART FROM SERVER ================= */

useEffect(() => {
  if (!user) return;
  void mergeCartOnLogin();
}, [user]);
  /* ================= ADD ================= */

  const addToCart = async (item: CartItem) => {
  // ✅ update local trước
  setCart((prev) => {
    const found = prev.find((p) => p.id === item.id);

    const maxStock =
      item.variant?.stock ?? item.stock ?? 99;

    if (found) {
      const newQty =
        (found.quantity ?? 1) + (item.quantity ?? 1);

      return prev.map((p) =>
        p.id === item.id
          ? {
              ...p,
              quantity: Math.min(maxStock, newQty),
            }
          : p
      );
    }

    return [
      ...prev,
      {
        ...item,
        product_id: item.product_id ?? item.id,
        quantity: Math.min(maxStock, item.quantity ?? 1),
      },
    ];
  });

  // 🔥🔥🔥 THÊM API CALL (ĐÂY LÀ PHẦN BỊ THIẾU)
  try {
    const token = await getPiAccessToken();
    if (!token || !user) return;

    // 🔥 thêm dòng này
const maxStock = item.variant?.stock ?? item.stock ?? 99;
const safeQty = Math.min(maxStock, item.quantity ?? 1);
    await fetch("/api/cart", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    product_id: item.product_id ?? item.id,
    variant_id: item.variant_id ?? null,
    quantity: safeQty, // ✅ FIX
  }),
});
  } catch (err) {
    console.error("❌ ADD CART API ERROR:", err);
  }
};

  /* ================= REMOVE ================= */

  const removeFromCart = async (id: string) => {
  const item = cart.find((p) => p.id === id);

  // ✅ xoá local trước
  setCart((prev) => prev.filter((p) => p.id !== id));

  if (!user || !item) return;

  try {
    const token = await getPiAccessToken();
    if (!token) return;

    await fetch("/api/cart", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: item.product_id ?? item.id,
        variant_id: item.variant_id ?? null 
      }),
    });

    console.log("🟢 DELETE CART SUCCESS");

  } catch (err) {
    console.error("❌ DELETE CART ERROR:", err);
  }
};

  /* ================= CLEAR ================= */

  const clearCart = () => setCart([]);

  /* ================= UPDATE QTY ================= */

  const updateQty = async (id: string, qty: number) => {
  let target: CartItem | undefined;

  setCart((prev) =>
    prev.map((p) => {
      if (p.id !== id) return p;

      const maxStock = p.variant?.stock ?? p.stock ?? 99;

      const safeQty = Math.max(1, Math.min(maxStock, qty || 1));

      target = { ...p, quantity: safeQty };

      return target;
    })
  );

  // 🔥 sync API
  try {
    if (!user || !target) return;

    const token = await getPiAccessToken();
    if (!token) return;

    await fetch("/api/cart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: target.product_id ?? target.id,
        variant_id: target.variant_id ?? null,
        quantity: target.quantity,
      }),
    });
  } catch (err) {
    console.error("❌ UPDATE QTY ERROR:", err);
  }
};

  /* ================= UPDATE ITEM ================= */

  const updateItem = (id: string, data: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...data } : p
      )
    );
  };

  /* ================= TOTAL ================= */

  const total = cart.reduce((sum, item) => {
    const unit =
      typeof item.sale_price === "number"
        ? item.sale_price
        : Number(item.price) || 0;

    return sum + unit * (item.quantity ?? 1);
  }, 0);

  /* ================= PROVIDER ================= */

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        updateQty,
        updateItem,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/* ================= HOOK ================= */

export function useCart() {
  const ctx = useContext(CartContext);

  if (!ctx) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return ctx;
}

