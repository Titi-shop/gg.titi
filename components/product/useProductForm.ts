"use client";

import { useEffect, useState } from "react";

import type {
  ProductPayload,
  ProductVariant,
} from "@/types/product";

/* =========================================================
   TYPES
========================================================= */

export type ShippingRatesState = {
  domestic: number | "";
  sea: number | "";
  asia: number | "";
  europe: number | "";
  north_america: number | "";
  rest_of_world: number | "";
};

type ShippingRateItem = {
  zone: string;
  price: number;
  domestic_country_code?: string | null;
};

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_SHIPPING: ShippingRatesState = {
  domestic: "",
  sea: "",
  asia: "",
  europe: "",
  north_america: "",
  rest_of_world: "",
};

/* =========================================================
   HELPERS
========================================================= */

const normalizeNumber = (
  value: unknown,
  fallback = 0
): number => {
  const n = Number(value);

  if (Number.isNaN(n)) {
    return fallback;
  }

  return n;
};

const normalizePriceInput = (
  value: unknown
): number | "" => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const n = Number(value);

  if (Number.isNaN(n)) {
    return "";
  }

  return n;
};

/* =========================================================
   VARIANT NORMALIZE
========================================================= */

function normalizeInitVariants(
  input: ProductVariant[] | undefined
): ProductVariant[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((v, index) => {
    const price = normalizeNumber(
      v.price
    );

    const sale_price =
      v.sale_price !== null &&
      v.sale_price !== undefined
        ? normalizeNumber(
            v.sale_price
          )
        : null;

    const sale_enabled =
      Boolean(v.sale_enabled);

    const final_price =
      sale_enabled &&
      sale_price !== null &&
      sale_price >= 0.00001 &&
      sale_price < price
        ? sale_price
        : price;

    return {
      id: v.id,

      option1: v.option1 ?? "",

      option2:
        v.option2 ?? null,

      option3:
        v.option3 ?? null,

      option_label1:
        v.option_label1 ?? null,

      option_label2:
        v.option_label2 ?? null,

      option_label3:
        v.option_label3 ?? null,

      name:
        v.name ??
        [
          v.option1,
          v.option2,
          v.option3,
        ]
          .filter(Boolean)
          .join(" - "),

      sku: v.sku ?? null,

      price,

      sale_price:
        sale_enabled &&
        sale_price !== null &&
        sale_price >= 0.00001 &&
        sale_price < price
          ? sale_price
          : null,

      final_price,

      currency:
        v.currency ?? "PI",

      sale_enabled,

      sale_stock: Math.min(
        normalizeNumber(
          v.sale_stock
        ),
        normalizeNumber(v.stock)
      ),

      sale_sold:
        normalizeNumber(
          v.sale_sold
        ),

      stock: normalizeNumber(
        v.stock
      ),

      is_unlimited:
        Boolean(
          v.is_unlimited
        ),

      image: v.image ?? "",

      is_active:
        v.is_active !== false,

      sort_order:
        normalizeNumber(
          v.sort_order,
          index
        ),

      sold: normalizeNumber(
        v.sold
      ),
    };
  });
}

/* =========================================================
   HOOK
========================================================= */

export function useProductForm(
  initialData?: Partial<ProductPayload>
) {
  /* ================= BASIC ================= */

  const [id, setId] =
    useState<string>("");

  const [name, setName] =
    useState<string>("");

  const [price, setPrice] =
    useState<number | "">("");

  const [
  category_id,
  setCategory_id,
] = useState<number | "">("");
  const [
    description,
    setDescription,
  ] = useState<string>("");

  const [images, setImages] =
    useState<string[]>([]);

  /* ================= DETAIL ================= */

  const [detail, setDetail] =
    useState<string>("");

  /* ================= SALE ================= */

  const [
    sale_enabled,
    setSale_enabled,
  ] = useState<boolean>(false);

  const [
    sale_price,
    setSale_price,
  ] = useState<number | "">("");

  const [
    sale_stock,
    setSale_stock,
  ] = useState<number>(0);

  const [
    sale_start,
    setSale_start,
  ] = useState<string>("");

  const [
    sale_end,
    setSale_end,
  ] = useState<string>("");

  /* ================= STOCK ================= */

  const [stock, setStock] =
    useState<number | "">(1);

  /* ================= STATUS ================= */

  const [
    is_active,
    setIs_active,
  ] = useState<boolean>(true);

  /* ================= VARIANTS ================= */

  const [
    variants,
    setVariants,
  ] = useState<ProductVariant[]>(
    []
  );

  /* ================= SHIPPING ================= */

  const [
    shipping_rates,
    setShipping_rates,
  ] =
    useState<ShippingRatesState>(
      DEFAULT_SHIPPING
    );

  const [
    domestic_country_code,
    setDomestic_country_code,
  ] = useState<string>("");

  /* =========================================================
     INIT DATA
  ========================================================= */

  useEffect(() => {
    if (!initialData) {
      return;
    }

    /* ================= BASIC ================= */

    setId(initialData.id || "");

    setName(
      initialData.name || ""
    );

    setPrice(
      normalizePriceInput(
        initialData.price
      )
    );

    setCategory_id(
  typeof initialData.category_id ===
    "number"
    ? initialData.category_id
    : ""
);

    setDescription(
      initialData.description ||
        ""
    );

    setImages(
      Array.isArray(
        initialData.images
      )
        ? initialData.images
        : []
    );

    setDetail(
      initialData.detail || ""
    );

    /* ================= SALE ================= */

    const hasSale =
      typeof initialData.sale_price ===
        "number" &&
      initialData.sale_price >=
        0.00001;

    setSale_enabled(hasSale);

    setSale_price(
      normalizePriceInput(
        initialData.sale_price
      )
    );

    setSale_stock(
      normalizeNumber(
        initialData.sale_stock
      )
    );

    setSale_start(
      initialData.sale_start ||
        ""
    );

    setSale_end(
      initialData.sale_end || ""
    );

    /* ================= STOCK ================= */

    setStock(
      normalizePriceInput(
        initialData.stock
      ) || 1
    );

    /* ================= STATUS ================= */

    setIs_active(
      typeof initialData.is_active ===
        "boolean"
        ? initialData.is_active
        : true
    );

    /* ================= VARIANTS ================= */

    setVariants(
      normalizeInitVariants(
        initialData.variants
      )
    );

    /* ================= SHIPPING ================= */

    const rates = Array.isArray(
      initialData.shipping_rates
    )
      ? (initialData.shipping_rates as ShippingRateItem[])
      : [];

    const rateMap = new Map<
      string,
      number
    >(
      rates.map((r) => [
        r.zone,
        normalizeNumber(
          r.price
        ),
      ])
    );

    setShipping_rates({
      domestic:
        rateMap.get(
          "domestic"
        ) ?? "",

      sea:
        rateMap.get("sea") ??
        "",

      asia:
        rateMap.get(
          "asia"
        ) ?? "",

      europe:
        rateMap.get(
          "europe"
        ) ?? "",

      north_america:
        rateMap.get(
          "north_america"
        ) ?? "",

      rest_of_world:
        rateMap.get(
          "rest_of_world"
        ) ?? "",
    });

    /* ================= COUNTRY ================= */

    const domesticRate =
      rates.find(
        (r) =>
          r.zone ===
          "domestic"
      );

    setDomestic_country_code(
      domesticRate
        ?.domestic_country_code ||
        ""
    );
  }, [initialData]);

  /* =========================================================
     AUTO RESET SALE
  ========================================================= */

  useEffect(() => {
    if (sale_enabled) {
      return;
    }

    setSale_price("");
    setSale_stock(0);
    setSale_start("");
    setSale_end("");
  }, [sale_enabled]);

  /* =========================================================
     AUTO FIX SALE STOCK
  ========================================================= */

  useEffect(() => {
    if (
      typeof stock === "number" &&
      sale_stock > stock
    ) {
      setSale_stock(stock);
    }
  }, [stock, sale_stock]);

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

    category_id,
    setCategory_id,

    description,
    setDescription,

    images,
    setImages,

    detail,
    setDetail,

    /* SALE */
    sale_enabled,
    setSale_enabled,

    sale_price,
    setSale_price,

    sale_stock,
    setSale_stock,

    sale_start,
    setSale_start,

    sale_end,
    setSale_end,

    /* STOCK */
    stock,
    setStock,

    /* STATUS */
    is_active,
    setIs_active,

    /* VARIANTS */
    variants,
    setVariants,

    /* SHIPPING */
    shipping_rates,
    setShipping_rates,

    domestic_country_code,
    setDomestic_country_code,
  };
}
