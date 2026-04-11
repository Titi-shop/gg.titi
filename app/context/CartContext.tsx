"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";

/* ================= TYPES ================= */

type CartItem = {
  id: string;
  product_id: string; 
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
  synced?: boolean;
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
    const newItems = localCart.filter((i) => !i.synced);

    if (newItems.length > 0) {
      await fetch("/api/cart", {
  method: "POST",
  cache: "no-store",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  
        body: JSON.stringify(
          newItems.map((item) => ({
            product_id: item.product_id!,
            variant_id: item.variant_id ?? null,
            quantity: item.quantity ?? 1,
          }))
        ),
      });
    }

    // 👉 load server cart (nguồn chuẩn)
    const res = await fetch("/api/cart", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return;

    const serverCart = await res.json();

    // 👉 set tất cả là synced
    const finalCart = serverCart.map((item: CartItem) => ({
  ...item,

  id:
  item.variant_id && item.variant_id !== null
    ? `${item.product_id}_${item.variant_id}`
    : `${item.product_id}_default`,

  // ✅ đảm bảo có quantity
  quantity: item.quantity ?? 1,

  synced: true,
}));

    setCart(finalCart);
    localStorage.removeItem("cart"); // 🔥 QUAN TRỌNG

  } catch (err) {
    console.error("❌ MERGE ERROR:", err);
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
  // ✅ VALIDATE
  if (!item.product_id || typeof item.product_id !== "string") {
    console.error("[CART][CLIENT] INVALID product_id", item);
    return;
  }

  const uniqueId =
    item.variant_id && item.variant_id !== null
      ? `${item.product_id}_${item.variant_id}`
      : `${item.product_id}_default`;

  console.log("[CART][ADD]", {
    name: item.name,
    product_id: item.product_id,
    variant_id: item.variant_id,
    uniqueId,
  });

  const maxStock = item.variant?.stock ?? item.stock ?? 99;
  const safeQty = Math.min(maxStock, item.quantity ?? 1);

  // ✅ update local UI trước (optimistic)
  setCart((prev) => {
    const found = prev.find((p) => p.id === uniqueId);

    if (found) {
      return prev.map((p) =>
        p.id === uniqueId
          ? {
              ...p,
              quantity: Math.min(maxStock, (p.quantity ?? 1) + safeQty),
              synced: false,
            }
          : p
      );
    }

    return [
      ...prev,
      {
        ...item,
        id: uniqueId,
        product_id: item.product_id,
        quantity: safeQty,
        synced: false,
      },
    ];
  });

  // 👉 API
  try {
    if (!user) {
      console.warn("[CART] user not ready → save local only");
      return;
    }

    const token = await getPiAccessToken();
    if (!token) {
      console.warn("[CART] no token");
      return;
    }

    console.log("[CART][POST_SEND]", {
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: safeQty,
    });

    const res = await fetch("/api/cart", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: item.product_id,
        variant_id: item.variant_id ?? null,
        quantity: safeQty,
      }),
    });

    // ❌ API lỗi
    if (!res.ok) {
      console.error("[CART] POST failed", await res.text());
      return;
    }

    // ✅ reload cart từ server
    const cartRes = await fetch("/api/cart", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!cartRes.ok) {
      console.warn("[CART] GET cart failed");
      return;
    }

    const serverCart = await cartRes.json();

    console.log("[CART][SYNC]", serverCart);

    setCart(serverCart);

  } catch (err) {
    console.error("[CART][CLIENT_POST_FAILED]", err);
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
        product_id: item.product_id!,
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
        product_id: target.product_id!,
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
