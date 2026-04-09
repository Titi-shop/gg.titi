
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import BannerCarousel from "./components/BannerCarousel";
import PiPriceWidget from "./components/PiPriceWidget";
import { useCart } from "@/app/context/CartContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";
import useSWR from "swr";

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("FETCH_FAILED");
  }
  return res.json() as Promise<T>;
};

/* ================= TYPES ================= */

interface ProductVariant {
  id: string;
  name: string;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  finalPrice: number;
  thumbnail?: string;

  isActive?: boolean;
  stock?: number;
  variants?: ProductVariant[];

  categoryId: string | null;
  sold: number;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
}

/* ================= HELPERS ================= */

function getMainImage(product: Product) {
  if (product.thumbnail && product.thumbnail.trim().startsWith("http")) {
    return product.thumbnail;
  }
  return "/placeholder.png";
}
function isProductOnSale(p: Product) {
  return p.finalPrice < p.price;
}
/* ================= PRODUCT CARD ================= */

function ProductCard({
  product,
  onAddToCart,
  t,
}: {
  product: Product;
  onAddToCart: (product: Product) => void;
  t: Record<string, string>;
}) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
const isSale = isProductOnSale(product);
  const discount =
    product.price > 0
      ? Math.round(
          ((product.price - (product.finalPrice ?? product.price)) / product.price) * 100
        )
      : 0;

  return (
    <div
      onClick={() => router.push(`/product/${product.id}`)}
    className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-transform ${
  product.stock === 0
    ? "opacity-50 pointer-events-none"
    : "cursor-pointer active:scale-[0.97]"
}`}
    >
      <div className="relative">
        <Image
          src={getMainImage(product)}
          alt={product.name}
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
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
            setAdded(true);
            setTimeout(() => setAdded(false), 600);
          }}
          className={`absolute top-2 right-2 p-2 rounded-full shadow transition-all ${
            added ? "bg-green-500 text-white scale-110" : "bg-white"
          }`}
          aria-label={t.add_to_cart || "Add to cart"}
        >
          <ShoppingCart size={16} />
        </button>
      </div>

      <div className="p-3">
        <p className="text-sm line-clamp-2 min-h-[40px]">{product.name}</p>

        <p className="text-orange-500 font-bold mt-1 text-[15px]">
          {formatPi(product.finalPrice ?? product.price)} π
        </p>

        {isSale && (
          <p className="text-xs text-gray-400 line-through">
            {formatPi(product.price)} π
          </p>
        )}

        <div className="mt-2 bg-pink-100 text-pink-600 text-xs text-center rounded-full py-1">
          {(t.sold || "Sold")} {product.sold ?? 0}
        </div>
      </div>
    </div>
  );
}

/* ================= PAGE ================= */

export default function HomePage() {
  const router = useRouter();
  const { addToCart } = useCart();
  const { t } = useTranslation();
  const {
  data: productsData,
  isLoading: loadingProducts,
} = useSWR<Product[]>("/api/products", fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 5000,
});

const {
  data: categoriesData,
  isLoading: loadingCategories,
} = useSWR<Category[]>("/api/categories", fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 10000,
});
const [fallbackProducts, setFallbackProducts] = useState<Product[]>([]);
const products = useMemo(() => {
  return productsData ?? fallbackProducts;
}, [productsData, fallbackProducts]);

const categories = useMemo(() => {
  if (!categoriesData) return [];
  return categoriesData;
}, [categoriesData]);
  const loading = loadingProducts || loadingCategories;
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const [sortType, setSortType] = useState("sale");
  const [timeLeft, setTimeLeft] = useState("");
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

  // ✅ có variant → chuyển trang luôn
  if (product.variants?.length) {
    router.push(`/product/${product.id}`);
    return;
  }

  if (product.stock !== undefined && product.stock <= 0) {
    showMessage(t.out_of_stock || "Out of stock");
    return;
  }

  addToCart({
    id: product.id,
    name: product.name,
    price: product.price,
    sale_price: product.finalPrice,
    quantity: 1,
    thumbnail: product.thumbnail,
  });

  showMessage(t.added_to_cart || "Added to cart", "success");
};
  /* ===== COUNTDOWN ===== */
  useEffect(() => {
    const target = new Date();
    target.setHours(target.getHours() + 2);

    const interval = setInterval(() => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const h = Math.floor(diff / 1000 / 60 / 60);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);

      setTimeLeft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
  if (!productsData) {
    const cached = localStorage.getItem("products");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setFallbackProducts(parsed);
        }
      } catch {}
    }
  }
}, [productsData]);
useEffect(() => {
  if (categoriesData) {
    localStorage.setItem("categories", JSON.stringify(categoriesData));
  }
}, [categoriesData]);
  useEffect(() => {
  if (productsData) {
    localStorage.setItem("products", JSON.stringify(productsData));
  }
}, [productsData]);
  /* ===== FILTER ===== */
  
  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (selectedCategory !== "all") {
      list = list.filter((p) => p.categoryId === selectedCategory);
    }

    if (sortType === "sold") {
      list.sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0));
    } list.sort((a, b) => {
  const discountA = a.price - a.finalPrice;
  const discountB = b.price - b.finalPrice;

  return discountB - discountA;
});

    return list;
  }, [products, selectedCategory, sortType]);

  // CHỈ loading nếu KHÔNG có data
if (loading && products.length === 0) {
  return (
    <p className="text-center mt-10">
      {t.loading_products || "Loading products..."}
    </p>
  );
}

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
      <BannerCarousel />

      {/* PI PRICE + FLASH SALE */}
      <div className="my-4 px-3 space-y-3">
        <div className="flex justify-center">
          <PiPriceWidget />
        </div>

        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-3 text-white">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="font-bold text-sm">
                🔥 {t.flash_sale || "Flash Sale"}
              </p>
              <p className="text-xs opacity-90">
                {t.ends_in || "Ends in"}
              </p>
            </div>

            <div className="bg-white text-red-600 font-bold px-3 py-1 rounded-lg text-sm tracking-wider">
              {timeLeft}
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto">
          {products
           ?.filter((p) => isProductOnSale(p))
             .slice(0, 10)
              .map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/product/${p.id}`)}
                  className="min-w-[140px] bg-white rounded-lg overflow-hidden text-black cursor-pointer"
                >
                  <div className="relative">
                    <Image
                      src={getMainImage(p)}
                      alt={p.name}
                      width={200}
                      height={200}
                      className="w-full h-28 object-cover"
                    />

                    <div className="absolute top-1 left-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {t.flash_sale || "Sale"}
                    </div>

                    <button
                      onClick={(e) => {
                   e.preventDefault();
                 e.stopPropagation();
                 handleAddToCart(p);
                  }}
                      
                      className="absolute top-1 right-1 bg-white p-1.5 rounded-full shadow active:scale-95"
                      aria-label={t.add_to_cart || "Add to cart"}
                    >
                      <ShoppingCart size={14} />
                    </button>
                  </div>

                  <div className="p-2">
                    <p className="text-xs line-clamp-2 min-h-[32px]">{p.name}</p>

                    <p className="text-orange-500 font-bold text-sm mt-1">
                      {formatPi(p.finalPrice ?? p.price)} π
                    </p>

                    <p className="text-[10px] text-gray-400 line-through">
                      {formatPi(p.price)} π
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* SORT MENU */}
      <div className="flex gap-3 overflow-x-auto px-3 py-3 bg-white text-sm">
        {[
          { key: "sold", label: t.best_seller || "Best Seller" },
          { key: "sale", label: t.flash_sale || "Flash Sale" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setSortType(item.key)}
            className={`px-4 py-1 rounded-full whitespace-nowrap ${
              sortType === item.key ? "bg-orange-600 text-white" : "bg-gray-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* PRODUCT GRID */}
      <div className="px-3 mt-4">
        <section className="grid grid-cols-2 gap-3">
          {filteredProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              t={t}
            onAddToCart={handleAddToCart}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
