// components/product/useProductForm.ts

import { useState, useEffect } from "react";
import { ProductPayload, ProductVariant } from "./types";

export function useProductForm(initialData?: ProductPayload) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [saleStart, setSaleStart] = useState("");
  const [saleEnd, setSaleEnd] = useState("");
  const [stock, setStock] = useState<number | "">(1);
  const [isActive, setIsActive] = useState(true);
  const [detail, setDetail] = useState("");
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [shippingRates, setShippingRates] = useState<Record<string, number | "">>({
    domestic: "",
    sea: "",
    asia: "",
    europe: "",
    north_america: "",
    rest_of_world: "",
  });

  useEffect(() => {
    if (!initialData) return;

    setName(initialData.name || "");
    setPrice(initialData.price ?? "");
    setCategoryId(initialData.categoryId || "");
    setDescription(initialData.description || "");
    setImages(initialData.images || []);
    setSalePrice(initialData.salePrice ?? "");
    setStock(initialData.stock ?? 1);
    setIsActive(initialData.is_active ?? true);
    setDetail(initialData.detail || "");
    setVariants(initialData.variants || []);
  }, [initialData]);

  return {
    name, setName,
    price, setPrice,
    categoryId, setCategoryId,
    description, setDescription,
    images, setImages,
    salePrice, setSalePrice,
    saleStart, setSaleStart,
    saleEnd, setSaleEnd,
    stock, setStock,
    isActive, setIsActive,
    detail, setDetail,
    variants, setVariants,
    shippingRates, setShippingRates,
  };
}
