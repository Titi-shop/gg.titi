"use client";

import { useState, useEffect } from "react";
import { ProductPayload, ProductVariant } from "./types";

/* =========================================================
   SHIPPING DEFAULT STATE
========================================================= */
const DEFAULT_SHIPPING = {
  domestic: "",
  sea: "",
  asia: "",
  europe: "",
  north_america: "",
  rest_of_world: "",
};

/* =========================================================
   VARIANT NORMALIZE SAFE
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

  /* ================= DETAIL ================= */
  const [detail, setDetail] = useState("");

  /* ================= SALE ================= */
  const [saleEnabled, setSaleEnabled] = useState(false);
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [saleStock, setSaleStock] = useState(0);
  const [saleStart, setSaleStart] = useState("");
  const [saleEnd, setSaleEnd] = useState("");

  /* ================= STOCK ================= */
  const [stock, setStock] = useState<number | "">(1);

  /* ================= STATUS ================= */
  const [isActive, setIsActive] = useState(true);

  /* ================= VARIANTS ================= */
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  /* ================= SHIPPING ================= */
  const [shippingRates, setShippingRates] =
    useState<Record<string, number | "">>(DEFAULT_SHIPPING);

  const [primaryShippingCountry, setPrimaryShippingCountry] =
    useState<string>("");

  /* =========================================================
     INIT DATA
  ========================================================= */
  useEffect(() => {
    if (!initialData) return;

    console.log("📦 INIT PRODUCT:", initialData);

    /* ================= BASIC ================= */
    setId(initialData.id || "");
    setName(initialData.name || "");
    setPrice(initialData.price ?? "");
    setCategoryId(String(initialData.categoryId || ""));
    setDescription(initialData.description || "");
    setImages(Array.isArray(initialData.images) ? initialData.images : []);
    setDetail(initialData.detail || "");

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

    /* ================= VARIANTS ================= */
    const safeVariants = normalizeInitVariants(
      initialData.variants || []
    );

    setVariants(safeVariants);

    /* ================= SHIPPING ================= */
    const rateMap = new Map(
      (initialData.shippingRates || []).map((r: any) => [
        r.zone,
        r.price,
      ])
    );

    setShippingRates({
      domestic: rateMap.get("domestic") ?? "",
      sea: rateMap.get("sea") ?? "",
      asia: rateMap.get("asia") ?? "",
      europe: rateMap.get("europe") ?? "",
      north_america: rateMap.get("north_america") ?? "",
      rest_of_world: rateMap.get("rest_of_world") ?? "",
    });

    /* ================= DOMESTIC COUNTRY ================= */
    setPrimaryShippingCountry(
      initialData.shippingRates?.find(
        (r: any) => r.zone === "domestic"
      )?.countryCode ?? ""
    );
  }, [initialData]);

  /* =========================================================
     AUTO FIX: SALE RESET
  ========================================================= */
  useEffect(() => {
    if (!saleEnabled) {
      setSalePrice("");
      setSaleStock(0);
    }
  }, [saleEnabled]);

  /* =========================================================
     AUTO FIX: STOCK CHECK
  ========================================================= */
  useEffect(() => {
    if (typeof stock === "number" && saleStock > stock) {
      setSaleStock(stock);
    }
  }, [stock, saleStock]);

  /* =========================================================
     AUTO DISABLE SALE IF VARIANTS EXIST
  ========================================================= */
  useEffect(() => {
    if (variants.length > 0 && saleEnabled) {
      setSaleEnabled(false);
    }
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
    detail,
    setDetail,

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

    /* VARIANTS */
    variants,
    setVariants,

    /* SHIPPING */
    shippingRates,
    setShippingRates,

    primaryShippingCountry,
    setPrimaryShippingCountry,
  };
}
