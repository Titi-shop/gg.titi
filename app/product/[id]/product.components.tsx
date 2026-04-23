
"use client";

import { useState } from "react";
import { formatPi } from "@/lib/pi";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import { ShoppingCart } from "lucide-react";
import { prefetchProduct } from "@/lib/prefetch";
import type { Product as ProductType } from "@/types/Product";
import {
  formatShortDescription,
  formatDetail,
  calcSalePercent,
} from "./product.helpers";

import "swiper/css";
import "swiper/css/pagination";
type Variant = {
  id: string;
  optionValue: string;
  price: number;
  salePrice?: number | null;
  finalPrice: number;  
  isSale: boolean;     
  stock: number;
  isActive?: boolean;
};

type RelatedProduct = {
  id: string;
  categoryId: string;
  name: string;
  thumbnail?: string;
  price: number;
  salePrice?: number | null;
  finalPrice: number;
  isSale: boolean;
};

type ProductViewProps = {
  product: ProductType;

  t: Record<string, string>;
  router: {
    push: (path: string) => void;
  };
  add: () => void;
  buy: () => void;
  zoomImage: string | null;
  setZoomImage: (v: string | null) => void;
  scale: number;
  setScale: (v: number) => void;
  position: { x: number; y: number };
  setPosition: (v: { x: number; y: number }) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  start: { x: number; y: number };
  setStart: (v: { x: number; y: number }) => void;
  initialDistance: number;
  setInitialDistance: (v: number) => void;
  initialScale: number;
  setInitialScale: (v: number) => void;
  selectedVariant: Variant | null;
  setSelectedVariant: (v: Variant | null) => void;
  availableVariants: Variant[];
  canBuy: boolean;
  selectedStock: number;
  hasVariants: boolean;

  relatedProducts: RelatedProduct[];
};
export function ProductView(props: ProductViewProps) {
  const {
    product,
    t,
    router,
    add,
    buy,
    zoomImage,
    setZoomImage,
    scale,
    setScale,
    position,
    setPosition,
    dragging,
    setDragging,
    start,
    setStart,
    initialDistance,
    setInitialDistance,
    initialScale,
    setInitialScale,
    selectedVariant,
    setSelectedVariant,
    availableVariants,
    canBuy,
    selectedStock,
    hasVariants,
    relatedProducts,
  } = props;

  /* ================= SAFE ================= */
  if (!product) return null;

  /* ================= DOUBLE TAP FIX ================= */
  const [lastTap, setLastTap] = useState(0);

  /* ================= IMAGES ================= */
  const displayImages = [
    ...(product.thumbnail ? [product.thumbnail] : []),
    ...(Array.isArray(product.images)
      ? product.images.filter((img: string) => img && img !== product.thumbnail)
      : []),
  ];

  const gallery =
    displayImages.length > 0 ? displayImages : ["/placeholder.png"];

  /* ================= UI ================= */

  return (
    <div className="pb-40 bg-gray-50 min-h-screen">
      {/* ===== GALLERY ===== */}
      <div className="relative bg-white">
        {product.isSale && (
          <div className="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 text-xs rounded z-10">
            -{calcSalePercent(product.price, product.finalPrice)}%
          </div>
        )}

        <Swiper modules={[Pagination]} pagination={{ clickable: true }}>
          {gallery.map((img: string, i: number) => (
            <SwiperSlide key={i}>
              <img
                src={img}
                alt={product.name}
                onClick={() => {
                  setZoomImage(img);
                  setScale(1);
                  setPosition({ x: 0, y: 0 });
                }}
                className="w-full aspect-square object-cover block active:scale-95"
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* ===== ZOOM ===== */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            onClick={(e) => e.stopPropagation()}

            /* ===== DOUBLE TAP (FIX) ===== */
            onTouchEnd={() => {
              const now = Date.now();

              if (now - lastTap < 300) {
                setScale((prev: number) => (prev === 1 ? 2 : 1));
                setPosition({ x: 0, y: 0 });
              }

              setLastTap(now);
            }}

            /* ===== TOUCH START ===== */
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx =
                  e.touches[0].clientX - e.touches[1].clientX;
                const dy =
                  e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                setInitialDistance(distance);
                setInitialScale(scale);
              }

              if (e.touches.length === 1) {
                const touch = e.touches[0];
                setDragging(true);
                setStart({
                  x: touch.clientX - position.x,
                  y: touch.clientY - position.y,
                });
              }
            }}

            /* ===== TOUCH MOVE ===== */
            onTouchMove={(e) => {
              /* PINCH */
              if (e.touches.length === 2) {
                const dx =
                  e.touches[0].clientX - e.touches[1].clientX;
                const dy =
                  e.touches[0].clientY - e.touches[1].clientY;

                const distance = Math.sqrt(dx * dx + dy * dy);

                let newScale =
                  initialScale * (distance / initialDistance);

                newScale = Math.max(1, Math.min(newScale, 6));

                setScale(newScale);
              }

              /* DRAG */
              if (e.touches.length === 1 && dragging && scale > 1) {
                const touch = e.touches[0];

                setPosition({
                  x: touch.clientX - start.x,
                  y: touch.clientY - start.y,
                });
              }
            }}

            onTouchEnd={() => setDragging(false)}

            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
              willChange: "transform",
            }}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {/* ===== INFO ===== */}
      <div className="bg-white p-4 flex justify-between items-start">
        <h2 className="text-lg font-medium">{product.name}</h2>

<div className="text-right">
  {hasVariants ? (
    selectedVariant ? (
      <>
        <p className="text-xl font-bold text-primary">
          π {formatPi(selectedVariant.finalPrice)}
        </p>

        {selectedVariant.isSale && (
          <p className="text-sm text-gray-400 line-through">
            π {formatPi(selectedVariant.price)}
          </p>
        )}
      </>
    ) : (
      <p className="text-xl font-bold text-primary">
        {product.minPrice === product.maxPrice
          ? `π ${formatPi(product.minPrice ?? 0)}`
          : `π ${formatPi(product.minPrice ?? 0)} - ${formatPi(product.maxPrice ?? 0)}`}
      </p>
    )
  ) : (
    <>
      <p className="text-xl font-bold text-primary">
        π {formatPi(product.finalPrice ?? product.price)}
      </p>

      {product.finalPrice < product.price && (
        <p className="text-sm text-gray-400 line-through">
          π {formatPi(product.price)}
        </p>
      )}
    </>
  )}
</div>
      </div>

      {/* ===== META ===== */}
      <div className="bg-white px-4 pb-4 flex gap-4 text-sm text-gray-600">
        <span>👁 {product.views || 0} {t.views}</span>

        <span className="flex items-center gap-1">
          <ShoppingCart className="w-4 h-4" />
          {product.sold || 0} {t.orders}
        </span>

        <span className="flex items-center gap-1">
          ⭐ {Number(product.ratingAvg ?? 0).toFixed(1)}
          <span className="text-gray-400">
            ({product.ratingCount ?? 0})
          </span>
        </span>
      </div>

      {/* ===== STOCK ===== */}
      <div className="bg-white px-4 pb-2 text-sm">
        {canBuy ? (
          <span className="text-green-600">
            ✅ {t.in_stock}{" "}
            {hasVariants
              ? selectedVariant
                ? selectedVariant.stock
                : product.stock
              : product.stock}
          </span>
        ) : (
          <span className="text-red-500">
            ❌ {t.out_of_stock}
          </span>
        )}
      </div>

      {/* ===== VARIANTS ===== */}
      {hasVariants && (
        <div className="bg-white px-4 pb-4">
          <div className="grid grid-cols-5 gap-2">
          {availableVariants.map((v) => {
              const isSelected = selectedVariant?.id === v.id;
              const isDisabled = v.stock <= 0;

              return (
                <button
                  key={v.id}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) setSelectedVariant(v);
                  }}
                  className={`rounded border px-2 py-2 text-sm transition
                    ${
                      isDisabled
                        ? "bg-gray-100 text-gray-400"
                        : isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-300 bg-white"
                    }
                  `}
                >
                  <div className="font-medium">
                    {v.optionValue}
                  </div>

                  <div className="text-[11px]">
                    {v.stock}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== DESCRIPTION ===== */}
      <div className="bg-white p-4">
        {formatShortDescription(product.description).map((l, i) => (
          <p key={i}>• {l}</p>
        ))}
      </div>

      {/* ===== DETAIL ===== */}
      <div
        className="bg-white mt-2 p-4 text-sm"
        dangerouslySetInnerHTML={{
          __html: formatDetail(product.detail || ""),
        }}
      />

      {/* ===== RELATED ===== */}
      {relatedProducts?.length > 0 && (
        <div className="bg-white mt-2 p-4">
          <h3 className="text-sm font-semibold mb-3">
            🔗 {t.product_related_products}
          </h3>

          <div className="flex gap-3 overflow-x-auto">
            {relatedProducts.map((p) => (
              <div
                key={p.id}
                onClick={async () => {
                  await prefetchProduct(p.id);
                  router.push(`/product/${p.id}`);
                }}
                onTouchStart={() => prefetchProduct(p.id)}
                className="min-w-[140px] cursor-pointer"
              >
                <img
                  src={p.thumbnail || "/placeholder.png"}
                  className="w-full h-24 object-cover rounded"
                />

                <p className="text-xs mt-2 line-clamp-2">
                  {p.name}
                </p>

                <p className="text-sm font-semibold text-primary">
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

      {/* ===== ACTION (FIX CHE NAV) ===== */}
     <div
  className="
    fixed left-0 right-0 z-50
    bg-white border-t border-gray-200
    px-2 pt-1
  "
  style={{
    bottom: "var(--bottom-nav-height, 60px)",
    paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)",
  }}
>
  <div className="flex gap-2 max-w-4xl mx-auto">
    <button
      onClick={add}
      className="
        flex-1 h-8
        bg-primary text-white
        rounded-lg
        text-xs font-medium
        active:scale-95 transition
      "
    >
      {t.add_to_cart}
    </button>

    <button
      onClick={buy}
      className="
        flex-1 h-8
        bg-primary-dark text-white
        rounded-lg
        text-xs font-semibold
        active:scale-95 transition
      "
    >
      {t.buy_now}
    </button>
  </div>
</div>
    </div> 
  );
}
