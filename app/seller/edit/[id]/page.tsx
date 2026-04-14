"use client";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import ProductForm from "@/components/ProductForm";

interface Category {
  id: string;
  key: string;
}

interface ProductPayload {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  saleStart?: string | null;
  saleEnd?: string | null;
  description: string;
  detail: string;
  images: string[];
  thumbnail: string;
  categoryId: string;
  stock: number;
  is_active: boolean;
}
const fetcher = (url: string) =>
  apiAuthFetch(url, { cache: "no-store" }).then((res) =>
    res.ok ? res.json() : null
  );

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

export default function SellerEditPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { user, loading } = useAuth();
  const isSeller = user?.role === "seller";
  const id = typeof params.id === "string" ? params.id : "";
  const { data: categories = [] } = useSWR(
  "/api/categories",
  fetcher
);

const { data: productData, isLoading } = useSWR(
  id ? `/api/products/${id}` : null,
  fetcher
);
  const product: ProductPayload | null = productData
  ? {
      ...productData,

      saleStart: toDateTimeLocal(productData.saleStart),
      saleEnd: toDateTimeLocal(productData.saleEnd),

      /* 🔥 FIX SHIPPING */
      shippingRates: (() => {
        const base = {
          domestic: 0,
          sea: 0,
          asia: 0,
          europe: 0,
          north_america: 0,
          rest_of_world: 0,
        };

        if (!Array.isArray(productData.shippingRates)) {
          return base;
        }

        for (const r of productData.shippingRates) {
          if (r?.zone) {
            base[r.zone] = Number(r.price) || 0;
          }
        }

        return base;
      })(),
    }
  : null;

  if (loading || isLoading) {
  return (
    <div className="p-8 text-center text-gray-400">
      {t.loading ?? "Loading..."}
    </div>
  );
}

if (!user || !isSeller) {
  return (
    <div className="p-8 text-center text-gray-400">
      {t.no_permission ?? "No permission"}
    </div>
  );
}

if (!product) {
  return (
    <div className="p-8 text-center text-gray-400">
      {t.not_found ?? "Product not found"}
    </div>
  );
}

  const updateProduct = async (payload: ProductPayload) => {
  const res = await apiAuthFetch(`/api/products/${id}`, { // 🔥 dùng id từ params
    method: "PATCH",
    body: JSON.stringify(payload),
  });

    if (!res.ok) {
      throw new Error("PATCH_FAILED");
    }

    router.push("/seller/stock");
  };

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <h1 className="text-xl font-bold text-center mb-4 text-[#ff6600]">
        ✏️ {t.edit_product}
      </h1>

      <ProductForm
        categories={categories}
        initialData={product}
        onSubmit={updateProduct}
      />
    </main>
  );
}
