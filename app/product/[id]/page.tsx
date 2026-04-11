
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useCart } from "@/app/context/CartContext";

import { useProduct } from "./product.logic";
import {
  ProductGallery,
  ProductInfo,
  ProductDescription,
  ProductDetailHTML,
} from "./product.ui";

export default function ProductDetail() {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const router = useRouter();

  const params = useParams();
  const id = String(params?.id ?? "");

  const { product, isLoading } = useProduct(id);

  const [zoomImage, setZoomImage] = useState<string | null>(null);

  if (isLoading) return <div>Loading...</div>;
  if (!product) return <p>{t.no_products}</p>;

  const add = () => {
    addToCart({
      id: product.id,
      product_id: product.id,
      name: product.name,
      price: product.price,
      sale_price: product.finalPrice,
      thumbnail: product.thumbnail,
      quantity: 1,
    });

    router.push("/cart");
  };

  return (
    <div>
      <ProductGallery product={product} setZoomImage={setZoomImage} />
      <ProductInfo product={product} />
      <ProductDescription product={product} t={t} />
      <ProductDetailHTML product={product} t={t} />

      <button onClick={add}>Add to cart</button>
    </div>
  );
}
