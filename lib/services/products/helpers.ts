import type {
  ProductRequestBody,
  ShippingRateInput,
} from "./types";

/* =========================================================
   CATEGORY
========================================================= */

export function getCategoryId(
  body: ProductRequestBody
): number | null {
  return body.category_id ?? null;
}

/* =========================================================
   SHIPPING
========================================================= */

export function normalizeShippingRates(
  body: ProductRequestBody,
  primaryCountry?: string
): ShippingRateInput[] {
  const rates =
    body.shipping_rates ?? [];

  return rates.map((rate) => ({
    zone: rate.zone,

    price: Number(
      rate.price ?? 0
    ),

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
   SALE RULES
========================================================= */

export function buildSaleFields(
  body: ProductRequestBody,
  hasVariants: boolean
) {
  const sale_enabled =
    hasVariants
      ? false
      : Boolean(
          body.sale_enabled
        );

  const sale_price =
    hasVariants
      ? null
      : body.sale_price ?? null;

  const sale_stock =
    hasVariants
      ? null
      : Number(
          body.sale_stock ?? 0
        );

  const sale_start =
    hasVariants
      ? null
      : body.sale_start ?? null;

  const sale_end =
    hasVariants
      ? null
      : body.sale_end ?? null;

  return {
    sale_enabled,
    sale_price,
    sale_stock,
    sale_start,
    sale_end,
  };
}

/* =========================================================
   PRODUCT PRICE
========================================================= */

export function buildProductFields(
  body: ProductRequestBody,
  hasVariants: boolean
) {
  return {
    price: hasVariants
      ? null
      : Number(
          body.price ?? 0
        ),

    stock: hasVariants
      ? null
      : Number(
          body.stock ?? 0
        ),
  };
}
