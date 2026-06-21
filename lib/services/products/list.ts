
import {
  getAllProducts,
  getProductsByIds,
} from "@/lib/db/products";

import {
  getVariantsByProductId,
} from "@/lib/db/variants";

import {
  getShippingRatesByProducts,
} from "@/lib/db/shipping";

import type {
  ShippingRateInput,
} from "./types";
import { isSaleActive } from "@/lib/utils/sale";
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

  console.log(
    "🧪 LIST_PRODUCTS_REQUEST",
    { ids }
  );

  /* =========================
     LOAD PRODUCTS
  ========================= */

  const products = ids
    ? await getProductsByIds(
        ids
          .split(",")
          .filter(Boolean)
      )
    : await getAllProducts();

  console.log(
    "🧪 LIST_PRODUCTS_RESULT",
    {
      count:
        products.length,
    }
  );

  const productIds =
    products.map(
      (product) =>
        product.id
    );

  /* =========================
     SHIPPING
  ========================= */

  const shippingRows =
    productIds.length > 0
      ? await getShippingRatesByProducts(
          productIds
        )
      : [];

  console.log(
    "🧪 SHIPPING_ROWS",
    {
      count:
        shippingRows.length,
    }
  );

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

        price:
          Number(
            row.price
          ),

        domestic_country_code:
          row.domestic_country_code,
      });
  }

  /* =========================
     ENRICH PRODUCTS
  ========================= */

  return Promise.all(
    products.map(
      async (product) => {
        console.log(
          "🧪 [PRODUCT_SERVICE]",
          {
            id:
              product.id,

            name:
              product.name,

            has_variants:
              product.has_variants,

            price:
              product.price,

            sale_price:
              product.sale_price,

            final_price:
              product.final_price,
          }
        );

        const hasVariants =
          product.has_variants ===
          true;

        /* =====================
           NO VARIANTS
        ===================== */
if (!hasVariants) {
  const saleActive =
    isSaleActive(
      product.sale_enabled,
      product.sale_price,
      product.price,
      product.sale_start,
      product.sale_end
    );

  return {
    ...product,

    variants: [],
    min_price: null,
    max_price: null,
    sale_price:
      saleActive
        ? product.sale_price
        : null,

    final_price:
      saleActive
        ? Number(product.sale_price)
        : Number(product.price),

    shipping_rates:
      shippingMap.get(
        product.id
      ) ?? [],
  };
}
        
        
        /* =====================
   LOAD VARIANTS
===================== */

const variants =
  await getVariantsByProductId(
    product.id
  );

console.log(
  "🔵 [HAS_VARIANTS]",
  {
    id: product.id,
    name: product.name,
    variantCount: variants.length,

    productSaleEnabled:
      product.sale_enabled,

    productSaleStart:
      product.sale_start,

    productSaleEnd:
      product.sale_end,
  }
);

const enrichedVariants =
  variants.map((variant) => {
    const saleActive =
      isSaleActive(
        variant.sale_enabled,
        variant.sale_price,
        variant.price,
        product.sale_start,
        product.sale_end
      );

    console.log(
      "🧪 [VARIANT_SALE_CHECK]",
      {
        productId:
          product.id,

        variantId:
          variant.id,

        price:
          variant.price,

        sale_price:
          variant.sale_price,

        variantSaleEnabled:
          variant.sale_enabled,

        productSaleStart:
          product.sale_start,

        productSaleEnd:
          product.sale_end,

        saleActive,
      }
    );

    return {
      ...variant,

      sale_enabled:
        saleActive,

      sale_price:
        saleActive
          ? variant.sale_price
          : null,

      final_price:
        saleActive
          ? Number(
              variant.sale_price
            )
          : Number(
              variant.price
            ),
    };
  });

const prices =
  enrichedVariants.map(
    (v) =>
      Number(
        v.final_price
      )
  );

const saleVariants =
  enrichedVariants.filter(
    (v) => v.sale_enabled
  );

console.log(
  "🧪 [PRODUCT_VARIANT_SUMMARY]",
  {
    productId:
      product.id,

    variantCount:
      enrichedVariants.length,

    activeSaleVariants:
      saleVariants.length,

    minFinalPrice:
      Math.min(...prices),

    maxFinalPrice:
      Math.max(...prices),
  }
);
        return {
          ...product,

          price: Math.min(
            ...enrichedVariants.map(
              (v) =>
                Number(
                  v.price
                )
            )
          ),

          sale_price:
            saleVariants.length >
            0
              ? Math.min(
                  ...saleVariants.map(
                    (v) =>
                      Number(
                        v.sale_price
                      )
                  )
                )
              : null,

          final_price:
            Math.min(
              ...prices
            ),

          has_variants:
            true,

          min_price:
            Math.min(
              ...prices
            ),

          max_price:
            Math.max(
              ...prices
            ),

          variants:
            enrichedVariants,

          shipping_rates:
            shippingMap.get(
              product.id
            ) ?? [],
        };
      }
    )
  );
}
