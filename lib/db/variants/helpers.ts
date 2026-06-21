import type {
  ProductVariant,
} from "@/types/product";

/* =========================================================
   NUMBER
========================================================= */

export function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const parsed =
    Number(value);

  return Number.isNaN(parsed)
    ? fallback
    : parsed;
}

export function safeNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isNaN(parsed)
    ? null
    : parsed;
}

/* =========================================================
   STRING
========================================================= */

export function trimOrNull(
  value?: string | null
): string | null {
  if (!value) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed.length
    ? trimmed
    : null;
}

/* =========================================================
   VARIANT NAME
========================================================= */

export function buildVariantName(
  variant: Pick<
    ProductVariant,
    | "option1"
    | "option2"
    | "option3"
  >
): string {
  return [
    variant.option1,
    variant.option2,
    variant.option3,
  ]
    .filter(
      (
        value
      ): value is string =>
        Boolean(
          value?.trim()
        )
    )
    .join(" - ");
}

/* =========================================================
   PRICE
========================================================= */

export function calcFinalPrice(
  price: number,
  salePrice: number | null,
  saleEnabled: boolean
): number {
  if (
    saleEnabled &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price
  ) {
    return salePrice;
  }

  return price;
}
