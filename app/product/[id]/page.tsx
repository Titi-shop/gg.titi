"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useCart } from "@/app/context/CartContext";
import { ArrowLeft, ShoppingCart, Star } from "lucide-react";
import CheckoutSheet from "./CheckoutSheet";
import { formatPi } from "@/lib/pi";

function formatDetail(text: string) {
  return text
    .replace(/\r\n/g, "<br/>")
    .replace(/\n/g, "<br/>") 
    .trim();
}

function formatShortDescription(text?: string) {
  if (!text || typeof text !== "string") return [];

  return text
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function calcSalePercent(price: number, finalPrice: number) {
  if (finalPrice >= price) return 0;
  return Math.round(((price - finalPrice) / price) * 100);
}

/* =======================
   TYPES
======================= */

interface ProductVariant {
  id?: string;
  optionName?: string;
  optionValue: string;
  stock: number;
  sku?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

interface ApiProduct {
  id: string;
  name: string;
  price: number;
  finalPrice?: number;
  description?: string;
  detail?: string;
  views?: number;
  sold?: number;
  rating_avg?: number;
  rating_count?: number;
  thumbnail?: string;
  images?: string[];
  stock?: number;
  isActive?: boolean;
  categoryId?: string | null;
  variants?: ProductVariant[];
  domestic_shipping_fee?: number | null;
  asia_shipping_fee?: number | null;
  international_shipping_fee?: number | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  finalPrice: number;
  isSale: boolean;
  description: string;
  detail: string;
  views: number;
  sold: number;
  ratingAvg: number;
  ratingCount: number;
  thumbnail?: string;
  images: string[];
  stock: number;
  isActive: boolean;
  isOutOfStock: boolean;
  categoryId: string | null;
  variants: ProductVariant[];
  domesticShippingFee?: number | null;
asiaShippingFee?: number | null;
internationalShippingFee?: number | null;
}

/* =======================
   PAGE
======================= */

export default function ProductDetail() {
  const { t } = useTranslation();
  const params = useParams();
  const id = String(params?.id ?? "");
  const router = useRouter();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openCheckout, setOpenCheckout] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<
  "domestic" | "asia" | "international" | null
>(null);
  const quantity = 1;

  /* =======================
     LOAD PRODUCT
  ======================= */
  useEffect(() => {
    async function loadProduct() {
      try {
        const res = await fetch("/api/products");
        const data: unknown = await res.json();

        if (!Array.isArray(data)) return;

        const normalized: Product[] = data.map((p) => {
  const api = p as ApiProduct;

  const finalPrice =
    typeof api.finalPrice === "number"
      ? api.finalPrice
      : api.price;

  const variants: ProductVariant[] = Array.isArray(api.variants)
    ? api.variants
        .filter((v) => v && typeof v === "object")
        .map((v: any) => ({
          id: typeof v.id === "string" ? v.id : undefined,
          optionName:
            typeof v.optionName === "string"
              ? v.optionName
              : typeof v.option_name === "string"
              ? v.option_name
              : "size",
          optionValue:
            typeof v.optionValue === "string"
              ? v.optionValue
              : typeof v.option_value === "string"
              ? v.option_value
              : "",
          stock: typeof v.stock === "number" ? v.stock : 0,
          sku: typeof v.sku === "string" ? v.sku : null,
          sortOrder:
            typeof v.sortOrder === "number"
              ? v.sortOrder
              : typeof v.sort_order === "number"
              ? v.sort_order
              : 0,
          isActive:
            typeof v.isActive === "boolean"
              ? v.isActive
              : typeof v.is_active === "boolean"
              ? v.is_active
              : true,
        }))
        .filter((v) => v.optionValue !== "")
    : [];

  const stock = typeof api.stock === "number" ? api.stock : 0;
  const isActive = api.isActive !== false;

  return {
    id: api.id,
    name: api.name,
    price: api.price,
    finalPrice,
    isSale: finalPrice < api.price,

    description: api.description ?? "",
    detail: api.detail ?? "",

    views: api.views ?? 0,
    sold: api.sold ?? 0,
    ratingAvg:
      typeof api.rating_avg === "number" ? api.rating_avg : 0,
    ratingCount:
      typeof api.rating_count === "number" ? api.rating_count : 0,

    thumbnail: api.thumbnail ?? "",
    images: Array.isArray(api.images) ? api.images : [],
    categoryId: api.categoryId ?? null,

    stock,
    isActive,
    isOutOfStock: stock <= 0 || !isActive,
    variants,
    domesticShippingFee: api.domestic_shipping_fee ?? null,
asiaShippingFee: api.asia_shipping_fee ?? null,
internationalShippingFee: api.international_shipping_fee ?? null,
  };
});
        setProducts(normalized);

        const found = normalized.find((p) => p.id === id);

if (found) {
  setProduct(found);

  const firstAvailableVariant =
    found.variants.find((v) => (v.isActive ?? true) && v.stock > 0) ?? null;

  setSelectedVariant(firstAvailableVariant);
}
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [id]);

  /* =======================
   INCREMENT VIEW
======================= */
  useEffect(() => {
    if (!id) return;

    fetch("/api/products/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch((err) =>
      console.error("View update failed:", err)
    );
  }, [id]);

  /* =======================
     STATES
  ======================= */
  if (loading) return <p className="p-4">{t.loading}</p>;
  if (!product) return <p className="p-4">{t.no_products}</p>;

  const relatedProducts = products.filter(
    (p) =>
      p.id !== product.id &&
      p.categoryId &&
      p.categoryId === product.categoryId
  );

  const displayImages = [
  ...(product.thumbnail ? [product.thumbnail] : []),
  ...product.images.filter((img) => img && img !== product.thumbnail),
];

const gallery =
  displayImages.length > 0 ? displayImages : ["/placeholder.png"];

  const next = () =>
  setCurrentIndex((i) => (i + 1) % gallery.length);

const prev = () =>
  setCurrentIndex((i) =>
    i === 0 ? gallery.length - 1 : i - 1
  );


  const hasVariants = product.variants.length > 0;

const availableVariants = product.variants.filter(
  (v) => (v.isActive ?? true) && v.optionValue
);

const selectedStock = hasVariants
  ? selectedVariant?.stock ?? 0
  : product.stock;
  const shippingFee =
  selectedRegion === "domestic"
    ? product.domesticShippingFee
    : selectedRegion === "asia"
    ? product.asiaShippingFee
    : selectedRegion === "international"
    ? product.internationalShippingFee
    : null;

const canBuy =
  (hasVariants
    ? !!selectedVariant && selectedStock > 0
    : !product.isOutOfStock) &&
  !!selectedRegion;
  /* =======================
     ACTIONS
  ======================= */

  const add = () => {
  if (hasVariants && !selectedVariant) {
    alert("Vui lòng chọn size trước khi thêm vào giỏ hàng");
    return;
  }

    const add = () => {
  if (!selectedRegion) {
    alert("Vui lòng chọn khu vực vận chuyển");
    return;
  }

  if (hasVariants && !selectedVariant) {
    alert("Vui lòng chọn size trước khi thêm vào giỏ hàng");
    return;
  }

  if (!canBuy) return;

  addToCart({
    id:
      hasVariants && selectedVariant?.id
        ? `${product.id}-${selectedVariant.id}`
        : product.id,
    product_id: product.id,
    variant_id: selectedVariant?.id ?? null,
    name:
      hasVariants && selectedVariant
        ? `${product.name} - ${selectedVariant.optionValue}`
        : product.name,
    price: product.price,
    sale_price: product.finalPrice,
    thumbnail: product.thumbnail,
    image: product.thumbnail || product.images?.[0] || "",
    images: product.images,
    quantity,
  });

  router.push("/cart");
};

  const buy = () => {
  if (hasVariants && !selectedVariant) {
    alert("Vui lòng chọn size trước khi mua hàng");
    return;
  }

  if (!canBuy) return;

  addToCart({
    id: hasVariants && selectedVariant?.id
      ? `${product.id}-${selectedVariant.id}`
      : product.id,
    product_id: product.id,
    variant_id: selectedVariant?.id ?? null,
    name: hasVariants && selectedVariant
      ? `${product.name} - ${selectedVariant.optionValue}`
      : product.name,
    price: product.price,
    sale_price: product.finalPrice,
    thumbnail: product.thumbnail,
    image: product.thumbnail || product.images?.[0] || "",
    images: product.images,
    quantity,
  });

  (async () => {
  try {
    const res = await fetch("/api/orders/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: product.id,
        quantity,
        region: selectedRegion,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Preview failed");
      return;
    }

    // 👉 mở checkout sau khi server tính xong
    setOpenCheckout(true);

  } catch {
    alert("Không thể tính đơn hàng");
  }
})();
};

  /* =======================
     RENDER
  ======================= */
  return (
    <div className="pb-32 bg-gray-50 min-h-screen">
      {/* MAIN IMAGES */}
      <div className="mt-14 relative w-full h-80 bg-white">
        <img
  src={gallery[currentIndex]}
  alt={product.name}
  className="w-full h-full object-cover"
/>

        {product.isSale && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
            -{calcSalePercent(product.price, product.finalPrice)}%
          </div>
        )}

        {gallery.length > 1 && (
  <>
    <button
      onClick={prev}
      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white px-2 rounded"
    >
      ‹
    </button>
    <button
      onClick={next}
      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white px-2 rounded"
    >
      ›
    </button>

    <div className="absolute bottom-3 flex gap-2 w-full justify-center">
      {gallery.map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${
            i === currentIndex
              ? "bg-orange-700"
              : "bg-gray-700"
          }`}
        />
      ))}
    </div>
  </>
)}
      </div>

      {/* INFO */}
      <div className="bg-white p-4 flex justify-between">
        <h2 className="text-lg font-medium">
          {product.name}
        </h2>

        <div className="text-right">
          <p className="text-xl font-bold text-orange-600">
            π {formatPi(product.finalPrice)}
          </p>

          {product.isSale && (
            <p className="text-sm text-gray-400 line-through">
              π {formatPi(product.price)}
            </p>
          )}
        </div>
      </div>

      {/* META */}
      <div className="bg-white px-4 pb-4 flex flex-wrap gap-4 text-gray-600 text-sm items-center">
  <span>
    👁 {product.views} {t.views}
  </span>

  <span className="flex items-center gap-1">
    <ShoppingCart className="w-4 h-4" />
    {product.sold} {t.orders}
  </span>

  <span className="flex items-center gap-1">
  ⭐ {product.ratingAvg.toFixed(1)}
  <span className="text-gray-400">
    ({product.ratingCount} {t.reviews})
  </span>
</span>
</div>

      {/* STOCK */}
      <div className="bg-white px-4 pb-4 text-sm">
  {hasVariants ? (
    <div className="space-y-3">
      <div>
        {canBuy ? (
          <span className="text-green-600">
            ✅ {t.in_stock} {selectedStock} {t.products}
          </span>
        ) : (
          <span className="text-red-500 font-semibold">
            ❌ {t.out_of_stock}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {availableVariants.map((variant) => {
          const isSelected = selectedVariant?.id === variant.id;
          const isDisabled = variant.stock <= 0;

          return (
            <button
              key={variant.id ?? variant.optionValue}
              type="button"
              onClick={() => {
                if (isDisabled) return;
                setSelectedVariant(variant);
              }}
              disabled={isDisabled}
              className={`min-w-[52px] rounded-md border px-3 py-2 text-sm transition ${
                isDisabled
                  ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                  : isSelected
                  ? "border-orange-500 bg-orange-50 text-orange-600"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
            >
              <div className="font-medium">{variant.optionValue}</div>
              <div className="text-[11px]">
                {variant.stock > 0
                  ? `${t.in_stock} ${variant.stock}`
                  : t.out_of_stock_short}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  ) : product.isOutOfStock ? (
    <span className="text-red-500 font-semibold">
      ❌ {t.out_of_stock}
    </span>
  ) : (
    <span className="text-green-600">
      ✅ {t.in_stock} {product.stock} {t.products}
    </span>
  )}
</div>
     {/* SHIPPING REGION */}
<div className="bg-white px-4 pb-4">
  <p className="text-sm font-medium mb-2">
    🌍 {t.select_region}
  </p>

  <div className="flex gap-2 flex-wrap">{[
  {
    key: "domestic",
    label: t.region_domestic,
    fee: product.domesticShippingFee,
  },
  {
    key: "asia",
    label: t.region_asia,
    fee: product.asiaShippingFee,
  },
  {
    key: "international",
    label: t.region_international,
    fee: product.internationalShippingFee,
  },
]
  .filter((r) => r.fee !== null && r.fee !== undefined)
  .map((r) => {
    const active = selectedRegion === r.key;

    return (
      <button
        key={r.key}
        onClick={() =>
          setSelectedRegion(
            r.key as "domestic" | "asia" | "international"
          )
        }
        className={`px-3 py-2 rounded border text-sm ${
          active
            ? "bg-orange-100 border-orange-500 text-orange-600"
            : "bg-white border-gray-300"
        }`}
      >
        {r.label} • {formatPi(r.fee || 0)} π
      </button>
    );
  })}  
  </div>

  {!selectedRegion && (
    <p className="text-xs text-red-500 mt-2">
      ⚠️ {t.shipping_required}
    </p>
  )}
</div>

      {/* DESCRIPTION */}
      <div className="bg-white p-4">
        <h3 className="text-sm font-semibold mb-2">
          {t.product_description ?? "Mô tả sản phẩm"}
        </h3>

      {product.description ? (
  <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
    {product.description}
  </div>
) : (
  <p className="text-sm text-gray-400">
    {t.no_description}
  </p>
)}
      </div>

      {/* DETAIL CONTENT */}
<div className="bg-white mt-2 px-4 py-5">
  <h3 className="text-base font-semibold mb-3">
    {t.product_details ?? "Chi tiết sản phẩm"}
  </h3>

  {product.detail ? (
    <div
  className="text-sm text-gray-700 leading-relaxed whitespace-pre-line [&_img]:rounded-lg [&_img]:my-2 [&_img]:w-full"
  dangerouslySetInnerHTML={{
  __html: product.detail,
}}
/>
  ) : (
    <p className="text-sm text-gray-400">
      {t.no_description}
    </p>
  )}
</div>

      {/* RELATED */}
      {relatedProducts.length > 0 && (
        <div className="bg-white mt-2 p-4">
          <h3 className="text-sm font-semibold mb-3">
            🔗 {t.product_related_products ?? "Sản phẩm liên quan"}
          </h3>

          <div className="flex gap-3 overflow-x-auto">
            {relatedProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => router.push(`/product/${p.id}`)}
                className="min-w-[140px] bg-gray-50 rounded-lg p-2"
              >
                <img
                  src={p.thumbnail || p.images[0] || "/placeholder.png"}
                  className="w-full h-24 object-cover rounded"
                />

                <p className="text-xs mt-2 line-clamp-2">
                  {p.name}
                </p>

                <p className="text-sm font-semibold text-orange-600">
                  π {formatPi(p.finalPrice)}
                </p>

                {p.isSale && (
                  <p className="text-xs text-gray-400 line-through">
                    π {formatPi(p.price)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACTIONS */}
      <div className="fixed bottom-16 left-0 right-0 bg-white p-3 shadow flex gap-2 z-50">
        <button
  onClick={add}
  disabled={!canBuy}
  className={`flex-1 py-2 rounded-md text-white ${
    !canBuy ? "bg-gray-400" : "bg-yellow-500"
  }`}
>
  {t.add_to_cart}
</button>

<button
  onClick={buy}
  disabled={!canBuy}
  className={`flex-1 py-2 rounded-md text-white ${
    !canBuy ? "bg-gray-400" : "bg-red-500"
  }`}
>
  {!canBuy ? t.out_of_stock : t.buy_now}
</button>
      </div>

      {/* CHECKOUT */}
      <CheckoutSheet
  open={openCheckout}
  onClose={() => setOpenCheckout(false)}
  product={{
    id:
      hasVariants && selectedVariant?.id
        ? `${product.id}-${selectedVariant.id}`
        : product.id,

    name:
      hasVariants && selectedVariant
        ? `${product.name} - ${selectedVariant.optionValue}`
        : product.name,

    price: product.price,
    finalPrice: product.finalPrice,

    thumbnail: product.thumbnail || "/placeholder.png",

    stock: selectedStock, // ✅ quan trọng nhất
  }}
/>
    </div>
  );
}
