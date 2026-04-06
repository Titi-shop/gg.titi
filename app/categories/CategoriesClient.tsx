"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/app/context/CartContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";

/* ================= TYPES ================= */

type Category = {
  id: number | string;
  name: string;
  icon?: string | null;
};

type ProductVariant = {
  id: string;
  name: string;
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

/* ================= HELPERS ================= */

function getMainImage(product: Product) {
  return product.thumbnail || "/placeholder.png";
}

/* ================= CLIENT PAGE ================= */

export default function CategoriesClient() {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategoryId, setActiveCategoryId] =
    useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState<{
  text: string;
  type: "error" | "success";
} | null>(null);

const showMessage = (text: string, type: "error" | "success" = "error") => {
  setMessage({ text, type });
  setTimeout(() => setMessage(null), 3000);
};

  const handleAddToCart = (product: Product) => {
  if (product.isActive === false) {
    showMessage(t.product_unavailable || "Product is unavailable");
    return;
  }

  if (product.variants && product.variants.length > 0) {
    showMessage(t.select_variant || "Please select size / variant");
    return;
  }

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

  showMessage(t.added_to_cart || "Added to cart", "success");
};

  /* ================= LOAD DATA ================= */

  useEffect(() => {
  let mounted = true;

  Promise.all([
    fetch("/api/categories").then((r) => r.json()),
    fetch("/api/products").then((r) => r.json()),
  ])
    .then(([cateData, prodData]) => {
      if (!mounted) return;

      setCategories(
        Array.isArray(cateData)
          ? [...cateData].sort((a, b) => Number(a.id) - Number(b.id))
          : []
      );

      setProducts(Array.isArray(prodData) ? prodData : []);
    })
    .catch(console.error)
    .finally(() => {
      if (mounted) setLoading(false);
    });

  return () => {
    mounted = false;
  };
}, []);

  /* ================= FILTER ================= */

  const visibleProducts = useMemo(() => {
    if (activeCategoryId === null) return products;
    return products.filter(
      (p) => String(p.categoryId) === String(activeCategoryId)
    );
  }, [products, activeCategoryId]);

  return (
    <main className="bg-gray-50 min-h-screen pb-24">
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
      <div className="mt-3">
        <Image
          src="/banners/30FD1BCC-E31C-4702-9E63-8BF08C5E311C.png"
          alt="Banner"
          width={1200}
          height={400}
          className="w-full h-[160px] object-cover"
          priority
        />
      </div>

      <div className="mt-2 grid grid-cols-[70px_1fr] gap-0">
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

            {categories.map((c) => {
              const active = String(activeCategoryId) === String(c.id);

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

        {/* ===== RIGHT PRODUCTS ===== */}
        <section className="bg-gray-100 p-1">
          {loading ? (
            <p className="text-sm text-gray-400">
              {t["loading_products"] || "Đang tải..."}
            </p>
          ) : visibleProducts.length === 0 ? (
            <p className="text-sm text-gray-400">
              {t["no_products"] ?? "Chưa có sản phẩm"}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-[6px]">
              {visibleProducts.map((p) => {
                const isSale = p.isSale;
                const finalPrice = p.finalPrice;

                const discount =
                  isSale && p.salePrice !== null && p.price > 0
                    ? Math.round(((p.price - p.salePrice) / p.price) * 100)
                    : 0;

                return (
                  <Link
                    key={p.id}
                    href={`/product/${p.id}`}
                  >
                    <div className="bg-white rounded-xl overflow-hidden border">
                      <div className="relative">
                        <Image
                          src={getMainImage(p)}
                          alt={p.name}
                          width={300}
                          height={300}
                          className="w-full h-44 object-cover"
                        />

                        {isSale && (
                          <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                            -{discount}%
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                       e.preventDefault();
                      e.stopPropagation();
                      handleAddToCart(p);
                       }}
                          className="absolute top-2 right-2 bg-white p-2 rounded-full shadow active:scale-95"
                          aria-label="Add to cart"
                        >
                          <ShoppingCart size={16} />
                        </button>
                      </div>

                      <div className="p-3">
                        <p className="text-sm line-clamp-2 min-h-[40px]">
                          {p.name}
                        </p>

                        <p className="text-red-600 font-bold mt-1">
                          {formatPi(finalPrice)} π
                        </p>

                        {isSale && (
                          <p className="text-xs text-gray-400 line-through">
                            {formatPi(p.price)} π
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
