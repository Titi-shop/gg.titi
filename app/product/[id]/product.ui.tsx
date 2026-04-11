"use client";

import { formatPi } from "@/lib/pi";
import { calcSalePercent, formatShortDescription, formatDetail } from "./product.logic";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

export function ProductGallery({ product, setZoomImage }: any) {
  const displayImages = [
    ...(product.thumbnail ? [product.thumbnail] : []),
    ...product.images.filter((img: string) => img && img !== product.thumbnail),
  ];

  const gallery =
    displayImages.length > 0 ? displayImages : ["/placeholder.png"];

  return (
    <div className="mt-14 relative bg-white">
      {product.isSale && (
        <div className="absolute top-3 right-3 z-10 bg-red-500 text-white text-xs px-2 py-1 rounded">
          -{calcSalePercent(product.price, product.finalPrice)}%
        </div>
      )}

      <Swiper modules={[Pagination]} pagination={{ clickable: true }}>
        {gallery.map((img: string, i: number) => (
          <SwiperSlide key={i}>
            <img
              src={img}
              onClick={() => setZoomImage(img)}
              className="w-full aspect-square object-cover"
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}

export function ProductInfo({ product }: any) {
  return (
    <div className="bg-white p-4 flex justify-between">
      <h2>{product.name}</h2>

      <div>
        <p className="text-orange-600">
          π {formatPi(product.finalPrice)}
        </p>

        {product.isSale && (
          <p className="line-through text-gray-400">
            π {formatPi(product.price)}
          </p>
        )}
      </div>
    </div>
  );
}

export function ProductDescription({ product, t }: any) {
  return (
    <div className="bg-white p-4">
      {product.description ? (
        <ul>
          {formatShortDescription(product.description).map((line: string, i: number) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
      ) : (
        <p>{t.no_description}</p>
      )}
    </div>
  );
}

export function ProductDetailHTML({ product, t }: any) {
  return (
    <div className="bg-white p-4">
      {product.detail ? (
        <div
          dangerouslySetInnerHTML={{
            __html: formatDetail(product.detail),
          }}
        />
      ) : (
        <p>{t.no_description}</p>
      )}
    </div>
  );
}
