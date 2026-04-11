"use client";

import { formatPi } from "@/lib/pi";
import { ShoppingCart, Star } from "lucide-react";
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
  selectedVariant,
  setSelectedVariant,
  availableVariants,
  hasVariants,
  canBuy,
  selectedStock,
  relatedProducts,
}: any) {

  const displayImages = [
    ...(product.thumbnail ? [product.thumbnail] : []),
    ...product.images.filter((img: string) => img && img !== product.thumbnail),
  ];

  const gallery =
    displayImages.length > 0 ? displayImages : ["/placeholder.png"];

  return (
    <div className="pb-32 bg-gray-50 min-h-screen">

      {/* ===== IMAGE ===== */}
      <div className="mt-14 relative bg-white">
        {product.isSale && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs px-2 py-1 rounded">
            -{calcSalePercent(product.price, product.finalPrice)}%
          </div>
        )}

        <Swiper modules={[Pagination]} pagination={{ clickable: true }}>
          {gallery.map((img: string, i: number) => (
            <SwiperSlide key={i}>
              <img
                src={img}
                className="w-full aspect-square object-cover"
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* ===== INFO ===== */}
      <div className="bg-white p-4 flex justify-between">
        <h2 className="text-lg">{product.name}</h2>

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

      {/* ===== STOCK + VARIANT ===== */}
      <div className="bg-white px-4 pb-4 text-sm">
        {hasVariants ? (
          <>
            <div className="mb-2">
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

            <div className="flex flex-wrap gap-2">
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
                    className={`px-3 py-2 border rounded ${
                      isDisabled
                        ? "bg-gray-100 text-gray-400"
                        : isSelected
                        ? "border-orange-500 bg-orange-50 text-orange-600"
                        : "border-gray-300"
                    }`}
                  >
                    <div>{v.optionValue}</div>
                    <div className="text-xs">
                      {v.stock > 0
                        ? `${t.in_stock} ${v.stock}`
                        : t.out_of_stock_short}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <span className="text-green-600">
            ✅ {t.in_stock} {product.stock}
          </span>
        )}
      </div>

      {/* ===== DESCRIPTION ===== */}
      <div className="bg-white p-4">
        {formatShortDescription(product.description).map((line, i) => (
          <p key={i}>• {line}</p>
        ))}
      </div>

      {/* ===== DETAIL ===== */}
      <div
        className="bg-white p-4"
        dangerouslySetInnerHTML={{
          __html: formatDetail(product.detail || ""),
        }}
      />

      {/* ===== RELATED ===== */}
      {relatedProducts.length > 0 && (
        <div className="bg-white p-4">
          <h3 className="mb-2">🔗 Related</h3>

          <div className="flex gap-3 overflow-x-auto">
            {relatedProducts.map((p: any) => (
              <div
                key={p.id}
                onClick={() => router.push(`/product/${p.id}`)}
                className="min-w-[140px]"
              >
                <img src={p.thumbnail} className="h-24 w-full object-cover" />
                <p className="text-xs">{p.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== ACTION ===== */}
      <div className="fixed bottom-16 left-0 right-0 bg-white p-3 flex gap-2">
        <button
          onClick={add}
          disabled={!canBuy}
          className="flex-1 bg-yellow-500 text-white py-2"
        >
          {t.add_to_cart}
        </button>

        <button
          onClick={buy}
          disabled={!canBuy}
          className="flex-1 bg-red-500 text-white py-2"
        >
          {t.buy_now}
        </button>
      </div>
    </div>
  );
}
