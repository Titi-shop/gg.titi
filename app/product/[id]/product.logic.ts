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
  if (!data || typeof data !== "object") return null;

  const api = data as Partial<ProductType>;

  return {
    ...api,
    finalPrice,

    images: Array.isArray(api.images) ? api.images : [],
    variants: Array.isArray(api.variants) ? api.variants : [],
    shippingRates: Array.isArray(api.shippingRates)
      ? api.shippingRates
      : [],

    ratingAvg: Number.isFinite(Number(api.ratingAvg))
      ? Number(api.ratingAvg)
      : 0,

    ratingCount: Number.isFinite(Number(api.ratingCount))
      ? Number(api.ratingCount)
      : 0,
    
  finalPrice: api.finalPrice ?? api.price ?? 0,
isSale: api.isSale ?? false,
    isOutOfStock:
      (api.stock ?? 0) <= 0 || api.isActive === false,
  } as ProductType & {
    finalPrice: number;
    isSale: boolean;
    isOutOfStock: boolean;
  };
}, [data]);

  return {
    product,
    isLoading,
  };
}
