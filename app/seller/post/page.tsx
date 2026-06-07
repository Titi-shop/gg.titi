"use client";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import ProductForm from "@/components/ProductForm";
import type {
  ProductPayload,
} from "@/types/product";

/* =====================================================
   TYPES
===================================================== */

interface Category {
  id: string;
  key: string;
}

/* =====================================================
   FETCHER
===================================================== */

const fetcher = async (
  url: string
) => {
  const res = await fetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("FETCH_FAILED");
  }

  return res.json();
};

/* =====================================================
   PAGE
===================================================== */

export default function SellerPostPage() {
  const { t } =
    useTranslation();

  const router = useRouter();

  const { user, loading } =
    useAuth();

  const isSeller =
    user?.role === "seller";

  /* =====================================================
     LOAD CATEGORIES
  ===================================================== */

  const {
    data: categories = [],
    isLoading,
    error,
  } = useSWR<Category[]>(
    "/api/categories",
    fetcher,
    {
      revalidateOnFocus: false,

      revalidateIfStale: false,

      dedupingInterval: 10000,
    }
  );

  /* =====================================================
     CREATE PRODUCT
  ===================================================== */

  const createProduct = async (
    payload: ProductPayload
  ) => {
    console.log(
      "📦 [CREATE_PRODUCT] PAYLOAD:",
      payload
    );

    const res =
      await apiAuthFetch(
        "/api/products",
        {
          method: "POST",

          body: JSON.stringify(
            payload
          ),
        }
      );

    if (!res.ok) {
      const text =
        await res.text();

      console.error(
        "❌ CREATE FAILED:",
        text
      );

      throw new Error(
        "POST_FAILED"
      );
    }

    console.log(
      "✅ PRODUCT CREATED"
    );

    router.push(
      "/seller/stock"
    );
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.loading ??
          "Loading..."}
      </div>
    );
  }

  /* =====================================================
     PERMISSION
  ===================================================== */

  if (!user || !isSeller) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.no_permission ??
          "No permission"}
      </div>
    );
  }

  /* =====================================================
     CATEGORY ERROR
  ===================================================== */

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        FAILED_TO_LOAD_CATEGORIES
      </div>
    );
  }

  /* =====================================================
     UI
  ===================================================== */

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
          onSubmit={
            createProduct
          }
        />
      )}
    </main>
  );
}
