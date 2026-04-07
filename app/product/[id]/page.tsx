
"use client";
import type { Product, ProductVariant } from "@/types/Product";
import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useCart } from "@/app/context/CartContext";
import { ArrowLeft, ShoppingCart, Star } from "lucide-react";
import CheckoutSheet from "./CheckoutSheet";
import { formatPi } from "@/lib/pi";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";


function formatDetail(text: string) {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
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
function getDistance(touches: TouchList) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
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
  const [loading, setLoading] = useState(true);
  const [openCheckout, setOpenCheckout] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const quantity = 1;
const [zoomImage, setZoomImage] = useState<string | null>(null);
const [scale, setScale] = useState(1);
const [position, setPosition] = useState({ x: 0, y: 0 });
const [dragging, setDragging] = useState(false);
const [start, setStart] = useState({ x: 0, y: 0 });
const [initialDistance, setInitialDistance] = useState(0);
const [initialScale, setInitialScale] = useState(1);

  const lastTapRef = useRef(0);

const handleDoubleTap = () => {
  const now = Date.now();
  if (now - lastTapRef.current < 300) {
    setScale((prev) => (prev === 1 ? 2 : 1));
    setPosition({ x: 0, y: 0 });
  }
  lastTapRef.current = now;
};

  /* =======================
     LOAD PRODUCT
  ======================= */
 useEffect(() => {
  let mounted = true;

  async function loadAll() {
    try {
      if (!id) return;

      setLoading(true);

      const [productRes, listRes] = await Promise.all([
        fetch(`/api/products/${id}`),
        fetch(`/api/products`),
      ]);

      if (!productRes.ok) throw new Error("product fetch fail");
      const productData: unknown = await productRes.json();
      const listData: unknown = await listRes.json();

      if (!mounted) return;

      /* ================= PRODUCT ================= */
      if (productData && typeof productData === "object") {
        const api = productData as Product;

        const finalPrice =
          typeof api.salePrice === "number" &&
          api.salePrice < api.price
            ? api.salePrice
            : api.price;
        const normalized: Product = {
        ...api,
      finalPrice,
       };
        setProduct(normalized);

        const firstVariant =
          (normalized.variants ?? []).find(
            (v) => (v.isActive ?? true) && v.stock > 0
          ) ?? null;

        setSelectedVariant(firstVariant);
      }

      /* ================= RELATED ================= */
      if (Array.isArray(listData)) {
        const normalizedList: Product[] = listData.map((api: Product) => {
          const finalPrice =
            typeof api.finalPrice === "number"
              ? api.finalPrice
              : api.price;

          return {
  ...api,
};
        });

        setProducts(normalizedList);
      }
    } catch (err) {
      console.error("[PRODUCT_PAGE] LOAD ERROR", err);
    } finally {
      if (mounted) setLoading(false);
    }
  }

  loadAll();

  return () => {
    mounted = false;
  };
}, [id]);

  /* =======================
     STATES
  ======================= */
  if (loading) {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="bg-gray-200 h-64 rounded-xl" />
      <div className="h-4 bg-gray-200 w-2/3 rounded" />
      <div className="h-4 bg-gray-200 w-1/2 rounded" />
    </div>
  );
}
if (!product) return <p className="p-4">{t.no_products}</p>;

const gallery = useMemo(() => {
  const displayImages = [
    ...(product.thumbnail ? [product.thumbnail] : []),
    ...product.images.filter((img) => img && img !== product.thumbnail),
  ];

  return displayImages.length > 0
    ? displayImages
    : ["/placeholder.png"];
}, [product.thumbnail, product.images]);

  const relatedProducts = useMemo(() => {
  if (!product) return [];

  return products.filter(
    (p) =>
      p.id !== product.id &&
      p.categoryId &&
      p.categoryId === product.categoryId
  );
}, [products, product]);
  const hasVariants = product.variants.length > 0;
const isSale = product.finalPrice < product.price;
const availableVariants = product.variants.filter(
  (v) => (v.isActive ?? true) && v.optionValue
);

const selectedStock = hasVariants
  ? selectedVariant?.stock ?? 0
  : product.stock;

const isOutOfStock =
  product.stock <= 0 || product.isActive === false;

const canBuy = hasVariants
  ? !!selectedVariant && selectedStock > 0
  : !isOutOfStock;
  /* =======================
     ACTIONS
  ======================= */

  const add = () => {
  if (hasVariants && !selectedVariant) {
    alert("Vui lòng chọn size trước khi thêm vào giỏ hàng");
    return;
  }

  if (!canBuy) return;

  addToCart({
  id: product.id,
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

  setOpenCheckout(true);
};

  /* =======================
     RENDER
  ======================= */
  return (
    <div className="pb-32 bg-gray-50 min-h-screen">
      {/* MAIN IMAGES */}
<div className="mt-14 relative bg-white">

  {/* SALE BADGE */}
  {isSale && (
    <div className="absolute top-3 right-3 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
      -{calcSalePercent(product.price, product.finalPrice)}%
    </div>
  )}

  <Swiper
    modules={[Pagination]}
    pagination={{ clickable: true }}
    spaceBetween={10}
  >
    {gallery.map((img, i) => (
      <SwiperSlide key={i}>
        <img
  src={img}
  alt={product.name}
  onClick={() => {
    setZoomImage(img);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }}
  className="w-full aspect-square object-cover cursor-zoom-in transition active:scale-95"
/>
      </SwiperSlide>
    ))}
  </Swiper>
</div>
{zoomImage && (
  <div
    className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center"
    onClick={() => setZoomImage(null)}
  >
    <img
      src={zoomImage}
      onClick={(e) => e.stopPropagation()}
     onTouchEnd={handleDoubleTap}
      // 👉 PINCH START
      onTouchStart={(e) => {
        if (e.touches.length === 2) {
          const distance = getDistance(e.touches);
          setInitialDistance(distance);
          setInitialScale(scale);
        } else if (e.touches.length === 1) {
          const touch = e.touches[0];
          setDragging(true);
          setStart({
            x: touch.clientX - position.x,
            y: touch.clientY - position.y,
          });
        }
      }}

      // 👉 PINCH MOVE
      onTouchMove={(e) => {
        if (e.touches.length === 2) {
          const distance = getDistance(e.touches);
          const scaleChange = distance / initialDistance;
          let newScale = initialScale * scaleChange;

          newScale = Math.max(1, Math.min(newScale, 6));
          setScale(newScale);
        }

        if (e.touches.length === 1 && dragging) {
          const touch = e.touches[0];
          setPosition({
            x: touch.clientX - start.x,
            y: touch.clientY - start.y,
          });
        }
      }}

      onTouchEnd={() => setDragging(false)}

      style={{
        transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
        transition: "0.1s",
      }}

      className="max-w-full max-h-full object-contain"
    
    />
  </div>
)}
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
  ) : isOutOfStock ? (
    <span className="text-red-500 font-semibold">
      ❌ {t.out_of_stock}
    </span>
  ) : (
    <span className="text-green-600">
      ✅ {t.in_stock} {product.stock} {t.products}
    </span>
  )}
</div>

      {/* DESCRIPTION */}
      <div className="bg-white p-4">
        <h3 className="text-sm font-semibold mb-2">
          {t.product_description ?? "Mô tả sản phẩm"}
        </h3>

        {product.description ? (
  <ul className="text-sm text-gray-700 space-y-1">
    {formatShortDescription(product.description).map((line, i) => (
      <li key={i}>• {line}</li>
    ))}
  </ul>
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
  className="text-sm text-gray-700 leading-relaxed"
  dangerouslySetInnerHTML={{
    __html: formatDetail(product.detail),
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
                className="min-w-[140px] bg-white rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition"
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
  {!canBuy ? "Hết hàng" : t.buy_now}
</button>
      </div>

      {/* CHECKOUT */}
      <CheckoutSheet
  open={openCheckout}
  onClose={() => setOpenCheckout(false)}
  product={{
    id: product.id, 
    variant_id: selectedVariant?.id ?? null, 
    name:
      hasVariants && selectedVariant
        ? `${product.name} - ${selectedVariant.optionValue}`
        : product.name,

    price: product.price,
    finalPrice: product.finalPrice,
    thumbnail: product.thumbnail,
    stock: selectedStock,
    shippingRates: product.shippingRates,
  }}
/>
    </div>
  );
}
