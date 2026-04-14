"use client";
import type { Product as DBProduct } from "@/types/Product";
import { Plus, Upload } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";
import { isNowInRange } from "@/lib/utils/time"; // ✅ FIX

/* =========================
   TYPES
========================= */
type SellerProduct = Pick<
  DBProduct,
  | "id"
  | "name"
  | "price"
  | "salePrice"
  | "saleStart"
  | "saleEnd"
  | "thumbnail"
  | "stock"
  | "sold"
  | "ratingAvg"
  | "isActive"
> & {
  min_price?: number;
  min_sale_price?: number | null;
};

interface Message {
  text: string;
  type: "success" | "error" | "";
}

interface ShopProfile {
  shop_name: string | null;
  shop_banner: string | null;
  avatar_url: string | null;
  shop_description: string | null;
  rating: number | null;
  total_reviews: number | null;
  total_sales: number | null;
}

/* =========================
   HELPERS (FIX)
========================= */
function getDisplayPrice(p: SellerProduct) {
  // ✅ ưu tiên variant price
  const basePrice =
    typeof p.min_price === "number" && p.min_price > 0
      ? p.min_price
      : p.price;

  const baseSale =
    typeof p.min_sale_price === "number" && p.min_sale_price > 0
      ? p.min_sale_price
      : p.salePrice;

  const isSale = isNowInRange(p.saleStart, p.saleEnd);

  return {
    price: basePrice,
    salePrice: isSale ? baseSale : null,
  };
}

/* =========================
   PAGE
========================= */
export default function SellerStockPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();

  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const [message, setMessage] = useState<Message>({
    text: "",
    type: "",
  });

  const [shop, setShop] = useState<ShopProfile>({
    shop_name: null,
    shop_banner: null,
    avatar_url: null,
    shop_description: null,
    rating: null,
    total_reviews: null,
    total_sales: null,
  });

  /* ================= LOAD ================= */
  const loadProducts = useCallback(async () => {
    try {
      const res = await apiAuthFetch("/api/seller/products", {
        cache: "no-store",
      });

      if (!res.ok) {
        setMessage({ text: t.load_products_error, type: "error" });
        return;
      }

      const raw: unknown = await res.json();

      if (!Array.isArray(raw)) {
        setProducts([]);
        return;
      }

      const mapped: SellerProduct[] = raw.map((item) => {
        const p = item as Record<string, unknown>;

        return {
          id: String(p.id ?? ""),
          name: String(p.name ?? "Unnamed"),

          price: Number(p.price ?? 0),
          salePrice:
            typeof p.sale_price === "number" ? p.sale_price : null,

          // ✅ FIX DATE
          saleStart:
            typeof p.sale_start === "string" ? p.sale_start : null,
          saleEnd:
            typeof p.sale_end === "string" ? p.sale_end : null,

          // ✅ NEW (variant)
          min_price:
            typeof p.min_price === "number" ? p.min_price : undefined,
          min_sale_price:
            typeof p.min_sale_price === "number"
              ? p.min_sale_price
              : null,

          thumbnail:
            typeof p.thumbnail === "string" ? p.thumbnail : "",

          stock: Number(p.stock ?? 0),
          sold: Number(p.sold ?? 0),
          ratingAvg: Number(p.rating_avg ?? 0),
          isActive: Boolean(p.is_active),
        };
      });

      setProducts(mapped);
    } catch {
      setMessage({ text: t.load_products_error, type: "error" });
    } finally {
      setPageLoading(false);
    }
  }, [t]);

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiAuthFetch("/api/profile", {
        cache: "no-store",
      });

      if (!res.ok) return;

      const data = await res.json();
      const profile = data.profile;

      setShop({
        shop_name: profile?.shop_name ?? null,
        shop_banner: profile?.shop_banner ?? null,
        avatar_url: profile?.avatar_url ?? null,
        shop_description: profile?.shop_description ?? null,
        rating: profile?.rating ?? 0,
        total_reviews: profile?.total_reviews ?? 0,
        total_sales: profile?.total_sales ?? 0,
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!authLoading) {
      loadProducts();
      loadProfile();
    }
  }, [authLoading, loadProducts, loadProfile]);
   /* ================= BANNER ================= */
const handleBannerUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiAuthFetch("/api/uploadShopBanner", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error();
    const data = await res.json();

    setShop((prev) => ({
      ...prev,
      shop_banner: data.banner,
    }));

    setMessage({
      text: "Banner updated",
      type: "success",
    });
  } catch {
    setMessage({
      text: "Upload failed",
      type: "error",
    });
  }
};

  /* ================= DELETE ================= */
  const handleDelete = async (id: string) => {
    if (!confirm(t.confirm_delete)) return;

    try {
      const res = await apiAuthFetch(
        `/api/products?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setMessage({ text: t.delete_success, type: "success" });
      } else {
        setMessage({ text: t.delete_failed, type: "error" });
      }
    } catch {
      setMessage({ text: t.delete_failed, type: "error" });
    }
  };

  /* ================= UI ================= */
  return (
  <main className="p-4 max-w-2xl mx-auto pb-28">

    {/* SHOP HEADER */}
    <div className="mb-10">

      {/* BANNER */}
      <div className="relative w-full h-40 rounded-xl overflow-hidden">
        <Image
          src={shop.shop_banner || "/banners/default-shop.png"}
          alt="Shop banner"
          fill
          priority
          unoptimized
          className="object-cover"
        />

        {/* CHANGE BANNER */}
        <label className="absolute top-3 left-3 bg-black/60 hover:bg-black/70 text-white text-xs px-3 py-1 rounded cursor-pointer flex items-center gap-1">
          <Upload size={14} />
          {t.change_banner}
          <input
            type="file"
            hidden
            accept="image/*"
            onChange={handleBannerUpload}
          />
        </label>

        {/* POST PRODUCT */}
        <button
          onClick={() => router.push("/seller/post")}
          className="absolute top-3 right-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full w-11 h-11 flex items-center justify-center shadow-lg"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* AVATAR */}
      <div className="flex justify-center -mt-12">
        <div className="relative w-24 h-24">
          {shop.avatar_url ? (
            <Image
              src={shop.avatar_url}
              alt="avatar"
              fill
              className="rounded-full border-4 border-white shadow-lg object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-white shadow-lg flex items-center justify-center text-gray-500">
              ?
            </div>
          )}
        </div>
      </div>

      {/* SHOP NAME */}
      <h2 className="text-center font-bold text-xl mt-3">
        {shop.shop_name || t.my_store}
      </h2>

      {/* STATS */}
      <div className="flex justify-center gap-6 text-sm text-gray-600 mt-2">
        <div className="flex items-center gap-1">
          ⭐ <span>{shop.rating ?? 0}</span>
        </div>
        <div className="flex items-center gap-1">
          📦 <span>{products.length}</span>
        </div>
        <div className="flex items-center gap-1">
          🛒 <span>{shop.total_sales ?? 0}</span>
        </div>
      </div>

      {/* MESSAGE */}
      {message.text && (
        <p
          className={`text-center mb-4 ${
            message.type === "success"
              ? "text-green-600"
              : "text-red-600 font-medium"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* EMPTY */}
      {products.length === 0 && (
        <p className="text-center text-gray-400">
          {t.no_products}
        </p>
      )}

      {/* PRODUCT LIST */}
      <div className="space-y-4">
        {products.map((product) => {
    const display = getDisplayPrice(product);
          const now = new Date();

          const start = product.saleStart ? new Date(product.saleStart) : null;
          const end = product.saleEnd ? new Date(product.saleEnd) : null;

          const isSale = isNowInRange(product.saleStart, product.saleEnd);

          const upcoming =
            product.salePrice !== null &&
            start !== null &&
            now < start;

          const ended =
            product.salePrice !== null &&
            end !== null &&
            now > end;

          return (
            <div
              key={product.id}
              onClick={() => router.push(`/product/${product.id}`)}
              className="flex gap-3 p-3 bg-white rounded-xl shadow border hover:bg-gray-50 cursor-pointer"
            >

              {/* IMAGE */}
              <div className="w-24 h-24 relative rounded-lg overflow-hidden flex-shrink-0">

                {isSale && (
                  <span className="absolute top-1 left-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded z-10">
                    SALE
                  </span>
                )}

                {upcoming && (
                  <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded z-10">
                    UPCOMING
                  </span>
                )}

                {ended && (
                  <span className="absolute top-1 left-1 bg-gray-500 text-white text-xs font-bold px-2 py-0.5 rounded z-10">
                    ENDED
                  </span>
                )}

                {product.thumbnail ? (
                  <Image
                    src={product.thumbnail}
                    alt={product.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
                    {t.no_image}
                  </div>
                )}
              </div>

              {/* CONTENT */}
              <div className="flex-1 min-w-0">

                <h3 className="font-semibold text-sm line-clamp-2">
                  {product.name}
                </h3>

                {/* PRICE */}
                <div className="mt-1">
                 {display.salePrice ? (
  <>
    <p className="text-sm text-gray-400 line-through">
      {formatPi(display.price)} π
    </p>
    <p className="text-[#ff6600] font-bold">
      {formatPi(display.salePrice)} π
    </p>
  </>
) : (
  <p className="text-[#ff6600] font-bold">
    {formatPi(display.price)} π
  </p>
)}
                </div>

                {/* SALE TIME (FIX TIMEZONE DISPLAY) */}
                {product.saleStart && (
                  <p className="text-xs text-gray-500">
                    {t.sale_start}:{" "}
                    {new Date(product.saleStart).toLocaleString()}
                  </p>
                )}

                {product.saleEnd && (
                  <p className="text-xs text-gray-500">
                    {t.sale_end}:{" "}
                    {new Date(product.saleEnd).toLocaleString()}
                  </p>
                )}

                {/* ACTIONS */}
                <div className="flex gap-4 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/seller/edit/${product.id}`);
                    }}
                    className="text-green-600 underline"
                  >
                    {t.edit}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(product.id);
                    }}
                    className="text-red-600 underline"
                  >
                    {t.delete}
                  </button>
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
    </main>
  );
}
