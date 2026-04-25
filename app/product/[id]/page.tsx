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

/* ================= TYPES ================= */

type Variant = {
  id: string;
  optionValue: string;
  price: number;
  salePrice?: number | null;
  finalPrice: number;
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

/* ================= PAGE ================= */

export default function ProductDetail() {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id ?? "");
  const { product, isLoading } = useProduct(id);

  /* ================= DEBUG ================= */
  if (process.env.NODE_ENV === "development") {
    console.log("[PRODUCT PAGE]", product);
  }

  /* ================= ZOOM ================= */

  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [initialDistance, setInitialDistance] = useState(0);
  const [initialScale, setInitialScale] = useState(1);

  const lastTap = useRef(0);

  const handleDoubleTap = () => {
    const now = Date.now();

    if (now - lastTap.current < 300) {
      setScale((prev) => (prev === 1 ? 2 : 1));
      setPosition({ x: 0, y: 0 });
    }

    lastTap.current = now;
  };

  /* ================= STATE ================= */

  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [products, setProducts] = useState<RelatedProduct[]>([]);
  const [openCheckout, setOpenCheckout] = useState(false);

  /* ================= DEFAULT VARIANT ================= */

  useEffect(() => {
    if (!product) return;

    const first =
      product.variants?.find(
        (v: Variant) => (v.isActive ?? true) && v.stock > 0
      ) ?? null;

    setSelectedVariant(first);
  }, [product]);

  /* ================= LOAD RELATED ================= */

  useEffect(() => {
    async function loadProducts() {
      if (!product?.categoryId) return;

      try {
        const res = await apiAuthFetch(
          `/api/products?categoryId=${product.categoryId}`
        );

        if (!res.ok) return;

        const data = await res.json();
        if (!Array.isArray(data)) return;

        const normalized: RelatedProduct[] = data.map((p: any) => ({
  id: p.id,
  categoryId: p.categoryId,
  name: p.name,
  thumbnail: p.thumbnail,
  price: p.price,
  salePrice: p.salePrice ?? null,
  finalPrice: p.finalPrice,
  isSale: p.isSale,
}));

        setProducts(normalized);
      } catch (err) {
        console.error("[RELATED PRODUCTS ERROR]", err);
      }
    }

    loadProducts();
  }, [product?.categoryId]);

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
if (!product || typeof product !== "object") {
  return null;
}
  /* ================= LOGIC ================= */

  const hasVariants = (product?.variants?.length ?? 0) > 0;

  const availableVariants = product.variants?.filter(
  (v: Variant) => (v.isActive ?? true) && (v.optionValue || v.option1 || v.option2)
  ) ?? [];

  const selectedStock = hasVariants
  ? selectedVariant?.stock ?? 0
  : product.stock ?? 0;

  const canBuy = hasVariants
  ? !!selectedVariant && selectedStock > 0
  : (product.stock ?? 0) > 0;

  const relatedProducts = products
    .filter(
      (p) =>
        p.id !== product.id &&
        p.categoryId === product.categoryId
    )
    .slice(0, 10);

  /* ================= ACTIONS ================= */

  const requireVariant = () => {
    if (hasVariants && !selectedVariant) {
      alert(t.select_variant ?? "Please select option");
      return false;
    }
    return true;
  };

  const add = () => {
    if (!requireVariant()) return;
    if (!canBuy) return;

    addToCart({
  id: product.id,
  product_id: product.id,
  variant_id: selectedVariant?.id ?? null,
  name:
    hasVariants && selectedVariant
      ? `${product.name} - ${selectedVariant.optionValue}`
      : product.name,
  price: selectedVariant?.price ?? product.price,
  final_price:
    selectedVariant?.finalPrice ?? product.finalPrice,
  thumbnail: product.thumbnail,
  quantity: 1,
});

    router.push("/cart");
  };

  const buy = () => {
    if (!requireVariant()) return;
    if (!canBuy) return;

    addToCart({
      id: product.id,
      product_id: product.id,
      variant_id: selectedVariant?.id ?? null,
      name:
        hasVariants && selectedVariant
          ? `${product.name} - ${selectedVariant.optionValue}`
          : product.name,
      price: selectedVariant?.price ?? product.price,
      final_price:
      selectedVariant?.finalPrice ?? product.finalPrice,
      thumbnail: product.thumbnail,
      quantity: 1,
    });

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
        selectedStock={selectedStock}
        relatedProducts={relatedProducts}

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
        handleDoubleTap={handleDoubleTap}
      />

      <CheckoutSheet
        open={openCheckout}
        onClose={() => setOpenCheckout(false)}
        product={{
          id: product.id,
          selectedVariant,
          name:
            hasVariants && selectedVariant
              ? `${product.name} - ${selectedVariant.optionValue}`
              : product.name,
          price: product.price,
          salePrice: product.salePrice,
          finalPrice: product.finalPrice,
          thumbnail: product.thumbnail,
          stock: selectedStock,
          shippingRates: product.shippingRates,
          variant_id: selectedVariant?.id ?? null,
        }}
      />
    </>
  );
}
