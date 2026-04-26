"use client";

import { useState, useEffect } from "react";
import { ProductPayload, ProductVariant } from "./types";

/* =========================================================
   SHIPPING MAP
========================================================= */
function mapShippingRates(rates: any[]) {
  const base: Record<string, number | ""> = {
    domestic: "",
    sea: "",
    asia: "",
    europe: "",
    north_america: "",
    rest_of_world: "",
  };

  if (!Array.isArray(rates)) return base;

  for (const r of rates) {
    if (!r?.zone) continue;

    const price = Number(r.price);
    base[r.zone] = !Number.isNaN(price) ? price : "";
  }

  return base;
}

/* =========================================================
   VARIANT SAFE NORMALIZE
========================================================= */
function normalizeInitVariants(input: any[]): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  return input.map((v: any, i: number) => ({
    id: v.id,

    option1: v.option1 ?? "",
    option2: v.option2 ?? null,
    option3: v.option3 ?? null,

    optionLabel1: v.optionLabel1 ?? null,
    optionLabel2: v.optionLabel2 ?? null,
    optionLabel3: v.optionLabel3 ?? null,

    optionValue: v.optionValue ?? v.option1 ?? "",
    optionName: v.optionName ?? v.optionLabel1 ?? "",

    name:
      v.name ??
      [v.option1, v.option2, v.option3]
        .filter(Boolean)
        .join(" - "),

    sku: v.sku ?? null,

    price: Number(v.price ?? 0),

    salePrice:
      v.salePrice !== null && v.salePrice !== undefined
        ? Number(v.salePrice)
        : null,

    finalPrice: Number(v.finalPrice ?? v.price ?? 0),

    saleEnabled: Boolean(v.saleEnabled),
    saleStock: Number(v.saleStock ?? 0),
    saleSold: Number(v.saleSold ?? 0),

    stock: Number(v.stock ?? 0),
    isUnlimited: Boolean(v.isUnlimited),

    image: v.image ?? "",

    isActive: v.isActive !== false,
    sortOrder: Number(v.sortOrder ?? i),

    sold: Number(v.sold ?? 0),
  }));
}

/* =========================================================
   HOOK
========================================================= */
export function useProductForm(initialData?: ProductPayload) {
  /* ================= BASIC ================= */
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);

  /* ================= SALE ================= */
  const [saleEnabled, setSaleEnabled] = useState(false);
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [saleStock, setSaleStock] = useState<number>(0);
  const [saleStart, setSaleStart] = useState("");
  const [saleEnd, setSaleEnd] = useState("");

  /* ================= STOCK ================= */
  const [stock, setStock] = useState<number | "">(1);

  /* ================= STATUS ================= */
  const [isActive, setIsActive] = useState(true);

  /* ================= DETAIL ================= */
  const [detail, setDetail] = useState("");

  /* ================= VARIANTS ================= */
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  /* ================= SHIPPING ================= */
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
     INIT DATA (EDIT MODE)
  ========================================================= */
  useEffect(() => {
    if (!initialData) return;

    console.log("📦 [FORM INIT PRODUCT]:", initialData);

    /* ================= BASIC ================= */
    setId(initialData.id || "");
    setName(initialData.name || "");
    setPrice(initialData.price ?? "");
    setCategoryId(String(initialData.categoryId || ""));
    setDescription(initialData.description || "");
    setImages(Array.isArray(initialData.images) ? initialData.images : []);

    /* ================= SALE ================= */
    const hasSale =
      typeof initialData.salePrice === "number" &&
      initialData.salePrice > 0;

    setSaleEnabled(hasSale);
    setSalePrice(initialData.salePrice ?? "");
    setSaleStock(Number((initialData as any).saleStock ?? 0));
    setSaleStart(initialData.saleStart ?? "");
    setSaleEnd(initialData.saleEnd ?? "");

    /* ================= STOCK ================= */
    setStock(initialData.stock ?? 1);

    /* ================= STATUS ================= */
    setIsActive(
      typeof initialData.isActive === "boolean"
        ? initialData.isActive
        : true
    );

    /* ================= DETAIL ================= */
    setDetail(initialData.detail || "");

    /* ================= VARIANTS SAFE ================= */
    const safeVariants = normalizeInitVariants(initialData.variants || []);

    console.log("🧩 [FORM SAFE VARIANTS]:", safeVariants);

    setVariants(safeVariants);

    /* ================= SHIPPING ================= */
    setShippingRates(
      mapShippingRates(initialData.shippingRates || [])
    );
  }, [initialData]);

  /* =========================================================
     AUTO FIX: PRODUCT SALE RESET
  ========================================================= */
  useEffect(() => {
    if (!saleEnabled) {
      setSalePrice("");
      setSaleStock(0);
    }
  }, [saleEnabled]);

  /* =========================================================
     AUTO FIX: SALE STOCK <= STOCK
  ========================================================= */
  useEffect(() => {
    if (typeof stock === "number" && saleStock > stock) {
      console.warn("⚠️ FIX saleStock > stock");
      setSaleStock(stock);
    }
  }, [stock, saleStock]);

  /* =========================================================
     AUTO FIX: IF VARIANTS EXIST => DISABLE PRODUCT SALE
  ========================================================= */
  useEffect(() => {
    if (variants.length > 0 && saleEnabled) {
      console.warn("⚠️ Disable product-level sale because variants exist");
      setSaleEnabled(false);
    }
  }, [variants]);

  /* =========================================================
     DEBUG WATCH
  ========================================================= */
  useEffect(() => {
    console.log("🧨 [FORM VARIANTS STATE]:", variants);
  }, [variants]);

  /* =========================================================
     RETURN
  ========================================================= */
  return {
    /* BASIC */
    id,
    setId,

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

    /* SALE */
    saleEnabled,
    setSaleEnabled,

    salePrice,
    setSalePrice,

    saleStock,
    setSaleStock,

    saleStart,
    setSaleStart,

    saleEnd,
    setSaleEnd,

    /* STOCK */
    stock,
    setStock,

    /* STATUS */
    isActive,
    setIsActive,

    /* DETAIL */
    detail,
    setDetail,

    /* VARIANTS */
    variants,
    setVariants,

    /* SHIPPING */
    shippingRates,
    setShippingRates,
  };
}
