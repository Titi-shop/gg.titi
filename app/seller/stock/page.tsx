"use client";

import { Plus, Upload } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";

/* =========================
   TYPES
========================= */

interface Product {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  saleStart: string | null;
  saleEnd: string | null;
  thumbnail: string | null;
stock?: number;
sold?: number;
rating_avg?: number;
isActive?: boolean;

}

interface RawProduct {
  id: unknown;
  name: unknown;
  price: unknown;
  sale_price?: unknown;
  sale_start?: unknown;
  sale_end?: unknown;
  thumbnail?: unknown;
}

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
   PAGE
========================= */

export default function SellerStockPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(true);

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

  /* =========================
     LOAD PRODUCTS
  ========================= */

  const loadProducts = useCallback(async () => {
    try {
      const res = await apiAuthFetch("/api/seller/products", {
        cache: "no-store",
      });

      if (!res.ok) {
        setMessage({
          text: t.load_products_error,
          type: "error",
        });
        return;
      }

      const raw: unknown = await res.json();

      if (!Array.isArray(raw)) {
        setProducts([]);
        return;
      }

      const mapped: Product[] = raw.map((item) => {
  const p = item as Record<string, unknown>;

  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? "Unnamed"),
    price: Number(p.price ?? 0),

    salePrice:
      typeof p.sale_price === "number" ? p.sale_price : null,

    saleStart: p.sale_start ?? null,
    saleEnd: p.sale_end ?? null,

    thumbnail: p.thumbnail || null,

    stock: Number(p.stock ?? 0),
    sold: Number(p.sold ?? 0),
    rating_avg: Number(p.rating_avg ?? 0),

    isActive: Boolean(p.is_active),
  };
});

      setProducts(mapped);
    } catch {
      setMessage({
        text: t.load_products_error,
        type: "error",
      });
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

  /* =========================
     DELETE PRODUCT
  ========================= */

  const handleDelete = async (id: string) => {
    const confirmed = confirm(t.confirm_delete);
    if (!confirmed) return;

    try {
      const res = await apiAuthFetch(
        `/api/products?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setProducts((prev) =>
          prev.filter((p) => p.id !== id)
        );

        setMessage({
          text: t.delete_success,
          type: "success",
        });
      } else {
        setMessage({
          text: t.delete_failed,
          type: "error",
        });
      }
    } catch {
      setMessage({
        text: t.delete_failed,
        type: "error",
      });
    }
  };

  /* =========================
     LOADING
  ========================= */

  if (pageLoading || authLoading) {
    return (
      <main className="text-center p-8">
        {t.loading}
      </main>
    );
  }

  /* =========================
     UI
  ========================= */

  return (
    <main className="p-4 max-w-2xl mx-auto pb-28">

      {/* SHOP HEADER */}

      <div className="mb-10">

        <div className="relative">

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
    <label className="absolute top-3 left-3 bg-black/60 text-white text-xs px-3 py-1 rounded cursor-pointer flex items-center gap-1">
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
      className="absolute top-3 right-3 bg-orange-500 text-white rounded-full w-11 h-11 flex items-center justify-center shadow-lg"
    >
      <Plus size={20} />
    </button>
  </div>

  {/* AVATAR (ĐÈ 50%) */}
  <div className="absolute left-4 -bottom-12 w-24 h-24 border-4 border-white rounded-full overflow-hidden bg-white shadow">
    <Image
      src={shop.avatar_url || "/avatar.png"}
      alt="avatar"
      fill
      className="object-cover"
    />
  </div>

</div>

{/* INFO */}
<div className="mt-16 px-1">
  <h2 className="font-bold text-lg">
    {shop.shop_name || t.my_store}
  </h2>

  <p className="text-sm text-gray-500">
    {shop.shop_description || t.no_description || "No description"}
  </p>
</div>

        {/* STATS */}

        <div className="flex justify-center gap-6 text-sm text-gray-600 mt-2">

          <div className="flex items-center gap-1">
            ⭐
            <span>{shop.rating ?? 0}</span>
          </div>

          <div className="flex items-center gap-1">
            📦
            <span>{products.length}</span>
          </div>

          <div className="flex items-center gap-1">
            🛒
            <span>{shop.total_sales ?? 0}</span>
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

        {products.length === 0 && (
          <p className="text-center text-gray-400">
            {t.no_products}
          </p>
        )}

        {/* PRODUCT LIST */}

        <div className="space-y-4">

{products.map((product) => {

  const isOut = (product.stock ?? 0) <= 0;
  const isOff = product.isActive === false;

  const now = new Date();
  const start = product.saleStart ? new Date(product.saleStart) : null;
  const end = product.saleEnd ? new Date(product.saleEnd) : null;

  const isSale =
  product.salePrice !== null &&
  start !== null &&
  end !== null &&
  now >= start &&
  now <= end;

  const upcoming =
  product.salePrice !== null &&
  start !== null &&
  now < start;

const ended =
  product.salePrice !== null &&
  end !== null &&
  now > end;

  // ✅ BADGE (chuẩn nhất)
  const badge:
  | { text: string; className: string }
  | null =
  isOut
    ? { text: t.out_of_stock, className: "badge badge-out" }
    : isOff
    ? { text: t.inactive, className: "badge badge-off" }
    : isSale
    ? { text: "SALE", className: "badge badge-sale" }
    : upcoming
    ? { text: t.upcoming, className: "badge badge-upcoming" }
    : ended
    ? { text: t.ended, className: "badge badge-ended" }
    : null;

  return (
    <div
      key={product.id}
      onClick={() => router.push(`/product/${product.id}`)}
      className="flex gap-3 p-3 bg-white rounded-xl shadow border hover:bg-gray-50 cursor-pointer"
    >

      {/* IMAGE */}
      <div className="w-24 h-24 relative rounded-lg overflow-hidden flex-shrink-0">

        {badge && (
          <span className={`absolute top-1 left-1 z-10 ${badge.className}`}>
            {badge.text}
          </span>
        )}

        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt={product.name}
            fill
            className={`object-cover ${isOut || isOff ? "img-disabled" : ""}`}
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
          {isSale ? (
            <>
              <p className="text-xs text-gray-400 line-through">
                {formatPi(product.price)} π
              </p>
              <p className="text-[#ff6600] font-bold">
                {formatPi(product.salePrice)} π
              </p>
            </>
          ) : (
            <p className="text-[#ff6600] font-bold">
              {formatPi(product.price)} π
            </p>
          )}
        </div>

        {/* TIME */}
        {product.saleStart && (
          <p className="text-xs text-gray-500">
            {t.sale_start}: {new Date(product.saleStart).toLocaleString()}
          </p>
        )}

        {product.saleEnd && (
          <p className="text-xs text-gray-500">
            {t.sale_end}: {new Date(product.saleEnd).toLocaleString()}
          </p>
        )}

        {/* ACTION */}
        <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">
          <span>⭐ {product.rating_avg ?? 0}</span>
          <span>📦 {product.stock ?? 0}</span>
          <span>🛒 {product.sold ?? 0}</span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/seller/edit/${product.id}`);
            }}
            className="text-green-600"
          >
            {t.edit}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(product.id);
            }}
            className="text-red-600"
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
