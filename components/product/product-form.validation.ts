import type {
  ProductVariant,
} from "@/types/product";

/* =========================
   VARIANT SALE VALIDATION
========================= */

export function validateVariantSale(
  variants: ProductVariant[],
  saleStart?: string | null,
  saleEnd?: string | null
): string | null {

  const hasSaleVariant =
    variants.some(
      (variant) =>
        Boolean(
          variant.sale_enabled
        ) &&
        Number(
          variant.sale_price
        ) > 0
    );

  if (!hasSaleVariant) {
    return null;
  }

  if (
    !saleStart ||
    !saleEnd
  ) {
    return "SALE_DATE_REQUIRED";
  }

  const start =
    new Date(
      saleStart
    ).getTime();

  const end =
    new Date(
      saleEnd
    ).getTime();

  if (
    Number.isNaN(start) ||
    Number.isNaN(end)
  ) {
    return "INVALID_SALE_TIME";
  }

  if (start >= end) {
    return "INVALID_SALE_TIME";
  }

  return null;
}

/* =========================
   PRODUCT SALE VALIDATION
========================= */

export function validateProductSale(
  saleEnabled: boolean,
  price: number,
  salePrice: number,
  saleStock: number,
  saleStart?: string | null,
  saleEnd?: string | null
): string | null {

  if (!saleEnabled) {
    return null;
  }

  if (
    Number.isNaN(
      salePrice
    ) ||
    salePrice <= 0
  ) {
    return "SALE_PRICE_REQUIRED";
  }

  if (
    saleStock <= 0
  ) {
    return "SALE_STOCK_REQUIRED";
  }

  if (
    !saleStart ||
    !saleEnd
  ) {
    return "SALE_DATE_REQUIRED";
  }

  if (
    salePrice >= price
  ) {
    return "SALE_PRICE_INVALID";
  }

  const start =
    new Date(
      saleStart
    ).getTime();

  const end =
    new Date(
      saleEnd
    ).getTime();

  if (
    Number.isNaN(start) ||
    Number.isNaN(end)
  ) {
    return "INVALID_SALE_TIME";
  }

  if (start >= end) {
    return "INVALID_SALE_TIME";
  }

  return null;
}
