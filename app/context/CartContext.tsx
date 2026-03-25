"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getPiAccessToken } from "@/lib/piAuth";
/* =========================
   TYPES
========================= */

type CartItem = {
  id: string;
  product_id?: string;

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

/* ========================= */

const CartContext = createContext<CartContextType | undefined>(undefined);

/* ========================= */

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  /* =========================
     LOAD LOCAL STORAGE
  ========================= */

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


   const syncWithServer = async () => {
  try {
    const token = await getPiAccessToken();

    // 🔥 gửi toàn bộ cart
    await fetch("/api/cart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cart),
    });

    // 🔥 lấy lại cart
    const res = await fetch("/api/cart", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return;

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return;

    setCart(data as CartItem[]);
  } catch {}
};

   useEffect(() => {
  if (cart.length === 0) return;

  // chỉ sync khi có Pi
  if (typeof window === "undefined") return;
  if (!(window as any).Pi) return;

  void syncWithServer();
}, []);
  /* =========================
     SAVE LOCAL STORAGE
  ========================= */

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  /* =========================
     ADD TO CART (CHECK STOCK)
  ========================= */

  const addToCart = async (item: CartItem) => {
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

  // 🔥 gọi API (nếu login)
  try {
    const token = await getPiAccessToken();

    await fetch("/api/cart/add", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  product_id: item.product_id ?? item.id,
  quantity: item.quantity ?? 1,
})
    });
  } catch {}
};

  /* =========================
     REMOVE
  ========================= */

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  /* =========================
     CLEAR
  ========================= */

  const clearCart = () => setCart([]);

  /* =========================
     UPDATE QUANTITY (CLAMP STOCK)
  ========================= */

  const updateQty = async (id: string, qty: number) => {
  setCart((prev) =>
    prev.map((p) => {
      if (p.id !== id) return p;

      const maxStock =
        p.variant?.stock ?? p.stock ?? 99;

      const safeQty = Math.max(
        1,
        Math.min(maxStock, qty || 1)
      );

      return {
        ...p,
        quantity: safeQty,
      };
    })
  );

  try {
    const token = await getPiAccessToken();

    const found = cart.find((p) => p.id === id);
if (!found) return;

await fetch("/api/cart/add", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    product_id: found.product_id ?? found.id,
    quantity: qty,
  }),
});
  } catch {}
};

  /* =========================
     UPDATE ITEM (SYNC PRICE / DATA)
  ========================= */

  const updateItem = (id: string, data: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...data } : p
      )
    );
  };

  /* =========================
     TOTAL
  ========================= */

  const total = cart.reduce((sum, item) => {
    const unit =
      typeof item.sale_price === "number"
        ? item.sale_price
        : Number(item.price) || 0;

    return sum + unit * (item.quantity ?? 1);
  }, 0);

  /* ========================= */

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

/* ========================= */

export function useCart() {
  const ctx = useContext(CartContext);

  if (!ctx) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return ctx;
}
