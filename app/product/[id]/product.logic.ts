"use client";

import useSWR from "swr";
import { useMemo } from "react";
import type { Product as ProductType } from "@/types/Product";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* ================= FETCHER ================= */

const fetcher = async (url: string) => {
  try {
    const res = await apiAuthFetch(url, {
      cache: "no-store",
    });

    if (!res.ok) {
      return null; // ❗ không throw raw error
    }

    return await res.json();
  } catch {
    return null;
  }
};

/* ================= HOOK ================= */

export function useProduct(id: string) {
  const { data, isLoading } = useSWR(
    id ? `/api/products/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: true,
      keepPreviousData: true,
    }
  );

  const product = useMemo(() => {
    if (!data) return null;

    const api = data as ProductType;

    const finalPrice =
      typeof api.salePrice === "number" &&
      api.salePrice < api.price
        ? api.salePrice
        : api.price;

    return {
      ...api,
      finalPrice,

      images: Array.isArray(api.images) ? api.images : [],
      variants: Array.isArray(api.variants) ? api.variants : [],
      shippingRates: Array.isArray(api.shippingRates)
        ? api.shippingRates
        : [],

      ratingAvg: Number(api.ratingAvg ?? 0),
      ratingCount: Number(api.ratingCount ?? 0),

      isSale: finalPrice < api.price,
      isOutOfStock:
        (api.stock ?? 0) <= 0 || api.isActive === false,
    };
  }, [data]);

  return {
    product,
    isLoading,
  };
}
