"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import ProductForm from "@/components/ProductForm";
import useSWR from "swr";
interface Category {
  id: string;
  key: string;
}

interface ProductPayload {
  id?: string;
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
  fetch(url, { cache: "no-store" }).then((r) =>
    r.ok ? r.json() : []
  );

export default function SellerPostPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { user, loading } = useAuth();
  const isSeller = user?.role === "seller";
  const { data: categories = [], isLoading } = useSWR(
  "/api/categories",
  fetcher,
  {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 10000,
  }
);
  const createProduct = async (payload: ProductPayload) => {
  try {
    setSubmitting(true);

    const res = await apiAuthFetch("/api/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error("POST_FAILED");
    }

    router.push("/seller/stock");
  } finally {
    setSubmitting(false);
  }
};

if (loading) {
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

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <h1 className="text-xl font-bold text-center mb-4 text-[#ff6600]">
        ➕ {t.post_product}
      </h1>

      {isLoading ? (
  <div className="space-y-4 animate-pulse">
    <div className="h-10 bg-gray-200 rounded" />
    <div className="h-10 bg-gray-200 rounded" />
    <div className="h-40 bg-gray-200 rounded" />
  </div>
) : (
  <ProductForm
    categories={categories}
    onSubmit={createProduct}
  />
)}
    </main>
  );
}
