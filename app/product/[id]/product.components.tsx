
"use client";

import { useState } from "react";
import { formatPi } from "@/lib/pi";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import { ShoppingCart } from "lucide-react";
import { prefetchProduct } from "@/lib/prefetch";
import type {
  ProductRecord,
  ProductVariantView,
  RelatedProduct,
} from "@/types/Product";
import {
  formatShortDescription,
  formatDetail,
  calcSalePercent,
} from "./product.helpers";

import "swiper/css";
import "swiper/css/pagination";


type ProductViewProps = {
  product: ProductRecord;

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
  selectedVariant: ProductVariantView | null;
  setSelectedVariant: (
  v: ProductVariantView | null
) => void;

availableVariants: ProductVariantView[];
  canBuy: boolean;
  selectedStock: number;
  hasVariants: boolean;

  relatedProducts: RelatedProduct[];
};
export function ProductView(props: ProductViewProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);

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

  console.log("🧪 SALE_BADGE_CHECK", {
    hasVariants,

    productPrice: product?.price,
    productSalePrice: product?.sale_price,
    productFinalPrice: product?.final_price,

    selectedVariant: selectedVariant
      ? {
          id: selectedVariant.id,
          price: selectedVariant.price,
          sale_price: selectedVariant.sale_price,
          final_price: selectedVariant.final_price,
        }
      : null,
  });

  /* ================= SAFE ================= */
  if (!product) return null;
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
    <div className="min-h-screen pb-40 bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
      {/* ===== GALLERY ===== */}
      <div
  className="relative" style={{  backgroundColor: "var(--card-bg)",  }}
>
        {(
  hasVariants
    ? selectedVariant &&
      selectedVariant.sale_enabled &&
      selectedVariant.final_price <
        selectedVariant.price
    : product.sale_enabled &&
      product.final_price <
        product.price
) && (
  <div
    className="absolute top-3 right-3 px-2 py-1 text-xs rounded z-10"
    style={{
      background: "var(--danger)",
      color: "#fff",
    }}
  >
    -
    {hasVariants && selectedVariant
      ? calcSalePercent(
          selectedVariant.price,
          selectedVariant.final_price
        )
      : calcSalePercent(
          product.price,
          product.final_price
        )}
    %
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
                  setActiveImage(img);
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
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
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

onTouchMove={(e) => {
  /* PINCH ZOOM */
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);
   if (!initialDistance) return;

let newScale =
  initialScale *
  (distance / initialDistance);
    newScale = Math.max(1, Math.min(newScale, 6));

    setScale(newScale);
  }

  /* DRAG IMAGE */
  if (e.touches.length === 1 && dragging && scale > 1) {
    const touch = e.touches[0];

    setPosition({
      x: touch.clientX - start.x,
      y: touch.clientY - start.y,
    });
  }
}}
            onTouchEnd={() => {
  setDragging(false);
}}
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

<div
  className="p-4 flex justify-between items-start"
  style={{
    backgroundColor: "var(--card-bg)",
  }}
>
  <h2 className="text-lg font-semibold">
    {product.name}
  </h2>

  <div className="text-right">
  {hasVariants ? (
    selectedVariant ? (
      <>
        <p
          className="text-xl font-black"
          style={{
            color: "var(--color-primary)",
          }}
        >
          π{" "}
          {formatPi(
            selectedVariant.final_price ??
              selectedVariant.sale_price ??
              selectedVariant.price
          )}
        </p>

        {(selectedVariant.sale_price ?? 0) > 0 &&
          selectedVariant.final_price <
            selectedVariant.price && (
            <p
              className="text-sm line-through"
              style={{
                color: "var(--text-muted)",
              }}
            >
              π{" "}
              {formatPi(
                selectedVariant.price
              )}
            </p>
          )}
      </>
    ) : (
      <p
        className="text-xl font-black"
        style={{
          color: "var(--color-primary)",
        }}
      >
        π{" "}
        {formatPi(
          product.final_price ??
            product.sale_price ??
            product.price ??
            0
        )}
      </p>
    )
  ) : (
    <>
      <p
        className="text-xl font-black"
        style={{
          color: "var(--color-primary)",
        }}
      >
        π{" "}
        {formatPi(
          product.final_price ??
            product.sale_price ??
            product.price ??
            0
        )}
      </p>

      {(product.sale_price ?? 0) > 0 &&
        (product.final_price ??
          product.price) <
          product.price && (
          <p
            className="text-sm line-through"
            style={{
              color: "var(--text-muted)",
            }}
          >
            π{" "}
            {formatPi(product.price)}
          </p>
        )}
    </>
  )}
</div>
</div>

      {/* ===== META ===== */}
  
<div
  
  className="px-4 pb-4 flex gap-4 text-sm"
  style={{
    backgroundColor: "var(--card-bg)",
    color: "var(--text-muted)",
  }}
>
  <span>
    👁 {product.views || 0}{" "}
    {t.views}
  </span>

  <span className="flex items-center gap-1">
    <ShoppingCart className="w-4 h-4" />
    {product.sold || 0} {t.orders}
  </span>

  <span className="flex items-center gap-1">
    ⭐{" "}
    {Number(
      product.rating_avg ?? 0
    ).toFixed(1)}

   <span
  style={{
    color: "var(--text-muted)",
  }}
>
      ({product.rating_count ?? 0})
    </span>
  </span>
</div>

      {/* ===== STOCK ===== */}
      <div
  className="px-4 pb-2 text-sm"
  style={{
    backgroundColor: "var(--card-bg)",
  }}
>
  {canBuy ? (
   <span
  style={{
    color: "var(--success)",
  }}
>
      ✅ {t.in_stock}{" "}
      {hasVariants
        ? selectedVariant
          ? selectedVariant.stock
          : product.stock
        : product.stock}
    </span>
  ) : (
    <span
  style={{
    color: "var(--danger)",
  }}
>
      ❌ {t.out_of_stock}
    </span>
  )}
</div>

      {/* ===== VARIANTS ===== */}
     {hasVariants &&
  availableVariants?.length > 0 && (
    <div
      className="px-4 pb-4"
      style={{
        backgroundColor:
          "var(--card-bg)",
      }}
    >
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
       
        {availableVariants.map((v) => {
          const isSelected =
            selectedVariant?.id ===
            v.id;

          const isDisabled =
            v.stock <= 0;
      console.log(
  "🧪 AVAILABLE_VARIANTS",
     availableVariants
      );
          return (
            <button
              key={v.id}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  setSelectedVariant(v);

                  if (v.image ?? null) {
                    setActiveImage(
                      v.image
                    );
                  } else {
                    setActiveImage(
                      null
                    );
                  }
                }
              }}
              className="rounded border px-2 py-2 text-sm transition"
style={{
  background: isDisabled
    ? "var(--surface-2)"
    : isSelected
    ? "rgba(249,115,22,.10)"
    : "var(--card-bg)",

  color: isDisabled
    ? "var(--text-muted)"
    : isSelected
    ? "var(--color-primary)"
    : "var(--foreground)",

  borderColor: isSelected
    ? "var(--color-primary)"
    : "var(--nav-border)",
}}
            >
              <div className="flex flex-col items-center gap-1">
                {v.image && (
                  <img
                    src={v.image}
                    className="w-6 h-6 rounded-full object-cover border"
                  />
                )}

                <span className="text-[11px]">
                  {v.option2 ||
                    v.option1 ||
                    "Option"}
                </span>

                <span
  className="text-[10px]"
  style={{
    color: "var(--text-muted)",
  }}
>
                  {v.stock}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  )}

      {/* ===== DESCRIPTION ===== */}
    <div
  className="p-4"
  style={{
    backgroundColor: "var(--card-bg)",
  }}
>
  {formatShortDescription(
    product.description
  ).map((l, i) => (
    <p key={i}>• {l}</p>
  ))}
</div>

      {/* ===== DETAIL ===== */}
      <div
  className="mt-2 p-4 text-sm"
  style={{
    backgroundColor: "var(--card-bg)",
  }}
  dangerouslySetInnerHTML={{
    __html: formatDetail(
      product.detail || ""
    ),
  }}
/>

      {/* ===== RELATED ===== */}
      {relatedProducts?.length > 0 && (
        <div
  className="mt-2 p-4"
  style={{
    backgroundColor: "var(--card-bg)", }}
>
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

              <p
  className="text-sm font-semibold"
  style={{
    color: "var(--color-primary)",
  }}
>
                  π {formatPi(p.final_price ?? p.price)}
                </p>

                {p.sale_price && p.final_price < p.price && (
                 <p
  className="text-xs line-through"
  style={{
    color: "var(--text-muted)",
  }}
>
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
    border-t
    px-2 pt-1
  "
  style={{
  backgroundColor: "var(--card-bg)",
  borderColor: "var(--nav-border)",
  bottom: "var(--bottom-nav-height, 60px)",
  paddingBottom:
    "calc(env(safe-area-inset-bottom) + 4px)",
}}
>
  <div className="flex gap-2 max-w-4xl mx-auto">
    <button
      onClick={add}
      className="
  flex-1 h-8
  rounded-lg
  text-xs font-medium
  active:scale-95 transition
"
style={{
  background: "var(--color-primary)",
  color: "#fff",
}}
    >
      {t.add_to_cart}
    </button>

    <button
  onClick={() => {
    if (hasVariants && !selectedVariant) return;
    buy();
  }}
  disabled={hasVariants && !selectedVariant}
  className="
    flex-1 h-8
    rounded-lg
    text-xs
    font-semibold
    transition
  "
  style={{
    background:
      hasVariants && !selectedVariant
        ? "var(--surface-3)"
        : "var(--color-primary-dark)",

    color:
      hasVariants && !selectedVariant
        ? "var(--text-muted)"
        : "#fff",
  }}
>
  {t.buy_now}
</button>
  </div>
</div>
    </div> 
  );
}

