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
const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState("");
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const [shippingRates, setShippingRates] = useState<
    Record<string, number | "">
  >({
    domestic: "",
    sea: "",
    asia: "",
    europe: "",
    north_america: "",
    rest_of_world: "",
  });
  function mapShippingRates(rates: any[]) {
  const base = {
    domestic: 0,
    sea: 0,
    asia: 0,
    europe: 0,
    north_america: 0,
    rest_of_world: 0,
  };

  if (!Array.isArray(rates)) return base;

  for (const r of rates) {
    if (!r?.zone) continue;
    base[r.zone] = Number(r.price) || 0;
  }

  return base;
}

  useEffect(() => {
    if (!initialData) return;

    console.log("[FORM] INIT DATA:", initialData);

    setName(initialData.name || "");
    setPrice(initialData.price ?? "");
    setCategoryId(initialData.categoryId || "");
    setDescription(initialData.description || "");
    setImages(initialData.images || []);

    /* 🔥 FIX SALE */
    setSalePrice(initialData.salePrice ?? "");
    setSaleStart(initialData.saleStart ?? "");
    setSaleEnd(initialData.saleEnd ?? "");

    /* 🔥 FIX ACTIVE */
    setIsActive(
      typeof initialData.isActive === "boolean"
        ? initialData.isActive
        : true
    );

    setStock(initialData.stock ?? 1);
    setDetail(initialData.detail || "");
    setVariants(initialData.variants || []);

/* 🔥 FIX SHIPPING */
setShippingRates(mapShippingRates(initialData.shippingRates));

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
