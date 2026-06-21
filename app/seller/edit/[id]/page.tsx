"use client";

import useSWR from "swr";
import {
  useParams,
  useRouter,
} from "next/navigation";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

import ProductForm from "@/components/ProductForm";

import type {
  ProductPayload,
  ProductRecord,
  ProductVariant,
  ShippingRate,
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
  const res = await apiAuthFetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("FETCH_FAILED");
  }

  return res.json();
};

/* =====================================================
   TIME
===================================================== */

function toDateTimeLocal(
  value?: string | null
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  const offset =
    date.getTimezoneOffset();

  const local = new Date(
    date.getTime() -
      offset * 60000
  );

  return local
    .toISOString()
    .slice(0, 16);
}

/* =====================================================
   NORMALIZE VARIANT
===================================================== */

function normalizeVariant(
  v: ProductVariant
): ProductVariant {
  const price =
    Number(v.price || 0);

  const sale_price =
    v.sale_price !== null &&
    v.sale_price !== undefined
      ? Number(v.sale_price)
      : null;

  const sale_enabled =
    Boolean(v.sale_enabled);

  return {
    ...v,

    option1: v.option1 || "",
    option2:
      v.option2 || null,
    option3:
      v.option3 || null,

    option_label1:
      v.option_label1 || null,

    option_label2:
      v.option_label2 || null,

    option_label3:
      v.option_label3 || null,

    name:
      v.name ||
      [
        v.option1,
        v.option2,
        v.option3,
      ]
        .filter(Boolean)
        .join(" - "),

    sku: v.sku || null,

    currency:
      v.currency || "PI",

    image: v.image || "",

    price,

    stock: Number(
      v.stock || 0
    ),

    sold: Number(
      v.sold || 0
    ),

    is_unlimited:
      Boolean(
        v.is_unlimited
      ),

    is_active:
      v.is_active !== false,

    sort_order: Number(
      v.sort_order || 0
    ),

    sale_enabled,

    sale_price:
      sale_enabled &&
      sale_price !== null &&
      sale_price > 0 &&
      sale_price < price
        ? sale_price
        : null,

    sale_stock:
      sale_enabled
        ? Math.min(
            Number(
              v.sale_stock || 0
            ),
            Number(
              v.stock || 0
            )
          )
        : 0,

    sale_sold: Number(
      v.sale_sold || 0
    ),

    final_price:
      sale_enabled &&
      sale_price !== null &&
      sale_price > 0 &&
      sale_price < price
        ? sale_price
        : price,
  };
}

/* =====================================================
   MAP PRODUCT -> FORM PAYLOAD
===================================================== */

function mapProductToPayload(
  product: ProductRecord
): ProductPayload {
  const shippingRates =
    Array.isArray(
      product.shipping_rates
    )
      ? (product.shipping_rates as ShippingRate[])
      : [];

  return {
    id: product.id,

    /* BASIC */
    name:
      product.name || "",

    category_id:
  product.category_id ?? undefined,

    description:
      product.description || "",

    detail:
      product.detail || "",

    images:
      Array.isArray(
        product.images
      )
        ? product.images
        : [],

    thumbnail:
      product.thumbnail ||
      null,

    is_active:
      Boolean(
        product.is_active
      ),

    /* SHIPPING */
    shipping_rates:
      shippingRates,

    domestic_country_code:
      product.domestic_country_code ||
      null,

    /* PRICE */
    price:
      product.price !==
        null &&
      product.price !==
        undefined
        ? Number(
            product.price
          )
        : "",

    stock:
      product.stock !==
        null &&
      product.stock !==
        undefined
        ? Number(
            product.stock
          )
        : 0,

    /* SALE */
    sale_enabled:
      Boolean(
        product.sale_enabled
      ),

    sale_price:
      product.sale_price !==
        null &&
      product.sale_price !==
        undefined
        ? Number(
            product.sale_price
          )
        : "",

    sale_stock: Number(
      product.sale_stock || 0
    ),

    sale_start:
      toDateTimeLocal(
        product.sale_start
      ),

    sale_end:
      toDateTimeLocal(
        product.sale_end
      ),

    /* VARIANTS */
    variants:
      Array.isArray(
        product.variants
      )
        ? product.variants.map(
            normalizeVariant
          )
        : [],

    idempotency_key: "",
  };
}

/* =====================================================
   PAGE
===================================================== */

export default function SellerEditPage() {
  const { t } =
    useTranslation();

  const router =
    useRouter();

  const params =
    useParams();

  const {
    user,
    loading,
  } = useAuth();

  const isSeller =
    user?.role ===
    "seller";

  const id =
    typeof params.id ===
    "string"
      ? params.id
      : "";

  /* =====================================================
     CATEGORIES
  ===================================================== */

  const {
    data: categories = [],
  } = useSWR<Category[]>(
    "/api/categories",
    fetcher
  );

  /* =====================================================
     PRODUCT
  ===================================================== */

  const {
    data: productData,
    isLoading,
    error,
  } = useSWR<ProductRecord>(
    id
      ? `/api/products/${id}`
      : null,
    fetcher
  );

  /* =====================================================
     INITIAL DATA
  ===================================================== */

  const initialData:
    | ProductPayload
    | undefined =
    productData
      ? mapProductToPayload(
          productData
        )
      : undefined;

  /* =====================================================
     GUARDS
  ===================================================== */

  if (loading || isLoading) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.loading ||
          "Loading..."}
      </div>
    );
  }

  if (
    !user ||
    !isSeller
  ) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.no_permission ||
          "No permission"}
      </div>
    );
  }

  if (
    error ||
    !initialData
  ) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t.not_found ||
          "Product not found"}
      </div>
    );
  }

  /* =====================================================
     UPDATE
  ===================================================== */

  const updateProduct =
    async (
      payload: ProductPayload
    ) => {
      console.log(
        "📦 [EDIT_PRODUCT] PAYLOAD:",
        payload
      );

      const res =
        await apiAuthFetch(
          `/api/products/${id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              payload
            ),
          }
        );

      if (!res.ok) {
        const text =
          await res.text();

        console.error(
          "❌ UPDATE FAILED:",
          text
        );

        throw new Error(
          "UPDATE_FAILED"
        );
      }

      console.log(
        "✅ PRODUCT UPDATED"
      );

      router.push(
        "/seller/stock"
      );
    };

  /* =====================================================
     UI
  ===================================================== */

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <h1 className="text-xl font-bold text-center mb-4 text-[#ff6600]">
        ✏️ {t.edit_product}
      </h1>

      <ProductForm
        categories={categories}
        initialData={
          initialData
        }
        onSubmit={
          updateProduct
        }
      />
    </main>
  );
}
