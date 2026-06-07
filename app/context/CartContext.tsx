"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";

import { getPiAccessToken } from "@/lib/piAuth";

/* =========================================================
   TYPES
========================================================= */

export type CartItem = {
  id: string;
  product_id: string;
  variant_id: string | null;

  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  quantity: number;
  thumbnail: string;
  images: string[];
  is_price_changed: boolean;
  is_out_of_stock: boolean;
};

type AddCartPayload = {
  product_id: string;
  variant_id?: string | null;
  quantity?: number;
  name: string;
  slug: string;
  price: number;
  sale_price?: number | null;
  thumbnail: string;
  images?: string[];
};

type CartContextType = {
  cart: CartItem[];
  total: number;
  loading: boolean;
  addToCart: (
    payload: AddCartPayload
  ) => Promise<void>;
  removeFromCart: (
    id: string
  ) => Promise<void>;

  updateQty: (
    id: string,
    quantity: number
  ) => Promise<void>;

  clearCart: () => void;

  refreshCart: () => Promise<void>;
};

/* =========================================================
   CONTEXT
========================================================= */

const CartContext =
  createContext<CartContextType | null>(
    null
  );

/* =========================================================
   STORAGE
========================================================= */

const LOCAL_CART_KEY =
  "guest_cart_v7";

/* =========================================================
   HELPERS
========================================================= */

function buildCartId(
  productId: string,
  variantId: string | null
): string {
  return `${productId}_${
    variantId ?? "default"
  }`;
}

function normalizeQuantity(
  value: unknown
): number {
  const quantity =
    typeof value === "number" &&
    Number.isFinite(value)
      ? Math.floor(value)
      : 1;

  if (quantity <= 0) {
    return 1;
  }

  if (quantity > 99) {
    return 99;
  }

  return quantity;
}

function safeNumber(
  value: unknown
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeCart(
  rows: unknown
): CartItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(
      (
        row
      ): row is Record<
        string,
        unknown
      > =>
        typeof row === "object" &&
        row !== null
    )
    .map((row) => {
      const productId =
        typeof row.product_id ===
        "string"
          ? row.product_id
          : "";

      const variantId =
        typeof row.variant_id ===
        "string"
          ? row.variant_id
          : null;

      return {
        id: buildCartId(
          productId,
          variantId
        ),

        product_id: productId,

        variant_id: variantId,

        name:
          typeof row.name === "string"
            ? row.name
            : "",

        slug:
          typeof row.slug === "string"
            ? row.slug
            : "",

        price:
          typeof row.price === "string"
            ? row.price
            : "0",

        sale_price:
          typeof row.sale_price ===
          "string"
            ? row.sale_price
            : "0",

        quantity:
          normalizeQuantity(
            row.quantity
          ),

        thumbnail:
          typeof row.thumbnail ===
          "string"
            ? row.thumbnail
            : "",

        images: Array.isArray(
          row.images
        )
          ? row.images.filter(
              (
                image
              ): image is string =>
                typeof image ===
                "string"
            )
          : [],

        is_price_changed:
          row.is_price_changed ===
          true,

        is_out_of_stock:
          row.is_out_of_stock ===
          true,
      };
    });
}

function loadGuestCart(): CartItem[] {
  try {
    const raw =
      localStorage.getItem(
        LOCAL_CART_KEY
      );

    if (!raw) {
      return [];
    }

    return normalizeCart(
      JSON.parse(raw)
    );
  } catch {
    return [];
  }
}

function saveGuestCart(
  cart: CartItem[]
): void {
  localStorage.setItem(
    LOCAL_CART_KEY,
    JSON.stringify(cart)
  );
}

function clearGuestCart(): void {
  localStorage.removeItem(
    LOCAL_CART_KEY
  );
}

/* =========================================================
   PROVIDER
========================================================= */

export function CartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  const [cart, setCart] = useState<
    CartItem[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const mergedRef = useRef(false);

  /* =========================================================
     API
  ========================================================= */

  const fetchServerCart =
    useCallback(async (): Promise<
      CartItem[]
    > => {
      const token =
        await getPiAccessToken();

      if (!token) {
        return [];
      }

      const res = await fetch(
        "/api/cart",
        {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,
          },

          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          "FETCH_CART_FAILED"
        );
      }

      const data: unknown =
        await res.json();

      return normalizeCart(data);
    }, []);

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    const boot = async () => {
      try {
        /* ================= GUEST ================= */

        if (!user) {
          const guestCart =
            loadGuestCart();

          setCart(guestCart);

          return;
        }

        /* ================= LOGIN ================= */

        const serverCart =
          await fetchServerCart();

        setCart(serverCart);
      } catch (err) {
        console.error(
          "[CART][BOOT]",
          err
        );
      } finally {
        setLoading(false);
      }
    };

    boot();
  }, [user, fetchServerCart]);

  /* =========================================================
     MERGE GUEST -> SERVER
  ========================================================= */

  useEffect(() => {
    if (!user) {
      mergedRef.current = false;
      return;
    }

    if (mergedRef.current) {
      return;
    }

    mergedRef.current = true;

    const mergeGuestCart =
      async () => {
        try {
          const guestCart =
            loadGuestCart();

          /* ================= NO GUEST CART ================= */

          if (
            guestCart.length === 0
          ) {
            const serverCart =
              await fetchServerCart();

            setCart(serverCart);

            return;
          }

          const token =
            await getPiAccessToken();

          if (!token) {
            return;
          }

          console.log(
            "[CART][MERGE] START",
            {
              guestItems:
                guestCart.length,
            }
          );

          /* ================= POST GUEST ================= */

          const res = await fetch(
            "/api/cart",
            {
              method: "POST",

              headers: {
                Authorization: `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                guestCart.map(
                  (item) => ({
                    product_id:
                      item.product_id,

                    variant_id:
                      item.variant_id,

                    quantity:
                      item.quantity,
                  })
                )
              ),
            }
          );

          if (!res.ok) {
            throw new Error(
              "MERGE_CART_FAILED"
            );
          }

          const data: unknown =
            await res.json();

          const serverCart =
            normalizeCart(data);

          /* ================= IMPORTANT =================
             CLEAR LOCAL STORAGE
          ================================================= */

          clearGuestCart();

          /* ================= USE SERVER ONLY ================= */

          setCart(serverCart);

          console.log(
            "[CART][MERGE] DONE",
            {
              serverItems:
                serverCart.length,
            }
          );
        } catch (err) {
          console.error(
            "[CART][MERGE]",
            err
          );
        }
      };

    mergeGuestCart();
  }, [user, fetchServerCart]);

  /* =========================================================
     REFRESH
  ========================================================= */

  const refreshCart =
    useCallback(async () => {
      try {
        if (!user) {
          setCart(
            loadGuestCart()
          );

          return;
        }

        const serverCart =
          await fetchServerCart();

        setCart(serverCart);
      } catch (err) {
        console.error(
          "[CART][REFRESH]",
          err
        );
      }
    }, [user, fetchServerCart]);

  /* =========================================================
     ADD
  ========================================================= */

  const addToCart =
    useCallback(
      async (
        payload: AddCartPayload
      ) => {
        try {
          const normalized = {
            product_id:
              payload.product_id,

            variant_id:
              payload.variant_id ??
              null,

            quantity:
              normalizeQuantity(
                payload.quantity
              ),
          };

          /* ================= GUEST ================= */

          if (!user) {
            const local =
              loadGuestCart();

            const id =
              buildCartId(
                normalized.product_id,
                normalized.variant_id
              );

            const existed =
              local.find(
                (item) =>
                  item.id === id
              );

            if (existed) {
              existed.quantity +=
                normalized.quantity;

              if (
                existed.quantity >
                99
              ) {
                existed.quantity = 99;
              }
            } else {
              local.push({
  id,

  product_id: normalized.product_id,
  variant_id: normalized.variant_id,

  name: payload.name,
  slug: payload.slug,

  price: payload.price ?? 0,
  sale_price: payload.sale_price ?? null,

  quantity: normalized.quantity,

  thumbnail: payload.thumbnail ?? "",
  images: payload.images ?? [],

  is_price_changed: false,
  is_out_of_stock: false,
});
            }
            saveGuestCart(local);
            setCart([...local]);
            return;
          }

          /* ================= SERVER ================= */

          const token =
            await getPiAccessToken();

          if (!token) {
            return;
          }

          const res = await fetch(
            "/api/cart",
            {
              method: "POST",

              headers: {
                Authorization: `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                normalized
              ),
            }
          );

          if (!res.ok) {
            throw new Error(
              "ADD_CART_FAILED"
            );
          }

          const data: unknown =
            await res.json();

          setCart(
            normalizeCart(data)
          );
        } catch (err) {
          console.error(
            "[CART][ADD]",
            err
          );
        }
      },
      [user]
    );

  /* =========================================================
     REMOVE
  ========================================================= */

  const removeFromCart =
    useCallback(
      async (id: string) => {
        try {
          const target =
            cart.find(
              (item) =>
                item.id === id
            );

          if (!target) {
            return;
          }

          /* ================= GUEST ================= */

          if (!user) {
            const next =
              cart.filter(
                (item) =>
                  item.id !== id
              );

            saveGuestCart(next);
            setCart(next);
            return;
          }

          /* ================= SERVER ================= */

          const token =
            await getPiAccessToken();

          if (!token) {
            return;
          }

          const res = await fetch(
            "/api/cart",
            {
              method: "DELETE",

              headers: {
                Authorization: `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                {
                  product_id:
                    target.product_id,

                  variant_id:
                    target.variant_id,
                }
              ),
            }
          );

          if (!res.ok) {
            throw new Error(
              "DELETE_CART_FAILED"
            );
          }

          const data: unknown =
            await res.json();

          setCart(
            normalizeCart(data)
          );
        } catch (err) {
          console.error(
            "[CART][REMOVE]",
            err
          );
        }
      },
      [cart, user]
    );

  /* =========================================================
     UPDATE QTY
  ========================================================= */

  const updateQty =
    useCallback(
      async (
        id: string,
        quantity: number
      ) => {
        try {
          const target =
            cart.find(
              (item) =>
                item.id === id
            );

          if (!target) {
            return;
          }

          const normalizedQuantity =
            normalizeQuantity(
              quantity
            );

          /* ================= GUEST ================= */

          if (!user) {
            const next =
              cart.map((item) => {
                if (
                  item.id !== id
                ) {
                  return item;
                }

                return {
                  ...item,
                  quantity:
                    normalizedQuantity,
                };
              });

            saveGuestCart(next);

            setCart(next);

            return;
          }

          /* ================= SERVER ================= */

          const token =
            await getPiAccessToken();

          if (!token) {
            return;
          }

          const res = await fetch(
            "/api/cart",
            {
              method: "PATCH",

              headers: {
                Authorization: `Bearer ${token}`,

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                {
                  product_id:
                    target.product_id,

                  variant_id:
                    target.variant_id,

                  quantity:
                    normalizedQuantity,
                }
              ),
            }
          );

          if (!res.ok) {
            throw new Error(
              "UPDATE_QTY_FAILED"
            );
          }

          const data: unknown =
            await res.json();

          setCart(
            normalizeCart(data)
          );
        } catch (err) {
          console.error(
            "[CART][UPDATE_QTY]",
            err
          );
        }
      },
      [cart, user]
    );

  /* =========================================================
     CLEAR
  ========================================================= */

  const clearCart =
    useCallback(() => {
      if (!user) {
        clearGuestCart();
      }

      setCart([]);
    }, [user]);

  /* =========================================================
     TOTAL
  ========================================================= */

  const total = useMemo(() => {
    return cart.reduce(
      (sum, item) => {
        const price =
          safeNumber(
            item.sale_price ||
              item.price
          );

        return (
          sum +
          price * item.quantity
        );
      },
      0
    );
  }, [cart]);

  /* =========================================================
     PROVIDER
  ========================================================= */

  return (
    <CartContext.Provider
      value={{
        cart,
        total,
        loading,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/* =========================================================
   HOOK
========================================================= */

export function useCart() {
  const context =
    useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return context;
}
