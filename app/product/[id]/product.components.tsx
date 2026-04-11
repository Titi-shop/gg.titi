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
    <div className="pb-32 bg-gray-50 min-h-screen">

      {/* ===== GALLERY ===== */}
      <div className="mt-14 relative bg-white">

        {/* SALE BADGE */}
        {product.isSale && (
          <div className="absolute top-3 right-3 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
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
          {t.buy_now}
        </button>
      </div>
    </div>
  );
}
