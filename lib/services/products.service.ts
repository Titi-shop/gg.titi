import {
  getAllProducts,
  getProductsByIds,
  createProduct,
  updateProductBySeller,
  deleteProductBySeller,
} from "@/lib/db/products";

import {
  getVariantsByProductId,
  replaceVariantsByProductId,
} from "@/lib/db/variants";

import {
  getShippingRatesByProducts,
  upsertShippingRates,
} from "@/lib/db/shipping";

import {
  normalizeVariants,
  validateProductPayload,
} from "@/lib/validators/products";
/* =========================================================
   TYPES
========================================================= */

type VariantInput = {
  price?: number;
  sale_price?: number | null;
  final_price?: number;
  stock?: number;
  sale_enabled?: boolean;
};

type ShippingRateInput = {
  zone: string;
  price: number;
  domestic_country_code: string | null;
};

type ProductRequestBody = {
  id?: string;
  name: string;
  description?: string;
  detail?: string;
  images?: string[];
  thumbnail?: string;
  category_id?: number | null;
  price?: number;
  stock?: number;
  sale_price?: number | null;
  sale_start?: string | null;
  sale_end?: string | null;
  sale_stock?: number;
  sale_enabled?: boolean;
  has_variants?: boolean;
  is_active?: boolean;
  primary_shipping_country?: string;
  domestic_country_code?: string;
  shipping_rates?: {
    zone: string;
    price?: number;
    domestic_country_code?: string | null;
  }[];

  variants?: VariantInput[];
};

/* =========================================================
   HELPERS
========================================================= */

function getCategoryId(
  body: ProductRequestBody
): number | null {
  return body.category_id ?? null;
}

function calcFinalPrice(
  variants: VariantInput[],
  fallbackPrice: number
): number {
  if (!variants.length) {
    return fallbackPrice;
  }

  return Math.min(
    ...variants.map((variant) =>
      Number(
        variant.final_price ??
          variant.sale_price ??
          variant.price ??
          0
      )
    )
  );
}

function calcStock(
  variants: VariantInput[],
  fallbackStock: number
): number {
  if (!variants.length) {
    return fallbackStock;
  }

  return variants.reduce(
    (sum, variant) =>
      sum + Number(variant.stock ?? 0),
    0
  );
}

function normalizeShippingRates(
  body: ProductRequestBody,
  primaryCountry?: string
): ShippingRateInput[] {
  const rates =
    body.shipping_rates ?? [];

  return rates.map((rate) => ({
    zone: rate.zone,
    price: Number(rate.price ?? 0),
    domestic_country_code:
      rate.zone === "domestic"
        ? (
            rate.domestic_country_code ??
            primaryCountry ??
            body.primary_shipping_country ??
            body.domestic_country_code ??
            null
          )
        : null,
  }));
}

/* =========================================================
   LIST PRODUCTS
========================================================= */

export async function listProductsService(
  req: Request
) {
  const { searchParams } =
    new URL(req.url);

  const ids =
    searchParams.get("ids");

  const products = ids
    ? await getProductsByIds(
        ids
          .split(",")
          .filter(Boolean)
      )
    : await getAllProducts();

  const productIds =
    products.map(
      (product) => product.id
    );

  const shippingRows =
    productIds.length > 0
      ? await getShippingRatesByProducts(
          productIds
        )
      : [];

  const shippingMap =
    new Map<
      string,
      ShippingRateInput[]
    >();

  for (const row of shippingRows) {
    if (
      !shippingMap.has(
        row.product_id
      )
    ) {
      shippingMap.set(
        row.product_id,
        []
      );
    }

    shippingMap
      .get(row.product_id)!
      .push({
        zone: row.zone,
        price: Number(row.price),

        domestic_country_code:
          row.domestic_country_code,
      });
  }

 return Promise.all(
  products.map(async (product) => {
    console.log(
  "🧪 [PRODUCT_SERVICE]",
  {
    id: product.id,
    name: product.name,
    has_variants: product.has_variants,
    price: product.price,
    sale_price: product.sale_price,
    final_price: product.final_price,
  }
);

    const hasVariants = product.has_variants === true;

    // =========================
    // CASE 1: NO VARIANTS
    // =========================
    if (!hasVariants) {
      return {
        ...product,
        variants: [],
        min_price: null,
        max_price: null,
        sale_price: product.sale_price,
        final_price: product.final_price,
        shipping_rates: shippingMap.get(product.id) ?? [],
      };
    }

    // =========================
    // CASE 2: HAS VARIANTS
    // =========================
    const variants = await getVariantsByProductId(product.id);
console.log(
  "🔵 [HAS_VARIANTS]",
  {
    id: product.id,
    name: product.name,
    variantCount: variants.length,
  }
);
    const enrichedVariants = variants.map((variant) => {
      const saleActive =
        variant.sale_enabled &&
        variant.sale_price !== null &&
        Number(variant.sale_price) > 0 &&
        Number(variant.sale_price) < Number(variant.price);

      return {
        ...variant,
        final_price: saleActive
          ? Number(variant.sale_price)
          : Number(variant.price),
      };
    });

    const prices = enrichedVariants.map((v) =>
      Number(v.final_price)
    );

    const saleVariants = enrichedVariants.filter(
      (v) =>
        v.sale_price !== null &&
        Number(v.sale_price) > 0
    );

    return {
      ...product,

      price: Math.min(
        ...enrichedVariants.map((v) => Number(v.price))
      ),

      sale_price:
        saleVariants.length > 0
          ? Math.min(
              ...saleVariants.map((v) =>
                Number(v.sale_price)
              )
            )
          : null,

      final_price: Math.min(...prices),
      has_variants: true,
      min_price: Math.min(...prices),
      max_price: Math.max(...prices),
      variants: enrichedVariants,
      shipping_rates:
        shippingMap.get(product.id) ?? [],
    };
  })
);
}

/* =========================================================
   CREATE PRODUCT
========================================================= */


        export async function createProductService(
  req: Request,
  userId: string
) {
  try {
    const body =
      (await req.json()) as ProductRequestBody;

    console.log(
      "📦 CREATE_PRODUCT_BODY",
      JSON.stringify(body, null, 2)
    );

    /* =========================
       VALIDATE PRODUCT
    ========================= */

    const error =
      validateProductPayload(body);

    console.log(
      "🧪 VALIDATION_RESULT",
      {
        error,
        sale_enabled:
          body.sale_enabled,
        sale_start:
          body.sale_start,
        sale_end:
          body.sale_end,
        variantCount:
          body.variants?.length ?? 0,
      }
    );

    if (error) {
      console.error(
        "❌ PRODUCT_VALIDATION_FAILED",
        error
      );

      return { error };
    }

    const variants =
      normalizeVariants(
        body.variants ?? []
      );

    console.log(
      "🧪 NORMALIZED_VARIANTS",
      JSON.stringify(
        variants,
        null,
        2
      )
    );
const hasVariants = variants.length > 0;
const finalPrice = calcFinalPrice(
  variants,
  Number(body.price ?? 0)
);

const stock = calcStock(
  variants,
  Number(body.stock ?? 0)
);
    console.log(
      "🚀 CREATE_PRODUCT_DB",
      {
        finalPrice,
        stock,
        sale_enabled:
          body.sale_enabled,
        sale_price:
          body.sale_price,
        sale_start:
          body.sale_start,
        sale_end:
          body.sale_end,
        variantCount:
          variants.length,
      }
    );

    const product =
      await createProduct(userId, {
  name: body.name,

  description: body.description ?? "",
  detail: body.detail ?? "",
  images: body.images ?? [],
  thumbnail: body.thumbnail ?? "",
  category_id: getCategoryId(body),
  price: finalPrice,
  stock,
  sale_price: body.sale_price ?? null,

  sale_start: body.sale_start ?? null,
  sale_end: body.sale_end ?? null,

  sale_stock: Number(body.sale_stock ?? 0),
  sale_enabled: Boolean(body.sale_enabled),
  is_active: body.is_active !== false,
  has_variants: hasVariants, 
});

    console.log(
      "✅ PRODUCT_CREATED",
      {
        id: product.id,
      }
    );

    if (variants.length > 0) {
      console.log(
        "🧪 REPLACE_VARIANTS_START",
        {
          productId:
            product.id,
          count:
            variants.length,
        }
      );

      await replaceVariantsByProductId(
        product.id,
        variants
      );

      console.log(
        "✅ REPLACE_VARIANTS_DONE"
      );
    }

    const cleanedRates =
      normalizeShippingRates(
        body,
        body.primary_shipping_country
      );

    console.log(
      "🧪 SHIPPING_RATES",
      cleanedRates
    );

    if (
      cleanedRates.length > 0
    ) {
      await upsertShippingRates({
        productId:
          product.id,
        rates:
          cleanedRates,
      });

      console.log(
        "✅ SHIPPING_SAVED"
      );
    }

    return {
      success: true,
      data: {
        id: product.id,
      },
    };
  } catch (error) {
    console.error(
      "💥 CREATE_PRODUCT_SERVICE_ERROR",
      error
    );

    return {
      error:
        error instanceof Error
          ? error.message
          : "UNKNOWN_ERROR",
    };
  }
        }

/* =========================================================
   UPDATE PRODUCT
========================================================= */

export async function updateProductService(
  req: Request,
  userId: string
) {
  const body =
  (await req.json()) as ProductRequestBody;

/* =========================
   VALIDATE PRODUCT
========================= */

const error =
  validateProductPayload(body);

if (error) {
  return { error };
}

const variants =
  normalizeVariants(
    body.variants ?? []
  );
const hasVariants =
  body.has_variants === true &&
  variants.length > 0;
 const finalPrice = hasVariants
  ? 0
  : Number(body.price ?? 0);

const stock = hasVariants
  ? 0
  : Number(body.stock ?? 0);

  const updated =
    await updateProductBySeller(
      userId,
      body.id ?? "",
      {
        name: body.name,

        description:
          body.description,

        detail:
          body.detail,

        images:
          body.images,

        thumbnail:
          body.thumbnail,

        category_id:
          getCategoryId(body),

        price: finalPrice,

        stock,

        sale_price:
          body.sale_price ??
          null,

        sale_enabled:
          Boolean(
            body.sale_enabled
          ),

        sale_start:
          body.sale_start ??
          null,

        sale_end:
          body.sale_end ??
          null,

        sale_stock:
          Number(
            body.sale_stock ?? 0
          ),

        is_active: body.is_active ?? true,
        has_variants: hasVariants,
      }
    );

  if (!updated) {
    return {
      error: "NOT_FOUND",
    };
  }

  await replaceVariantsByProductId(
    body.id ?? "",
    variants
  );

  const cleanedRates =
    normalizeShippingRates(
      body,
      body.primary_shipping_country
    );

  if (cleanedRates.length > 0) {
    await upsertShippingRates({
      productId:
        body.id ?? "",
      rates: cleanedRates,
    });
  }

  return {
    success: true,

    data: {
      id: body.id,
      price: finalPrice,
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

  if (!deleted) {
    return {
      error: "NOT_FOUND",
    };
  }

  return {
    success: true,
  };
}
