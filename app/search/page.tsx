"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import AppLoading from "@/components/AppLoading";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";

/* =======================================================
   TYPES
======================================================= */

interface Product {
  id: number | string;
  name: string;
  price: number;
  images?: string[];
  description?: string;
  seller?: string;
}

/* =======================================================
   PAGE
======================================================= */

export default function SearchPage() {
  const router = useRouter();
  const { t } = useTranslation();

  /* ================= STATE ================= */

  const [query, setQuery] = useState("");

  const [results, setResults] = useState<Product[]>([]);
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  /* =======================================================
     STORAGE
  ======================================================= */

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const recentRaw = localStorage.getItem("recentSearch");
      const savedRaw = localStorage.getItem("savedProducts");

      if (recentRaw) {
        setRecent(JSON.parse(recentRaw));
      }

      if (savedRaw) {
        setSavedProducts(JSON.parse(savedRaw));
      }
    } catch {
      //
    }
  }, []);

  /* =======================================================
     HELPERS
  ======================================================= */

  const saveRecent = (value: string) => {
    const q = value.trim();

    if (!q) return;

    const updated = [
      q,
      ...recent.filter((item) => item !== q),
    ].slice(0, 8);

    setRecent(updated);

    localStorage.setItem(
      "recentSearch",
      JSON.stringify(updated)
    );
  };

  const saveProducts = (products: Product[]) => {
    const merged = [...products, ...savedProducts].reduce<Product[]>(
      (acc, item) => {
        const exists = acc.some((p) => p.id === item.id);

        if (!exists) {
          acc.push(item);
        }

        return acc;
      },
      []
    );

    setSavedProducts(merged);

    localStorage.setItem(
      "savedProducts",
      JSON.stringify(merged)
    );
  };

  const removeSavedProduct = (id: Product["id"]) => {
    const updated = savedProducts.filter(
      (p) => p.id !== id
    );

    setSavedProducts(updated);

    localStorage.setItem(
      "savedProducts",
      JSON.stringify(updated)
    );
  };

  const clearRecent = () => {
    setRecent([]);
    localStorage.removeItem("recentSearch");
  };

  const openProduct = (id: Product["id"]) => {
    router.push(`/product/${id}`);
  };

  /* =======================================================
     SEARCH
  ======================================================= */

  const handleSearch = async (
    e?: React.FormEvent
  ) => {
    e?.preventDefault();

    const q = query.trim();

    if (!q) return;

    saveRecent(q);

    setLoading(true);

    try {
      const res = await fetch("/api/products", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("FETCH_FAILED");
      }

      const data: Product[] = await res.json();

      const text = q.toLowerCase();

      const filtered = data.filter((p) => {
        return (
          p.name?.toLowerCase().includes(text) ||
          p.description?.toLowerCase().includes(text) ||
          p.seller?.toLowerCase().includes(text)
        );
      });

      setResults(filtered);

      saveProducts(filtered);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     DISPLAY TITLE
  ======================================================= */

  const title = useMemo(() => {
    if (loading) {
      return t.searching ?? "Searching...";
    }

    if (results.length > 0) {
      return t.search_results ?? "Search results";
    }

    if (savedProducts.length > 0) {
      return t.saved_products ?? "Saved products";
    }

    return t.no_results ?? "No results";
  }, [
    loading,
    results.length,
    savedProducts.length,
    t,
  ]);
{/* =======================================================
    LOADING
======================================================= */}

if (loading) {
  return <AppLoading />;
}
  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
      {/* =======================================================
          HEADER
      ======================================================= */}

      <header
        className="
          fixed inset-x-0 top-0 z-50
          border-b border-orange-500/20
          bg-[var(--nav-bg)]
          backdrop-blur
        "
      >
        <div className="flex items-center gap-3 px-3 py-3">
          {/* BACK */}
          <button
            type="button"
            onClick={() => router.back()}
            className="
              flex h-10 w-10 items-center justify-center
              rounded-xl
              border border-orange-500/20
              bg-[var(--card-bg)]
              text-[var(--foreground)]
            "
          >
            <ArrowLeft size={20} />
          </button>

          {/* SEARCH */}
          <form
            onSubmit={handleSearch}
            className="
              flex flex-1 items-center gap-2
              rounded-2xl
              border border-orange-500/20
              bg-[var(--card-bg)]
              px-3
            "
          >
            <Search
              size={18}
              className="text-orange-500"
            />

            <input
              type="text"
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              placeholder={
                t.search_placeholder ??
                "Search products..."
              }
              className="
                h-11 flex-1 bg-transparent
                text-sm outline-none
                placeholder:text-[var(--text-muted)]
              "
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[var(--text-muted)]"
              >
                <XCircle size={18} />
              </button>
            )}
          </form>
        </div>
      </header>

      {/* =======================================================
          BODY
      ======================================================= */}

      <div className="px-4 pb-32 pt-24">
        {/* =======================================================
            RECENT
        ======================================================= */}

        {recent.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {t.recent_searches ??
                  "Recent searches"}
              </h2>

              <button
                type="button"
                onClick={clearRecent}
                className="
                  flex items-center gap-1
                  text-xs text-red-500
                "
              >
                <Trash2 size={14} />

                {t.clear_all ?? "Clear"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {recent.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);

                    setTimeout(() => {
                      void handleSearch();
                    }, 0);
                  }}
                  className="
                    rounded-full
                    border border-orange-500/20
                    bg-[var(--card-bg)]
                    px-3 py-1.5
                    text-xs
                    text-[var(--foreground)]
                  "
                >
                  {item}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* =======================================================
            TITLE
        ======================================================= */}

        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            {title}
          </h2>
        </div>

        {results.length > 0 ? (
          /* =======================================================
              RESULTS
          ======================================================= */
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {results.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() =>
                  openProduct(product.id)
                }
                className="
                  overflow-hidden rounded-2xl
                  border border-orange-500/15
                  bg-[var(--card-bg)]
                  text-left
                  shadow-sm
                  transition-all duration-200
                  hover:-translate-y-1
                "
              >
                <div
                  className="
                    aspect-square overflow-hidden
                    bg-[var(--card-secondary)]
                  "
                >
                  <img
                    src={
                      product.images?.[0] ??
                      "/placeholder.png"
                    }
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="space-y-2 p-3">
                  <p
                    className="
                      line-clamp-2 min-h-[40px]
                      text-sm font-medium
                    "
                  >
                    {product.name}
                  </p>

                  <p
                    className="
                      text-sm font-bold
                      text-orange-500
                    "
                  >
                    π
                    {formatPi(
                      Number(product.price ?? 0)
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : savedProducts.length > 0 ? (
          /* =======================================================
              SAVED PRODUCTS
          ======================================================= */
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {savedProducts.map((product) => (
              <div
                key={product.id}
                className="
                  relative overflow-hidden rounded-2xl
                  border border-orange-500/15
                  bg-[var(--card-bg)]
                  shadow-sm
                "
              >
                {/* REMOVE */}
                <button
                  type="button"
                  onClick={() =>
                    removeSavedProduct(product.id)
                  }
                  className="
                    absolute right-2 top-2 z-10
                    rounded-full
                    bg-black/60 p-1
                    text-white
                  "
                >
                  <XCircle size={16} />
                </button>

                {/* CARD */}
                <button
                  type="button"
                  onClick={() =>
                    openProduct(product.id)
                  }
                  className="w-full text-left"
                >
                  <div
                    className="
                      aspect-square overflow-hidden
                      bg-[var(--card-secondary)]
                    "
                  >
                    <img
                      src={
                        product.images?.[0] ??
                        "/placeholder.png"
                      }
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="space-y-2 p-3">
                    <p
                      className="
                        line-clamp-2 min-h-[40px]
                        text-sm font-medium
                        text-[var(--foreground)]
                      "
                    >
                      {product.name}
                    </p>

                    <p
                      className="
                        text-sm font-bold
                        text-orange-500
                      "
                    >
                      π
                      {formatPi(
                        Number(product.price ?? 0)
                      )}
                    </p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* =======================================================
              EMPTY
          ======================================================= */
          <div
            className="
              flex flex-col items-center justify-center
              rounded-3xl
              border border-dashed border-orange-500/20
              bg-[var(--card-bg)]
              px-6 py-16
              text-center
            "
          >
            <Search
              size={48}
              className="mb-4 text-orange-500/60"
            />

            <p className="text-sm text-[var(--text-muted)]">
              {t.type_to_search ??
                "Type something to search"}
            </p>
          </div>
        )}
      </div>
    </main>
  );
                }
