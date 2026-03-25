"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";

/* ================= TYPES ================= */

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

/* ================= CONTEXT ================= */

const CartContext = createContext<CartContextType | undefined>(undefined);

/* ================= PROVIDER ================= */

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { user } = useAuth();

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

  /* ================= SYNC WITH SERVER ================= */

  const syncWithServer = async () => {
    try {
      const token = await getPiAccessToken();
      if (!token) return;

      // 🔥 gửi local cart lên server
      await fetch("/api/cart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cart),
      });

      // 🔥 lấy lại cart từ server (nguồn chính)
      const res = await fetch("/api/cart", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      if (!Array.isArray(data)) return;

      // 🔥 replace local cart
      setCart(data);
    } catch {
      // silent
    }
  };

  /* ================= SYNC WHEN LOGIN ================= */

  useEffect(() => {
    if (!user) return;
    if (cart.length === 0) return;

    if (typeof window === "undefined") return;
    if (!("Pi" in window)) return;

    void syncWithServer();
  }, [user]); // 🔥 chỉ chạy khi login

  /* ================= ADD ================= */

  const addToCart = (item: CartItem) => {
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
  };

  /* ================= REMOVE ================= */

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  /* ================= CLEAR ================= */

  const clearCart = () => setCart([]);

  /* ================= UPDATE QTY ================= */

  const updateQty = (id: string, qty: number) => {
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
