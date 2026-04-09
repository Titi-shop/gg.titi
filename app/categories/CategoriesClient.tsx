"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/app/context/CartContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import useSWR from "swr";
/* ================= TYPES ================= */

type Category = {
  id: number | string;
  name: string;
  icon?: string | null;
};

type ProductVariant = {
  id: string;
  optionValue: string;
  stock: number;
};

type Product = {
  id: number | string;
  name: string;
  price: number;
  finalPrice: number;
  isSale: boolean;
  thumbnail?: string;

  isActive?: boolean;
  stock?: number;
  variants?: ProductVariant[];

  categoryId: number | string;
  sold: number;
};
const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("FETCH_FAILED");
  }

  return res.json() as Promise<T>;
};

/* ================= COMPONENT ================= */

export default function CategoriesClient() {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const [activeCategoryId, setActiveCategoryId] =
    useState<number | string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "error" | "success";
  } | null>(null);

  const showMessage = (text: string, type: "error" | "success" = "error") => {
  setMessage({ text, type });
  const timer = setTimeout(() => setMessage(null), 2500);
  return () => clearTimeout(timer);
};

  /* ================= LOAD DATA (OPTIMIZED) ================= */
useEffect(() => {
  const prev = document.body.style.background;
  document.body.style.background = "#f9fafb";

  return () => {
    document.body.style.background = prev;
  };
}, []);
  const {
  data: categoriesData,
  isLoading: loadingCategories,
} = useSWR<Category[]>("/api/categories", fetcher);

const {
  data: productsData,
  isLoading: loadingProducts,
} = useSWR<Product[]>("/api/products", fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 5000,
});

  const categories = useMemo(() => {
  if (!categoriesData) return [];

  return [...categoriesData].sort(
    (a, b) => Number(a.id) - Number(b.id)
  );
}, [categoriesData]);

const products = useMemo(() => {
  if (!productsData) return [];
  return productsData;
}, [productsData]);

const loading = loadingCategories || loadingProducts;

  /* ================= FILTER ================= */

  const visibleProducts = useMemo(() => {
  if (activeCategoryId === null) return products;

  return products.filter(
  (p) => p.categoryId == activeCategoryId
);
}, [products, activeCategoryId]);

  /* ================= ADD TO CART ================= */

  const handleAddToCart = (product: Product) => {
  if (product.isActive === false) {
    showMessage(t.product_unavailable || "Product unavailable");
    return;
  }

  if (product.variants?.length) {
    const available = product.variants.find((v) => v.stock > 0);

    if (!available) {
      showMessage(t.out_of_stock || "Out of stock");
      return;
    }

    // 👉 điều hướng luôn
    window.location.href = `/product/${product.id}`;
    return;
  }

  // ❗ CHỈ chạy khi KHÔNG có variants
  if (product.stock !== undefined && product.stock <= 0) {
    showMessage(t.out_of_stock || "Out of stock");
    return;
  }

  addToCart({
    id: String(product.id),
    name: product.name,
    price: product.price,
    sale_price: product.finalPrice,
    quantity: 1,
    thumbnail: product.thumbnail,
  });

  showMessage(t.added_to_cart || "Added", "success");
};

  /* ================= UI ================= */

  return (
    <main className="bg-gray-50 min-h-screen pb-24">
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

      {/* BANNER */}
      <Image
        src="/banners/30FD1BCC-E31C-4702-9E63-8BF08C5E311C.png"
        alt="Banner"
        width={1200}
        height={400}
        className="w-full h-[160px] object-cover mt-3"
        priority
      />

      <div className="mt-2 grid grid-cols-[70px_1fr]">
        {/* ===== LEFT CATEGORY ===== */}
        <aside className="bg-white border-r">
          <div className="flex flex-col items-center py-2 gap-4">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`flex flex-col items-center gap-1 w-full ${
                activeCategoryId === null
                  ? "text-orange-600 font-semibold"
                  : "text-gray-500"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activeCategoryId === null
                    ? "bg-orange-100"
                    : "bg-gray-100"
                }`}
              >
                <span className="text-lg">🛍</span>
              </div>
              <span className="text-[10px] leading-tight text-center px-1">
                {t["all"] ?? "All"}
              </span>
            </button>

            {categories?.map((c) => {
              const active = activeCategoryId == c.id;

              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategoryId(c.id)}
                  className={`flex flex-col items-center gap-1 w-full ${
                    active
                      ? "text-orange-600 font-semibold"
                      : "text-gray-500"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      active ? "bg-orange-100" : "bg-gray-100"
                    }`}
                  >
                    <img
                      src={c.icon || "/placeholder.png"}
                      alt={c.name}
                      className="w-6 h-6 object-contain"
                    />
                  </div>

                  <span className="text-[10px] leading-tight text-center px-1 line-clamp-2">
                    {t[`category_${c.id}`] || c.name}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* RIGHT */}
        <section className="p-2">
  {loading ? (
    <div className="grid grid-cols-2 gap-2">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-white h-52 animate-pulse rounded-xl"
        />
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-2">
      {visibleProducts.map((p) => (
        <Link key={p.id} href={`/product/${p.id}`}>
          <div className="bg-white rounded-xl border overflow-hidden relative">
            <Image
              src={
            p.thumbnail && p.thumbnail.trim().startsWith("http")
           ? p.thumbnail
           : "/placeholder.png"
            }
              alt={p.name}
              width={300}
              height={300}
              className="w-full h-40 object-cover"
            />

            <div className="p-2">
              <p className="text-sm line-clamp-2">{p.name}</p>

              <p className="text-red-600 font-bold">
                {formatPi(p.finalPrice)} π
              </p>

              <button
                className="absolute top-2 right-2 bg-white p-2 rounded-full shadow active:scale-95"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddToCart(p);
                }}
              >
                <ShoppingCart size={16} />
              </button>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )}
</section>
      </div>
    </main>
  );
}
