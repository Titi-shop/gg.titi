"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useCart } from "@/app/context/CartContext";

import { useProduct } from "./product.logic";
import { ProductView } from "./product.components";
import CheckoutSheet from "./CheckoutSheet";

/* ================= PAGE ================= */

export default function ProductDetail() {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const router = useRouter();

  const params = useParams();
  const id = String(params?.id ?? "");

  const { product, isLoading } = useProduct(id);

  /* ================= STATE ================= */

  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [openCheckout, setOpenCheckout] = useState(false);

  /* ================= DEFAULT VARIANT ================= */

  useEffect(() => {
    if (!product) return;

    const first =
      product.variants.find(
        (v: any) => (v.isActive ?? true) && v.stock > 0
      ) ?? null;

    setSelectedVariant(first);
  }, [product]);

  /* ================= LOAD RELATED ================= */

  useEffect(() => {
    async function loadProducts() {
      if (!product?.categoryId) return;

      try {
        const res = await fetch("/api/products");
        const data = await res.json();

        if (!Array.isArray(data)) return;

        const normalized = data.map((p: any) => ({
          ...p,
          finalPrice:
            typeof p.salePrice === "number" &&
            p.salePrice < p.price
              ? p.salePrice
              : p.price,
          isSale:
            typeof p.salePrice === "number" &&
            p.salePrice < p.price,
        }));

        setProducts(normalized);
      } catch (err) {
        console.error("Load related failed:", err);
      }
    }

    loadProducts();
  }, [product]);

  /* ================= GUARD ================= */

  if (isLoading) return <div>Loading...</div>;
  if (!product) return <div>{t.no_products}</div>;

  /* ================= LOGIC ================= */

  const hasVariants = product.variants.length > 0;

  const availableVariants = product.variants.filter(
    (v: any) => (v.isActive ?? true) && v.optionValue
  );

  const selectedStock = hasVariants
    ? selectedVariant?.stock ?? 0
    : product.stock;

  const canBuy = hasVariants
    ? !!selectedVariant && selectedStock > 0
    : !(product.isOutOfStock ?? false);

  const relatedProducts = products.filter(
    (p) =>
      p.id !== product.id &&
      p.categoryId &&
      p.categoryId === product.categoryId
  );

  /* ================= ACTIONS ================= */

  const add = () => {
    if (hasVariants && !selectedVariant) {
      alert("Vui lòng chọn size");
      return;
    }

    if (!canBuy) return;

    addToCart({
      id: product.id,
      product_id: product.id,
      variant_id: selectedVariant?.id ?? null,
      name:
        hasVariants && selectedVariant
          ? `${product.name} - ${selectedVariant.optionValue}`
          : product.name,
      price: product.price,
      sale_price: product.finalPrice,
      thumbnail: product.thumbnail,
      quantity: 1,
    });

    router.push("/cart");
  };

  const buy = () => {
    if (hasVariants && !selectedVariant) {
      alert("Vui lòng chọn size");
      return;
    }

    if (!canBuy) return;

    addToCart({
      id: product.id,
      product_id: product.id,
      variant_id: selectedVariant?.id ?? null,
      name:
        hasVariants && selectedVariant
          ? `${product.name} - ${selectedVariant.optionValue}`
          : product.name,
      price: product.price,
      sale_price: product.finalPrice,
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
      />

      {/* ===== CHECKOUT ===== */}
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
    </>
  );
}
