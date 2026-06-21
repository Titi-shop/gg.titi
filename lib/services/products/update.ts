import {
  updateProductBySeller,
  deleteProductBySeller,
} from "@/lib/db/products";

import {
  replaceVariantsByProductId,
} from "@/lib/db/variants";

import {
  upsertShippingRates,
} from "@/lib/db/shipping";

import {
  normalizeVariants,
  validateProductPayload,
} from "@/lib/validators/products";

import type {
  ProductRequestBody,
} from "./types";

import {
  getCategoryId,
  normalizeShippingRates,
  buildSaleFields,
  buildProductFields,
} from "./helpers";

/* =========================================================
   UPDATE PRODUCT
========================================================= */

export async function updateProductService(
  req: Request,
  userId: string
) {
  const body =
    (await req.json()) as ProductRequestBody;

  console.log(
    "📦 UPDATE_PRODUCT_BODY",
    JSON.stringify(
      body,
      null,
      2
    )
  );

  /* =========================
     VALIDATE
  ========================= */

  const error =
    validateProductPayload(
      body
    );

  if (error) {
    console.error(
      "❌ UPDATE_VALIDATION_FAILED",
      error
    );

    return { error };
  }

  /* =========================
     VARIANTS
  ========================= */

  const variants =
    normalizeVariants(
      body.variants ?? []
    );

  console.log(
    "🧪 UPDATE_VARIANTS",
    JSON.stringify(
      variants,
      null,
      2
    )
  );

  const hasVariants =
    body.has_variants === true &&
    variants.length > 0;

  console.log(
    "🧪 UPDATE_HAS_VARIANTS",
    {
      bodyHasVariants:
        body.has_variants,

      variantCount:
        variants.length,

      finalHasVariants:
        hasVariants,
    }
  );

  /* =========================
     PRODUCT FIELDS
  ========================= */

  const {
    price,
    stock,
  } = buildProductFields(
    body,
    hasVariants
  );

  const {
    sale_enabled,
    sale_price,
    sale_stock,
    sale_start,
    sale_end,
  } = buildSaleFields(
    body,
    hasVariants
  );

  console.log(
    "🚀 UPDATE_PRODUCT_DB",
    {
      id: body.id,

      hasVariants,

      price,

      stock,

      sale_enabled,

      sale_price,

      sale_stock,

      sale_start,

      sale_end,

      variantCount:
        variants.length,
    }
  );

  /* =========================
     UPDATE PRODUCT
  ========================= */

  const updated =
    await updateProductBySeller(
      userId,
      body.id ?? "",
      {
        name:
          body.name,

        description:
          body.description,

        detail:
          body.detail,

        images:
          body.images,

        thumbnail:
          body.thumbnail,

        category_id:
          getCategoryId(
            body
          ),

        price,
        stock,

        sale_enabled,
        sale_price,
        sale_stock,
        sale_start,
        sale_end,

        is_active:
          body.is_active ?? true,

        has_variants:
          hasVariants,
      }
    );

  if (!updated) {
    console.error(
      "❌ UPDATE_PRODUCT_NOT_FOUND"
    );

    return {
      error: "NOT_FOUND",
    };
  }

  console.log(
    "✅ UPDATE_PRODUCT_SUCCESS",
    {
      id:
        updated.id,

      has_variants:
        updated.has_variants,

      price:
        updated.price,

      sale_price:
        updated.sale_price,

      final_price:
        updated.final_price,

      stock:
        updated.stock,
    }
  );

  /* =========================
     VARIANTS
  ========================= */

  console.log(
    "🧪 UPDATE_REPLACE_VARIANTS_START",
    {
      productId:
        body.id,

      count:
        variants.length,
    }
  );

  await replaceVariantsByProductId(
    body.id ?? "",
    variants
  );

  console.log(
    "✅ UPDATE_REPLACE_VARIANTS_DONE"
  );

  /* =========================
     SHIPPING
  ========================= */

  const cleanedRates =
    normalizeShippingRates(
      body,
      body.primary_shipping_country
    );

  console.log(
    "🧪 UPDATE_SHIPPING_RATES",
    cleanedRates
  );

  if (
    cleanedRates.length > 0
  ) {
    await upsertShippingRates({
      productId:
        body.id ?? "",

      rates:
        cleanedRates,
    });

    console.log(
      "✅ UPDATE_SHIPPING_SAVED"
    );
  }

  /* =========================
     SUCCESS
  ========================= */

  return {
    success: true,

    data: {
      id: body.id,

      price,
    },
  };
}

/* =========================================================
   DELETE PRODUCT
========================================================= */

export async function deleteProductService(
  req: Request,
  userId: string
) {
  const { searchParams } =
    new URL(req.url);

  const id =
    searchParams.get("id");

  console.log(
    "🗑️ DELETE_PRODUCT_REQUEST",
    {
      id,
      userId,
    }
  );

  if (!id) {
    return {
      error: "MISSING_ID",
    };
  }

  const deleted =
    await deleteProductBySeller(
      userId,
      id
    );

  console.log(
    "🧪 DELETE_PRODUCT_RESULT",
    {
      id,
      deleted,
    }
  );

  if (!deleted) {
    return {
      error: "NOT_FOUND",
    };
  }

  return {
    success: true,
  };
}
