import type {
  ProductVariant,
  ProductVariantDB,
} from "@/types/product";

import {
  safeNumber,
  safeNullableNumber,
  trimOrNull,
  buildVariantName,
  calcFinalPrice,
} from "./helpers";

/* =========================================================
   MAP DB -> APP
========================================================= */

export function mapVariantToApp(
  row: ProductVariantDB
): ProductVariant {
  const price =
    safeNumber(row.price);

  const salePrice =
    safeNullableNumber(
      row.sale_price
    );

  const saleEnabled =
    Boolean(
      row.sale_enabled
    ) &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price;

  const finalPrice =
    safeNumber(
      row.final_price
    );

  if (
    !Number.isFinite(
      finalPrice
    ) ||
    finalPrice <= 0
  ) {
    throw new Error(
      "VARIANT_FINAL_PRICE_CORRUPTED"
    );
  }

  return {
    id: row.id,

    option1:
      row.option_1 ?? "",

    option2:
      row.option_2,

    option3:
      row.option_3,

    option_label1:
      row.option_label_1,

    option_label2:
      row.option_label_2,

    option_label3:
      row.option_label_3,

    name:
      row.name ||
      buildVariantName({
        option1:
          row.option_1 ?? "",
        option2:
          row.option_2,
        option3:
          row.option_3,
      }),

    sku: row.sku,

    price,

    sale_price:
      saleEnabled
        ? salePrice
        : null,

    final_price:
  calcFinalPrice(
    price,
    salePrice,
    saleEnabled
  ),

    currency: "PI",

    sale_enabled:
      saleEnabled,

    sale_stock:
      safeNumber(
        row.sale_stock
      ),

    sale_sold:
      safeNumber(
        row.sale_sold
      ),

    stock:
      safeNumber(
        row.stock
      ),

    is_unlimited:
      Boolean(
        row.is_unlimited
      ),

    image: row.image,

    is_active:
      Boolean(
        row.is_active
      ),

    sort_order:
      safeNumber(
        row.sort_order
      ),

    sold:
      safeNumber(
        row.sold
      ),
  };
}

/* =========================================================
   MAP APP -> DB
========================================================= */

export function mapVariantToDB(
  variant: ProductVariant,
  productId: string,
  sortOrder: number
): ProductVariantDB {
  const price =
    safeNumber(
      variant.price
    );

  if (price <= 0) {
    throw new Error(
      "INVALID_VARIANT_PRICE"
    );
  }

  const salePrice =
    safeNullableNumber(
      variant.sale_price
    );
  const stock =
  safeNumber(
    variant.stock
  );

const saleStock =
  Math.min(
    safeNumber(
      variant.sale_stock
    ),
    stock
  );

  const saleEnabled =
    Boolean(
      variant.sale_enabled
    ) &&
    salePrice !== null &&
    salePrice > 0 &&
    salePrice < price;

  return {
    id: variant.id,

    product_id:
      productId,

    option_1:
      trimOrNull(
        variant.option1
      ),

    option_2:
      trimOrNull(
        variant.option2
      ),

    option_3:
      trimOrNull(
        variant.option3
      ),

    option_label_1:
      trimOrNull(
        variant.option_label1
      ),

    option_label_2:
      trimOrNull(
        variant.option_label2
      ),

    option_label_3:
      trimOrNull(
        variant.option_label3
      ),

    name:
      trimOrNull(
        variant.name
      ) ??
      buildVariantName(
        variant
      ),

    sku:
      trimOrNull(
        variant.sku
      ),

    price,

    sale_price:
      saleEnabled
        ? salePrice
        : null,

    final_price:
      calcFinalPrice(
        price,
        salePrice,
        saleEnabled
      ),

    sale_enabled:
      saleEnabled,

    stock,
sale_stock:
  saleEnabled
    ? saleStock
    : 0,

    sale_sold:
      safeNumber(
        variant.sale_sold
      ),

    currency: "PI",

    stock:
      safeNumber(
        variant.stock
      ),

    is_unlimited:
      Boolean(
        variant.is_unlimited
      ),

    image:
      variant.image ?? "",

    is_active:
      variant.is_active !==
      false,

    sort_order:
      safeNumber(
        sortOrder
      ),

    sold:
      safeNumber(
        variant.sold
      ),

    created_at:
      undefined,

    updated_at:
      undefined,

    deleted_at:
      null,
  };
}
