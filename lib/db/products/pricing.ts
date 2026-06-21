import {
  safeNumber,
  safeNullableNumber,
} from "./helpers";

/* =========================================================
   FINAL PRICE
========================================================= */

export function calcFinalPrice(
  input: {
    price?: number | null;
    sale_price?: number | null;
    sale_enabled?: boolean;
  }
): number {
  const price =
    safeNumber(
      input.price
    );

  const salePrice =
    safeNullableNumber(
      input.sale_price
    );

  /* =========================
     SALE OFF
  ========================= */

  if (
    !input.sale_enabled
  ) {
    return price;
  }

  /* =========================
     INVALID SALE
  ========================= */

  if (
    salePrice === null ||
    salePrice <= 0
  ) {
    return price;
  }

  if (
    salePrice >= price
  ) {
    return price;
  }

  /* =========================
     SALE ACTIVE
  ========================= */

  return salePrice;
}
