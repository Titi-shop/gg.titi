

"use client";
export const dynamic = "force-dynamic";
import SplashScreen from "./components/SplashScreen";
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
  price: number;
  finalPrice: number;
  salePrice?: number;
  saleEnabled?: boolean;
  saleStock?: number;
  saleSold?: number;
  stock: number;

}

interface Product {
  id: string;
  name: string;
  price: number;
  finalPrice: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  hasVariants?: boolean;
  thumbnail?: string;
  isActive?: boolean;
  stock?: number;
  variants?: ProductVariant[];
  categoryId: string | null;
  sold: number;
  isSale?: boolean;
  saleEnd?: string;
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
  return (p as any).isSale === true;
}
function getVariantDiscount(p: Product) {
  if (!p.hasVariants || !p.variants?.length) return 0;

  // lấy variant giảm mạnh nhất
  let max = 0;

  for (const v of p.variants) {
    if (!v || !("finalPrice" in v)) continue;
    const base = (v as any).price || 0;
    const final = (v as any).finalPrice || base;
    if (base > final && base > 0) {
      const percent = Math.round(((base - final) / base) * 100);
      if (percent > max) max = percent;
    }
  }

  return max;
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

  const isOut = (product.stock ?? 0) <= 0;
  const isLowStock =
    (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 5;

  const isSale = isProductOnSale(product);

  const discount = product.hasVariants
  ? getVariantDiscount(product)
  : product.price > 0
  ? Math.round(
      ((product.price - (product.finalPrice ?? product.price)) /
        product.price) *
        100
        )
       : 0;

  const soldPercent = Math.min(
    ((product.sold ?? 0) / ((product.sold ?? 0) + (product.stock ?? 1))) * 100,
    100
  );
const saleStock = (product as any).saleStock ?? 0;
const saleSold = (product as any).saleSold ?? 0;
const saleLeft = saleStock - saleSold;

const isSaleOut = saleStock > 0 && saleLeft <= 0;
  return (
    <div
      onClick={() => router.push(`/product/${product.id}`)}
      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-200 cursor-pointer active:scale-[0.97] hover:shadow-md ${
        isOut ? "opacity-60" : ""
      }`}
    >
      {/* ================= IMAGE ================= */}
      <div className="relative">
        <Image
          src={getMainImage(product)}
          alt={product.name}
          width={300}
          height={300}
          className="w-full h-44 object-cover"
        />

        {/* ===== BADGE ===== */}
        {isOut ? (
  <div className="absolute top-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
    {t.out_of_stock || "Out of stock"}
  </div>
) : isLowStock ? (
  <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
    {t.low_stock || "Low stock"}
  </div>
) : discount > 0 ? (
  <div className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs px-2 py-1 rounded shadow">
    -{discount}%
  </div>
   ) : null}

        {/* ===== ADD TO CART ===== */}
        <button
          onClick={(e) => {
            e.stopPropagation();

            if (isOut) return;

            onAddToCart(product);
            setAdded(true);
            setTimeout(() => setAdded(false), 600);
          }}
          className={`absolute top-2 right-2 p-2 rounded-full shadow transition-all ${
            isOut
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : added
              ? "bg-green-500 text-white scale-110"
              : "bg-white"
          }`}
          aria-label={t.add_to_cart || "Add to cart"}
        >
          🛒
        </button>
      </div>

      {/* ================= CONTENT ================= */}
      <div className="p-3">
        {/* NAME */}
        <p className="text-sm line-clamp-2 min-h-[40px]">
          {product.name}
        </p>

        {/* ===== PRICE ===== */}
        <p className="text-orange-500 font-bold mt-1 text-[15px]">
          {product.hasVariants
            ? `${formatPi(product.minPrice ?? 0)} - ${formatPi(product.maxPrice ?? 0)} π`
            : `${formatPi(product.finalPrice ?? product.price)} π`}
        </p>

        {/* ORIGINAL PRICE */}
        {!product.hasVariants && isSale && (
          <p className="text-xs text-gray-400 line-through">
            {formatPi(product.price)} π
          </p>
        )}

        {/* ===== FLASH SALE PROGRESS ===== */}
{(product as any).saleStock > 0 && (
  <div className="mt-2">
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-red-500 transition-all duration-500"
        style={{
          width: `${
            (((product as any).saleSold ?? 0) /
              ((product as any).saleStock || 1)) *
            100
          }%`,
        }}
      />
    </div>

    <p className="text-[11px] text-red-500 text-center mt-1">
      🔥 Còn {(product as any).saleLeft}
    </p>
  </div>
)}
        {/* ===== SOLD BAR ===== */}
        <div className="mt-2">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-red-500"
              style={{ width: `${soldPercent}%` }}
            />
          </div>

          <p className="text-[11px] text-gray-500 mt-1 text-center">
            {(t.sold || "Sold")} {product.sold ?? 0}
          </p>
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
  const [showSplash, setShowSplash] = useState(true);
  const {
  data: productsData,
  isLoading: loadingProducts,
} = useSWR<Product[]>("/api/products", fetcher, {
  refreshInterval: 3000, // 🔥 realtime mỗi 3s
  revalidateOnFocus: true,
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

 if (product.hasVariants) {
  router.push(`/product/${product.id}`);
  return;
}

  if (product.stock !== undefined && product.stock <= 0) {
    showMessage(t.out_of_stock || "Out of stock");
    return;
  }

  addToCart({
    id: product.id,
    product_id: product.id,
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
  if (!products || products.length === 0) return;

  const saleProduct = products.find(
  (p: any) => p.isSale && p.saleEnd
     );

  if (!saleProduct) return;

  const target = new Date(
    saleProduct?.saleEnd || Date.now()
  );

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
      `${String(h).padStart(2, "0")}:${String(m).padStart(
        2,
        "0"
      )}:${String(s).padStart(2, "0")}`
    );
  }, 1000);

  return () => clearInterval(interval);
}, [products]);
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

  useEffect(() => {
  const timer = setTimeout(() => {
    setShowSplash(false);
  }, 1200); // 1.2s

  return () => clearTimeout(timer);
}, []);
  /* ===== FILTER ===== */
  
  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (selectedCategory !== "all") {
      list = list.filter((p) => p.categoryId === selectedCategory);
    }

    if (sortType === "sold") {
  list.sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0));
} else if (sortType === "sale") {
  list.sort((a, b) => {
    const discountA = a.hasVariants
  ? (a.maxPrice ?? 0) - (a.minPrice ?? 0)
  : a.price - (a.finalPrice ?? a.price);

    const discountB = b.hasVariants
  ? (b.maxPrice ?? 0) - (b.minPrice ?? 0)
  : b.price - (b.finalPrice ?? b.price);
    return discountB - discountA;
  });
}

    return list;
  }, [products, selectedCategory, sortType]);

  if (showSplash || (loading && products.length === 0)) {
  return <SplashScreen />;
}
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
          {products?.filter((p: any) => p.isSale === true)
           .slice(0, 10)
             .map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/product/${p.id}`)}
                  className="min-w-[140px] bg-white rounded-lg overflow-hidden text-black cursor-pointer"
                >
                  <div className="relative overflow-hidden group">
           <Image
  src={getMainImage(p)}
  alt={p.name}
    width={300}
    height={300}
    className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-110"
             />

                    {p.stock === 0 ? (
               <div className="absolute top-1 left-1 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded">
            {t.out_of_stock || "Out of stock"}
         </div>
        ) : (p.hasVariants
    ? getVariantDiscount(p) > 0
    : isProductOnSale(p)
  ) ? (
        <div className="absolute top-2 left-2 bg-gradient-to-r from-red-600 to-orange-500 text-white text-xs px-2 py-1 rounded shadow font-semibold animate-pulse">
        ⚡ SALE
          </div>
             ) : null}

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
               {p.hasVariants
            ? `${formatPi(p.minPrice ?? 0)} - ${formatPi(p.maxPrice ?? 0)} π`
            : `${formatPi(p.finalPrice ?? p.price)} π`}
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
