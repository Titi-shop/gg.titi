"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import {
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Sparkles,
} from "lucide-react";

import { useCart } from "@/app/context/CartContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import type { Product } from "@/types/product";
import type { Category } from "@/types/category";
import AppLoading from "@/components/AppLoading";
/* =========================================================
   FETCHER
========================================================= */

const fetcher = async <T,>(
  url: string
): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("FETCH_FAILED");
  }

  return res.json() as Promise<T>;
};

/* =========================================================
   HELPERS
========================================================= */

function getImage(src?: string | null) {
  if (!src) return "/placeholder.png";

  return src;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function CategoriesClient() {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  /* =========================================================
     STATE
  ========================================================= */

  const [search, setSearch] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState<number | "all">("all");
  const [sortType, setSortType] =
    useState<
      "popular" | "sale" | "latest"
    >("popular");

  const [message, setMessage] =
    useState<{
      text: string;
      type: "success" | "error";
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
    }
  );

  const products = useMemo(() => {
    return productsData || [];
  }, [productsData]);

  const categories = useMemo(() => {
    return categoriesData || [];
  }, [categoriesData]);

  const loading =
    loadingProducts ||
    loadingCategories;

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredProducts = useMemo(() => {
    let list = [...products];

    /* CATEGORY */

    if (selectedCategory !== "all") {
      list = list.filter(
        (product) =>
          product.category_id ===
          selectedCategory
      );
    }

    /* SEARCH */

    if (search.trim()) {
      list = list.filter((product) =>
        product.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
      );
    }

    /* SORT */

    if (sortType === "popular") {
      list.sort(
        (a, b) => b.sold - a.sold
      );
    }

    if (sortType === "sale") {
      list.sort((a, b) => {
        const discountA =
          a.price -
          (a.final_price ?? a.price);

        const discountB =
          b.price -
          (b.final_price ?? b.price);

        return discountB - discountA;
      });
    }

    if (sortType === "latest") {
      list.reverse();
    }

    return list;
  }, [
    products,
    search,
    selectedCategory,
    sortType,
  ]);

  /* =========================================================
     MESSAGE
  ========================================================= */

  const showMessage = (
    text: string,
    type: "success" | "error" = "error"
  ) => {
    setMessage({ text, type });

    setTimeout(() => {
      setMessage(null);
    }, 2500);
  };

  /* =========================================================
     CART
  ========================================================= */

  const handleAddToCart = (
  e: React.MouseEvent,
  product: Product
) => {
  e.preventDefault();
  e.stopPropagation();

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

    // ❌ KHÔNG redirect
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

 if (loading) {
  return <AppLoading />;
}
  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen pb-28 bg-[var(--background)] text-[var(--foreground)] transition-colors">
      {/* MESSAGE */}

      {message && (
        <div
          className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-2xl ${
            message.type === "error"
              ? "bg-red-500 text-white"
              : "bg-green-500 text-white"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* HEADER */}

      <section
  className="sticky top-0 z-40 px-4 py-4 backdrop-blur-2xl"
  style={{
    background: "color-mix(in srgb, var(--nav-bg) 80%, transparent)",
    borderBottom: `1px solid var(--nav-border)`,
  }}
>
        <div className="flex items-center gap-3">
        <div
  className="flex h-12 flex-1 items-center gap-3 rounded-2xl px-4"
  style={{
    background: "var(--card-secondary)",
  }}
>
            <Search
  size={18}
  style={{
    color: "var(--text-muted)",
  }}
/>

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder={
                t.search_products ||
                "Search products..."
              }
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <button
  className="flex h-12 w-12 items-center justify-center rounded-2xl transition-colors"
  style={{
    backgroundColor: "var(--color-primary)",
    color: "#fff",
  }}
>
            <SlidersHorizontal
              size={18}
            />
          </button>
        </div>
      </section>

      {/* HERO */}

      <section className="px-2 pt-1">
        <div
  className="overflow-hidden rounded-[24px] p-5 text-white"
  style={{
    background: `linear-gradient(
      135deg,
      var(--hero-from),
      var(--hero-via),
      var(--hero-to)
    )`,
  }}
>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold backdrop-blur-xl">
                <Sparkles size={14} />

                {t.smart_catalog ||
                  "Smart Catalog"}
              </div>

              <h1 className="mt-3 text-2xl font-black leading-tight">
                {t.explore_categories ||
                  "Explore Categories"}
              </h1>

              <p className="mt-3 max-w-sm text-sm text-white/70">
                {t.find_products_fast ||
                  "Find products faster with category filters and smart discovery."}
              </p>
            </div>

            <div className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-center backdrop-blur-md">
  <p className="text-lg font-black leading-none">
    {filteredProducts.length}
  </p>

  <p className="mt-1 text-[10px] uppercase tracking-wide text-white/70">
    {t.products || "Products"}
  </p>
</div>
          </div>
        </div>
      </section>

      {/* CATEGORY LIST */}

<section className="-mt-1 overflow-x-auto px-4">       
  <div className="flex gap-2 pb-1">
          <button
            onClick={() =>
              setSelectedCategory(
                "all"
              )
            }
            className={`flex min-w-[82px] flex-col items-center gap-2 rounded-[24px] px-4 py-4 transition-all border-2
${
  selectedCategory === "all"
    ? "border-[var(--color-primary)]"
    : "border-transparent"
}
bg-[var(--card-bg)] text-[var(--foreground)]`}
          >
            <div
  className="flex h-10 w-10 items-center justify-center rounded-lg text-base"
  style={{
    background: "var(--card-secondary)",
  }}
>
  🛍️
</div>

<span className="text-[11px] font-medium">
  {t.all || "All"}
</span>
          </button>

          {categories.map(
            (category) => {
              const active =
                selectedCategory ===
                category.id;

              return (
                <button
                  key={category.id}
                  onClick={() =>
                    setSelectedCategory(
                      category.id
                    )
                  }
                  className={`flex min-w-[68px] flex-col items-center gap-1 rounded-xl px-2 py-2 transition-all border
${
  active
    ? "border-[var(--color-primary)]"
    : "border-transparent"
}
bg-[var(--card-bg)] text-[var(--foreground)]`}
                >
                  <div
  className="flex h-10 w-10 items-center justify-center rounded-lg"
  style={{
    background: "var(--card-secondary)",
  }}
>
  {category.icon?.startsWith("/") ? (
    <Image
      src={category.icon}
      alt={category.key}
      width={40}
      height={40}
      className="h-full w-full object-cover"
    />
  ) : (
    <span className="text-[28px]">
  {category.icon}
</span>
  )}
</div>
                  <span className="line-clamp-1 text-center text-[10px] font-medium leading-tight">
                    {t[
                      category.key
                    ] ||
                      category.key}
                  </span>
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* SORT */}

      <section className="mt-2 overflow-x-auto px-4">
        <div className="flex gap-3">
          {[
            {
              key: "popular",
              label:
                t.best_seller ||
                "Best Seller",
            },

            {
              key: "sale",
              label:
                t.flash_sale ||
                "Flash Sale",
            },

            {
              key: "latest",
              label:
                t.new_arrivals ||
                "New",
            },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() =>
                setSortType(
                  item.key as
                    | "popular"
                    | "sale"
                    | "latest"
                )
              }
              className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-all border-2
${
  sortType === item.key
    ? "border-[var(--color-primary)]"
    : "border-transparent"
}
bg-[var(--card-bg)] text-[var(--foreground)]`}
              
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* PRODUCT GRID */}

      <section className="mt-2 px-0">
        {filteredProducts.length === 0 ? (
          <div
  className="flex h-60 flex-col items-center justify-center rounded-[32px] text-center"
  style={{
    background: "var(--card-bg)",
  }}
>
            <p className="text-lg font-bold">
              🛒
            </p>

            <p
  className="mt-2 text-sm"
  style={{
    color: "var(--text-muted)",
  }}
>
              {t.no_products ||
                "No products"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-[2px]">
            {filteredProducts.map(
              (product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                >
                  <div
  className="
    group
    overflow-hidden
    rounded-xl
    shadow-sm
  "
  style={{
    background: "var(--card-bg)",
    border: "1px solid var(--nav-border)",
  }}
>

                    <div className="relative overflow-hidden">
                      <Image
                        src={getImage(
                          product.thumbnail
                        )}
                        alt={
                          product.name
                        }
                        width={500}
                        height={500}
                      
                       className="   aspect-square  w-full  object-cover "/>

                      {product.sale_price && (
                        <div className="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">
                          SALE
                        </div>
                      )}

                      <button
                        onClick={(e) =>
                          handleAddToCart(
                            e,
                            product
                          )
                        }
                        className="
absolute
bottom-2
right-2
flex
h-9
w-9
items-center
justify-center
rounded-xl
shadow-lg
"
style={{
  background: "var(--card-bg)",
  color: "var(--foreground)",
}}
                      >
                        <ShoppingCart
                          size={18}
                        />
                      </button>
                    </div>

                    <div className="p-2.5">
                      <h3 className="line-clamp-2 min-h-[40px] text-sm font-semibold">
                        {product.name}
                      </h3>

                      <div
  className="mt-3 flex items-center gap-2 text-xs"
  style={{
    color: "var(--text-muted)",
  }}
>
                        <Star
                          size={14}
                          className="fill-yellow-400 text-yellow-400"
                        />

                        {product.rating_avg ||
                          5}

                        <span>
                          •{" "}
                          {
                            product.sold
                          }{" "}
                          {t.sold ||
                            "sold"}
                        </span>
                      </div>

                      <div className="mt-4 flex items-end justify-between">
                        <div>
                        <p
  className="text-lg font-black"
  style={{
    color: "var(--color-primary)",
  }}
>
                   {formatPi(
              product.final_price ||
    product.sale_price ||
         product.price
            )} π
                </p>

                          {product.sale_price &&
                        product.sale_price < product.price && (
                            <p
  className="text-xs line-through"
  style={{
    color: "var(--text-muted)",
  }}
>
                              {formatPi(
                                product.price
                              )}{" "}
                              π
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
}
