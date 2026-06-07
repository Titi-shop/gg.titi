"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useCart } from "@/app/context/CartContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

import { useProduct } from "./product.logic";
import { ProductView } from "./product.components";
import CheckoutSheet from "./CheckoutSheet";

import type {
  ProductRecord,
  ProductVariant,
} from "@/types/Product";

/* =========================================================
   PAGE
========================================================= */

export default function ProductDetail() {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const router = useRouter();
  const params = useParams();

  const id = String(params?.id ?? "");
  const { product, isLoading } = useProduct(id);

  /* ================= STATE ================= */

  const [selectedVariant, setSelectedVariant] =
    useState<ProductVariant | null>(null);

  const [related, setRelated] = useState<ProductRecord[]>([]);
  const [openCheckout, setOpenCheckout] = useState(false);
const [zoomImage, setZoomImage] =
  useState<string | null>(null);

const [scale, setScale] =
  useState(1);

const [position, setPosition] =
  useState({
    x: 0,
    y: 0,
  });

const [dragging, setDragging] =
  useState(false);

const [start, setStart] =
  useState({
    x: 0,
    y: 0,
  });

const [initialDistance, setInitialDistance] =
  useState(0);

const [initialScale, setInitialScale] =
  useState(1);
  /* ================= DEFAULT VARIANT ================= */

  useEffect(() => {
    if (!product) return;

    const first =
      product.variants?.find(
        (v) => (v.is_active ?? true) && v.stock > 0
      ) ?? null;

    setSelectedVariant(first);
  }, [product]);

  /* ================= RELATED PRODUCTS ================= */

  useEffect(() => {
    const load = async () => {
      if (!product?.category_id) return;

      try {
        const res = await apiAuthFetch(
          `/api/products?category_id=${product.category_id}`
        );

        if (!res.ok) return;

        const data: ProductRecord[] = await res.json();

       const filtered = data
  .filter((p) => p.id !== product.id)
  .slice(0, 10);

setRelated(filtered);

console.log(
  "[RELATED PRODUCTS]",
  filtered.map((p) => ({
    name: p.name,
    has_variants: p.has_variants,
    price: p.price,
    sale_price: p.sale_price,
    final_price: p.final_price,
    variants: p.variants?.length,
  }))
);
      } catch (err) {
        console.error("[RELATED ERROR]", err);
      }
    };

    load();
  }, [product?.category_id]);

  /* ================= GUARD ================= */

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-400">
        {t.loading ?? "Loading..."}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-4 text-center text-gray-500">
        {t.product_not_found ?? "Product not found"}
      </div>
    );
  }

  /* ================= LOGIC ================= */

  const hasVariants = product.has_variants;

  const availableVariants =
    product.variants?.filter(
      (v) => (v.is_active ?? true) && v.option1
    ) ?? [];

  const stock = hasVariants
    ? selectedVariant?.stock ?? 0
    : product.stock;

  const canBuy = hasVariants
    ? !!selectedVariant && stock > 0
    : product.stock > 0;

  /* ================= ACTION ================= */

  const requireVariant = () => {
    if (hasVariants && !selectedVariant) {
      alert(t.select_variant ?? "Please select variant");
      return false;
    }
    return true;
  };

  const buildCartItem = () => ({
    id: product.id,
    product_id: product.id,
    variant_id: selectedVariant?.id ?? null,

    name:
      hasVariants && selectedVariant
        ? `${product.name} - ${selectedVariant.option1}`
        : product.name,

    price: selectedVariant?.price ?? product.price,
    final_price:
      selectedVariant?.final_price ?? product.final_price,

    thumbnail: product.thumbnail,
    quantity: 1,
  });

  const add = () => {
    if (!requireVariant()) return;
    if (!canBuy) return;

    addToCart(buildCartItem());
    router.push("/cart");
  };

  const buy = () => {
    if (!requireVariant()) return;
    if (!canBuy) return;

    addToCart(buildCartItem());
    setOpenCheckout(true);
  };

  /* ================= RENDER ================= */

  return (
    <>
      <ProductView
        product={product}
        t={t}
        router={router}
        add={add}
        buy={buy}
        selectedVariant={selectedVariant}
        setSelectedVariant={setSelectedVariant}
        availableVariants={availableVariants}
        hasVariants={hasVariants}
        canBuy={canBuy}
        selectedStock={stock}
        relatedProducts={related}
         zoomImage={zoomImage}
setZoomImage={setZoomImage}
scale={scale}
setScale={setScale}
position={position}
setPosition={setPosition}
dragging={dragging}
setDragging={setDragging}
start={start}
setStart={setStart}
initialDistance={initialDistance}
setInitialDistance={setInitialDistance}

initialScale={initialScale}
setInitialScale={setInitialScale}
      />

<CheckoutSheet
  open={openCheckout}
  onClose={() => setOpenCheckout(false)}
  product={{
    id: product.id,
    selectedVariant,

    name:
      hasVariants && selectedVariant
        ? `${product.name} - ${selectedVariant.option1}`
        : product.name,

    price: product.price,
    sale_price: product.sale_price,
    final_price: product.final_price,
    thumbnail: product.thumbnail,
    stock,
    shipping_rates: product.shipping_rates,
    variant_id: selectedVariant?.id ?? null,
  }}
/>
    </>
  );
}
