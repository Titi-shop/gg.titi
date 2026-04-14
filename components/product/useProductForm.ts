"use client";

import { useState, useEffect } from "react";
import { ProductPayload, ProductVariant } from "./types";

/* =========================================================
   MAP SHIPPING (FIX + LOG)
========================================================= */
function mapShippingRates(rates: any[]) {
  console.log("🚚 [FORM] mapShippingRates INPUT:", rates);

  const base: Record<string, number | ""> = {
    domestic: "",
    sea: "",
    asia: "",
    europe: "",
    north_america: "",
    rest_of_world: "",
  };

  if (!Array.isArray(rates)) {
    console.warn("⚠️ [FORM] shippingRates is not array");
    return base;
  }

  for (const r of rates) {
    if (!r) continue;

    console.log("➡️ [FORM] shipping item:", r);

    if (!r.zone) {
      console.warn("⚠️ missing zone:", r);
      continue;
    }

    const price = Number(r.price);

base[r.zone] =
  !Number.isNaN(price) ? price : "";

    console.log("✅ mapped:", r.zone, "=", base[r.zone]);
  }

  console.log("🎯 [FORM] FINAL SHIPPING:", base);

  return base;
}

/* =========================================================
   HOOK
========================================================= */
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

  /* =========================================================
     INIT DATA
  ========================================================= */
  useEffect(() => {
    console.log("🚀 [FORM] INIT START");

    if (!initialData) {
      console.warn("⚠️ [FORM] NO INITIAL DATA");
      return;
    }

    console.log("📦 [FORM] INIT DATA FULL:", initialData);

    /* ================= BASIC ================= */
    setName(initialData.name || "");
    setPrice(initialData.price ?? "");
    setCategoryId(initialData.categoryId || "");
    setDescription(initialData.description || "");
    setImages(initialData.images || []);

    /* ================= SALE ================= */
    console.log("💰 [FORM] SALE:", {
      salePrice: initialData.salePrice,
      saleStart: initialData.saleStart,
      saleEnd: initialData.saleEnd,
    });

    setSalePrice(initialData.salePrice ?? "");
    setSaleStart(initialData.saleStart ?? "");
    setSaleEnd(initialData.saleEnd ?? "");

    /* ================= ACTIVE ================= */
    setIsActive(
      typeof initialData.isActive === "boolean"
        ? initialData.isActive
        : true
    );

    /* ================= STOCK ================= */
    setStock(initialData.stock ?? 1);

    /* ================= DETAIL ================= */
    setDetail(initialData.detail || "");

    /* ================= VARIANTS ================= */
    console.log("🧩 [FORM] VARIANTS:", initialData.variants);

    setVariants(initialData.variants || []);

    /* ================= SHIPPING ================= */
    console.log("🚚 [FORM] RAW SHIPPING:", initialData.shippingRates);

    const mapped = mapShippingRates(initialData.shippingRates);

    setShippingRates(mapped);

    console.log("🎯 [FORM] SET SHIPPING DONE");

    console.log("🎉 [FORM] INIT DONE");
  }, [initialData]);
   
useEffect(() => {
  console.log("📡 [FORM] SHIPPING STATE UPDATED:", shippingRates);
}, [shippingRates]);
  /* =========================================================
     RETURN
  ========================================================= */
  return {
    name,
    setName,

    price,
    setPrice,

    categoryId,
    setCategoryId,

    description,
    setDescription,

    images,
    setImages,

    salePrice,
    setSalePrice,

    saleStart,
    setSaleStart,

    saleEnd,
    setSaleEnd,

    stock,
    setStock,

    isActive,
    setIsActive,

    detail,
    setDetail,

    variants,
    setVariants,

    shippingRates,
    setShippingRates,
  };
}
