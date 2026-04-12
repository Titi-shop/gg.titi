"use client";

import { formatPi } from "@/lib/pi";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

import {
  formatShortDescription,
  formatDetail,
  calcSalePercent,
} from "./product.helpers";

import "swiper/css";
import "swiper/css/pagination";

export function ProductView({
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
  handleDoubleTap,
  selectedVariant,
  setSelectedVariant,
  availableVariants,
  canBuy,
  selectedStock,
  hasVariants,
  relatedProducts,
}: any) {
  const displayImages = [
    ...(product.thumbnail ? [product.thumbnail] : []),
    ...product.images.filter((img: string) => img && img !== product.thumbnail),
  ];

  const gallery =
    displayImages.length > 0 ? displayImages : ["/placeholder.png"];

  return (
    <div className="pb-32 bg-gray-50 min-h- {/* GALLERY */}
      <div className="mt-14 relative bg-white">
        {product.isSale && (
          <div className="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 text-xs rounded">
            -{calcSalePercent(product.price, product.finalPrice)}%
          </div>
        )}

        <Swiper modules={[Pagination]} pagination={{ clickable: true }}>
          {gallery.map((img: string, i: number) => (
            <SwiperSlide key={i}>
              <img
                src={img}
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

      {/* ZOOM */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={handleDoubleTap}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const d = getDistance(e.touches);
                setInitialDistance(d);
                setInitialScale(scale);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2) {
                const d = getDistance(e.touches);
                let newScale = initialScale * (d / initialDistance);
                newScale = Math.max(1, Math.min(newScale, 6));
                setScale(newScale);
              }
            }}
            style={{
              transform: `scale(${scale})`,
            }}
            className="max-w-full max-h-full"
          />
        </div>
      )}

      
      {/* ===== INFO ===== */}
      <div className="bg-white p-4 flex justify-between items-start">
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

       {/* ===== META ===== */}
      <div className="bg-white px-4 pb-4 flex gap-4 text-sm text-gray-600">
        <span>👁 {product.views} {t.views}</span>

        <span className="flex items-center gap-1">
          <ShoppingCart className="w-4 h-4" />
          {product.sold} {t.orders}
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
            {availableVariants.map((v: any) => {
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
                        ? "border-orange-500 bg-orange-50 text-orange-600"
                        : "border-gray-300 bg-white"
                    }
                  `}
                >
                  <div className="font-medium">
                    {v.optionValue}
                  </div>

                  <div className="text-[11px]">
                    {v.stock > 0
                      ? `${v.stock}`
                      : "0"}
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
      {relatedProducts.length > 0 && (
        <div className="bg-white mt-2 p-4">
          <h3 className="text-sm font-semibold mb-3">
            🔗 {t.product_related_products}
          </h3>

          <div className="flex gap-3 overflow-x-auto">
            {relatedProducts.map((p: any) => (
              <div
                key={p.id}
                onClick={() => router.push(`/product/${p.id}`)}
                className="min-w-[140px] cursor-pointer"
              >
                <img
                  src={p.thumbnail || "/placeholder.png"}
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

      {/* ===== ACTION ===== */}
      <div className="fixed bottom-16 left-0 right-0 bg-white p-3 flex gap-2">
        <button onClick={add} className="flex-1 bg-yellow-500 text-white">
          {t.add_to_cart}
        </button>

        <button onClick={buy} className="flex-1 bg-red-500 text-white">
          {t.buy_now}
        </button>
      </div>
    </div>
  );
}
