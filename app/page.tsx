"use client";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import {
  ShoppingCart,
  Flame,
  ChevronRight,
  Star,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import SplashScreen from "./components/SplashScreen";
import BannerCarousel from "./components/BannerCarousel";
import PiPriceWidget from "./components/PiPriceWidget";

import { useCart } from "@/app/context/CartContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import type { Product } from "@/types/product";
import type { Category } from "@/types/category";

/* =========================================================
   FETCHER
========================================================= */

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("FETCH_FAILED");
  }

  return res.json() as Promise<T>;
};

/* =========================================================
   HELPERS
========================================================= */

function getMainImage(product: Product) {
  if (
    product.thumbnail &&
    product.thumbnail.trim().length > 0
  ) {
    return product.thumbnail;
  }

  return "/placeholder.png";
}

function getDiscount(product: Product) {
  if (
    product.sale_price &&
    product.price > product.sale_price
  ) {
    return Math.round(
      ((product.price - product.sale_price) /
        product.price) *
        100
    );
  }

  return 0;
}

/* =========================================================
   PRODUCT CARD
=========================================================*/
function ProductCard({
  product,
  onAddToCart,
  t,
  compact = false,
}: {
  product: Product;
  onAddToCart?: (p: Product) => void;
  t: Record<string, string>;
  compact?: boolean;
}) {
  const router = useRouter();

  return (
    <div
  onClick={() => router.push(`/product/${product.id}`)}
  className={`
    flex flex-col overflow-hidden rounded-2xl
    bg-[var(--card-bg)]
    border
    shadow-sm
    hover:shadow-md
    active:scale-[0.98]
    transition-all
    duration-200
    ${compact ? "h-[270px]" : "h-[320px]"}
  `}
  style={{
    borderColor: "var(--nav-border)",
  }}
>
      {/* IMAGE - FIX PROPORTION */}
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--card-secondary)]">
  <Image
    src={getMainImage(product)}
    alt={product.name}
    fill
    sizes="(max-width:768px) 50vw, 25vw"
    className="
      object-cover
      transition-transform
      duration-500
      group-hover:scale-105
    "
  />

        {product.sale_price && (
          <div className="absolute left-2 top-2 rounded bg-red-600 px-2 py-[2px] text-[10px] font-bold text-white">
            -{getDiscount(product)}%
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex flex-col flex-1 p-2">
        {/* NAME */}
        <p className="min-h-[34px] text-[13px] font-semibold leading-snug line-clamp-2">
          {product.name}
        </p>

        {/* META */}
        <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
          <Star size={11} className="fill-yellow-400 text-yellow-400" />
          {product.rating_avg || 5}
          <span>• {product.sold || 0}</span>
        </div>

        {/* PRICE */}
        <div className="mt-auto flex items-end justify-between">
          <div className="flex flex-col">
            <p
  className="text-sm font-black"
  style={{
    color: "var(--color-primary)",
  }}
>
              {formatPi(product.final_price || product.price)} π
            </p>

            {product.sale_price && (
              <p className="text-[10px] text-gray-400 line-through">
                {formatPi(product.price)} π
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function ProductSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg bg-white border border-gray-100">
      {/* IMAGE SKELETON */}
      <div className="h-44 w-full bg-gray-200 animate-pulse relative overflow-hidden">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>

      {/* TEXT */}
      <div className="p-2 space-y-2">
        <div className="h-3 w-full bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />

        <div className="flex items-center gap-2 mt-2">
          <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mt-2" />
      </div>
    </div>
  );
}
/* =========================================================
   PAGE
========================================================= */

export default function HomePage() {
  const router = useRouter();
  const { addToCart } = useCart();
  const { t } = useTranslation();
  const [showSplash, setShowSplash] = useState(false);

  const [selectedCategory, setSelectedCategory] =
    useState<number | "all">("all");

  const [message, setMessage] = useState<{
    text: string;
    type: "error" | "success";
  } | null>(null);

  /* =========================================================
     DATA
  ========================================================= */

  const {
    data: productsData,
    isLoading: loadingProducts,
  } = useSWR<Product[]>(
    "/api/products",
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  const {
    data: categoriesData,
    isLoading: loadingCategories,
  } = useSWR<Category[]>(
    "/api/categories",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  const products = useMemo(() => {
    return productsData || [];
  }, [productsData]);

  const categories = useMemo(() => {
    return categoriesData || [];
  }, [categoriesData]);

  const loading =
    loadingProducts || loadingCategories;

  /* =========================================================
     EFFECTS
  ========================================================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);
  
useEffect(() => {
  const hasSeenSplash = sessionStorage.getItem("splash_seen");

  if (!hasSeenSplash) {
    setShowSplash(true);

    const timer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem("splash_seen", "1");
    }, 1200);

    return () => clearTimeout(timer);
  }
}, []);
  /* =========================================================
     MESSAGE
  ========================================================= */

  const showMessage = (
    text: string,
    type: "error" | "success" = "error"
  ) => {
    setMessage({ text, type });

    setTimeout(() => {
      setMessage(null);
    }, 2500);
  };

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "all") {
      return products;
    }

    return products.filter(
      (p) =>
        Number(p.category_id) ===
        Number(selectedCategory)
    );
  }, [products, selectedCategory]);

  /* =========================================================
     TRENDING
  ========================================================= */

  const trendingProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 8);
  }, [products]);

  /* =========================================================
     CART
  ========================================================= */

  const handleAddToCart = (product: Product) => {
  if (!product.is_active) {
    showMessage(
      t.product_unavailable || "Product unavailable"
    );
    return;
  }

  const isOutOfStock =
    !product.is_unlimited &&
    (product.stock ?? 0) <= 0;

  if (isOutOfStock) {
    showMessage(
      t.out_of_stock || "Out of stock"
    );
    return;
  }

  // 🔥 TYPE SAFE VARIANT CHECK (NO ANY)
  const hasVariant =
    Boolean(product.has_variants) ||
    (product.variants?.length ?? 0) > 0 ||
    (product.options?.size?.length ?? 0) > 0;

  if (hasVariant) {
    showMessage(
      t.please_select_variant ||
        "Please select variant before adding to cart"
    );

    return;
  }

  addToCart({
    id: String(product.id),
    product_id: product.id,
    name: product.name,
    price: product.price,
    sale_price:
      product.final_price || product.sale_price,
    quantity: 1,
    thumbnail: product.thumbnail,
  });

  showMessage(
    t.added_to_cart || "Added to cart",
    "success"
  );
};

  /* =========================================================
     LOADING
  ========================================================= */

  if (
    showSplash ||
    (loading && products.length === 0)
  ) {
    return <SplashScreen />;
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen pb-28 bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
      {/* MESSAGE */}

      {message && (
        <div
          className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl ${
            message.type === "error"
              ? "bg-red-500 text-white"
              : "bg-green-500 text-white"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* HERO */}
<section className="relative w-full overflow-hidden border-b-4 border-orange-500 bg-gradient-to-br from-black via-gray-900 to-orange-600 px-5 pb-10 pt-6 text-white">
  {/* glow effects */}
  <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-orange-500/20 blur-3xl" />
  <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-red-500/20 blur-3xl" />

  {/* subtle edge highlight */}
  <div className="pointer-events-none absolute inset-0 ring-1 ring-orange-400/30" />

  <div className="relative z-10">
    <BannerCarousel />

    <div className="mt-3 flex justify-center">
      <PiPriceWidget />
    </div>

    <div className="mt-8">
      <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold backdrop-blur-xl">
        <Sparkles size={14} />
        {t.future_marketplace || "Future Marketplace"}
      </div>

      <h1 className="mt-5 max-w-xl text-4xl font-black leading-tight">
        {t.discover_modern_products ||
          "Discover modern commerce experiences"}
      </h1>

      <p className="mt-4 max-w-md text-sm text-white/80">
        {t.smart_shopping_discovery ||
          "Trending products, curated collections and next generation shopping."}
      </p>

      <button
        onClick={() => router.push("/categories")}
        className="mt-6 flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black shadow-lg active:scale-95 transition"
      >
        {t.explore_now || "Explore Now"}
        <ChevronRight size={16} />
      </button>
    </div>
  </div>
</section>

{/* CATEGORY */}

<section className="mt-3 px-3">
  <div className="mb-2 flex items-center justify-between">
    <div>
      <h2 className="text-base font-bold leading-tight">
        {t.categories || "Categories"}
      </h2>

      <p className="text-[10px] text-[var(--text-muted)]">
        {t.shop_by_category || "Shop by category"}
      </p>
    </div>
  </div>

  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">

    {/* ALL */}

    <button
      onClick={() => setSelectedCategory("all")}
      className={`flex min-w-[72px] flex-col items-center gap-1.5 rounded-xl px-2 py-2 transition-all duration-200 ${
        selectedCategory === "all"
          ? "scale-[1.03] shadow-md"
          : ""
      }`}
      style={{
        background:
          selectedCategory === "all"
            ? "var(--color-primary)"
            : "var(--card-bg)",
        border:
          selectedCategory === "all"
            ? "2px solid var(--color-primary)"
            : "1px solid var(--nav-border)",
      }}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{
          background:
            selectedCategory === "all"
              ? "rgba(255,255,255,0.15)"
              : "var(--card-secondary)",
        }}
      >
        <span className="text-[22px]">
          🛍️
        </span>
      </div>

      <span
        className="text-[10px] font-medium text-center leading-tight"
        style={{
          color:
            selectedCategory === "all"
              ? "#fff"
              : "var(--foreground)",
        }}
      >
        {t.all || "All"}
      </span>
    </button>

    {/* CATEGORIES */}

    {categories.map((category) => {
      const active =
        Number(selectedCategory) ===
        Number(category.id);

      return (
        <button
          key={category.id}
          onClick={() =>
            setSelectedCategory(
              Number(category.id)
            )
          }
          className={`flex min-w-[72px] flex-col items-center gap-1.5 rounded-xl px-2 py-2 transition-all duration-200 ${
            active
              ? "scale-[1.03] shadow-md"
              : ""
          }`}
          style={{
            background: active
              ? "var(--color-primary)"
              : "var(--card-bg)",
            border: active
              ? "2px solid var(--color-primary)"
              : "1px solid var(--nav-border)",
          }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{
              background: active
                ? "rgba(255,255,255,0.15)"
                : "var(--card-secondary)",
            }}
          >
            <span className="text-[22px]">
              {category.icon}
            </span>
          </div>

          <span
            className="line-clamp-2 text-center text-[10px] font-medium leading-tight"
            style={{
              color: active
                ? "#fff"
                : "var(--foreground)",
            }}
          >
            {t[category.key] ||
              category.key}
          </span>
        </button>
      );
    })}
  </div>
</section>
{/* TRENDING */}
<section className="mt-3 px-0">
  <div className="mb-2 flex items-center justify-between">
    <div>
      <div className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-[2px] text-[9px] font-semibold text-orange-600">
        <TrendingUp size={11} />
        {t.trending_now || "Trending"}
      </div>

      <h2 className="mt-1 text-sm font-bold">
        {t.best_selling_products || "Best selling"}
      </h2>
    </div>

    <button className="text-[10px] text-gray-500">
      {t.view_all || "View"}
    </button>
  </div>

  <div className="flex gap-1 overflow-x-auto pb-1">
  {trendingProducts.map((product) => (
    <div
      key={product.id}
      className="min-w-[170px] max-w-[170px]"
    >
      <ProductCard
        product={product}
        compact
      />
    </div>
  ))}
</div>
</section>

      {/* FLASH SALE */}
<section className="mt-2 px-1 relative z-10">
  <div className="rounded-2xl bg-gradient-to-r from-red-600 via-orange-500 to-red-500 text-white p-3 overflow-hidden">

    {/* HEADER */}
    <div className="flex items-center justify-between mb-3">
      <div>
        <div className="inline-flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full text-[11px]">
          <Flame size={12} />
          {t.flash_sale}
        </div>

        <h2 className="mt-1 text-sm font-bold">
          {t.limited_time_deals}
        </h2>
      </div>

      <button
        onClick={() => router.push("/flash-sale")}
        className="text-[11px] bg-white/20 px-3 py-1 rounded-lg"
      >
        {t.view}
      </button>
    </div>

    {/* SCROLL FIX */}
    <div
      className="
        flex gap-3
        overflow-x-auto
    overflow-y-hidden
    pb-2
    -mx-1 px-1
    snap-x snap-mandatory
    scroll-smooth
      "
      style={{
        WebkitOverflowScrolling: "touch",
      }}
    >
      {products
        .filter((p) => p.sale_price)
        .slice(0, 10)
        .map((product) => (
          <div
            key={product.id}
            onClick={() => router.push(`/product/${product.id}`)}
            className="
              min-w-[130px]
              flex-shrink-0
              rounded-xl
              bg-white
              text-black
              overflow-hidden
              shadow-sm
              snap-start
              active:scale-[0.97]
              transition
            "
            >
  
<Image
  src={getMainImage(product)}
  alt={product.name}
  width={300}
  height={300}
  className="h-24 w-full object-cover"
/>

            <div className="p-2">
              <p className="text-[11px] line-clamp-2">
                {product.name}
              </p>

              <p className="text-sm font-bold text-red-500 mt-1">
                {formatPi(product.final_price || product.price)} π
              </p>
            </div>
          </div>
        ))}
    </div>
  </div>
</section>

      {/* PRODUCTS */}

      <section className="mt-2 px-0">
  <div className="px-4 mb-5">
    <h2 className="text-2xl font-black">
      {t.discover_products || "Discover Products"}
    </h2>
    <p className="mt-1 text-sm text-gray-500">
      {t.curated_products_for_you || "Curated products for you"}
    </p>
  </div>

  {loading ? (
    <div className="grid grid-cols-2 gap-[3px] px-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-[6px] px-1">
      {filteredProducts.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={handleAddToCart}
          t={t}
        />
      ))}
    </div>
  )}
</section>
    </main>
  );
                  }
