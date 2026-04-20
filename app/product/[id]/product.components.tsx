"use client";

import { formatPi } from "@/lib/pi";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import { ShoppingCart } from "lucide-react";
import { prefetchProduct } from "@/lib/prefetch";

import {
  formatShortDescription,
  formatDetail,
  calcSalePercent,
} from "./product.helpers";

import "swiper/css";
import "swiper/css/pagination";

/* ================= TYPES ================= */

type Variant = {
  id: string;
  optionValue: string;
  price: number;
  salePrice?: number | null;
  stock: number;
  isActive?: boolean;
};

type RelatedProduct = {
  id: string;
  name: string;
  thumbnail?: string;
  price: number;
  finalPrice: number;
  isSale: boolean;
};

type Props = {
  product: any;
  t: Record<string, string>;
  router: any;

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

  handleDoubleTap: () => void;

  selectedVariant: Variant | null;
  setSelectedVariant: (v: Variant) => void;

  availableVariants: Variant[];
  canBuy: boolean;
  selectedStock: number;
  hasVariants: boolean;

  relatedProducts: RelatedProduct[];
};

/* ================= COMPONENT ================= */

export function ProductView(props: Props) {
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

  if (!product) return null;

  /* ================= IMAGES ================= */

  const displayImages = [
    ...(product.thumbnail ? [product.thumbnail] : []),
    ...(Array.isArray(product.images)
      ? product.images.filter((img: string) => img !== product.thumbnail)
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
                className="w-full aspect-square object-cover"
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
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx =
                  e.touches[0].clientX - e.touches[1].clientX;
                const dy =
                  e.touches[0].clientY - e.touches[1].clientY;

                setInitialDistance(Math.sqrt(dx * dx + dy * dy));
                setInitialScale(scale);
              }

              if (e.touches.length === 1) {
                const t = e.touches[0];
                setDragging(true);
                setStart({
                  x: t.clientX - position.x,
                  y: t.clientY - position.y,
                });
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2) {
                const dx =
                  e.touches[0].clientX - e.touches[1].clientX;
                const dy =
                  e.touches[0].clientY - e.touches[1].clientY;

                const dist = Math.sqrt(dx * dx + dy * dy);

                let newScale =
                  initialScale * (dist / initialDistance);

                setScale(Math.max(1, Math.min(newScale, 6)));
              }

              if (e.touches.length === 1 && dragging && scale > 1) {
                const t = e.touches[0];

                setPosition({
                  x: t.clientX - start.x,
                  y: t.clientY - start.y,
                });
              }
            }}
            onTouchEnd={() => setDragging(false)}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            }}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {/* ===== INFO ===== */}
      <div className="bg-white p-4 flex justify-between">
        <h2 className="text-lg font-medium">{product.name}</h2>

        <div className="text-right">
          <p className="text-xl font-bold text-primary">
            π{" "}
            {formatPi(
              selectedVariant?.salePrice ??
                selectedVariant?.price ??
                product.finalPrice
            )}
          </p>
        </div>
      </div>

      {/* ===== STOCK ===== */}
      <div className="bg-white px-4 pb-3 text-sm">
        {canBuy ? (
          <span className="text-green-600">
            ✅ {t.in_stock} {selectedStock}
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
              const active = selectedVariant?.id === v.id;

              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(v)}
                  disabled={v.stock <= 0}
                  className={`rounded border px-2 py-2 text-sm ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-300"
                  }`}
                >
                  {v.optionValue}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== ACTION ===== */}
      <div
        className="
          fixed bottom-0 left-0 right-0 z-50
          bg-white border-t p-3 flex gap-2
        "
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <button
          onClick={add}
          className="flex-1 bg-primary text-white py-3 rounded-xl"
        >
          {t.add_to_cart}
        </button>

        <button
          onClick={buy}
          className="flex-1 bg-primary-dark text-white py-3 rounded-xl"
        >
          {t.buy_now}
        </button>
      </div>
    </div>
  );
}
