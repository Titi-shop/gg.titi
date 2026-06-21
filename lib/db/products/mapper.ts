import type {
  ProductRow,
  ProductRecord,
} from "@/types/Product";

import {
  safeNumber,
  safeNullableNumber,
  normalizeImages,
} from "./helpers";
import { isSaleActive } from "@/lib/utils/sale";
/* =========================================================
   MAP DB ROW -> APP MODEL
========================================================= */

export function mapRow(
  row: ProductRow
): ProductRecord {
  const price =
    row.price == null
      ? null
      : safeNumber(row.price);

  const salePrice =
    row.sale_price == null
      ? null
      : safeNullableNumber(
          row.sale_price
        );

  const saleActive =
    isSaleActive(
      row.sale_enabled,
      salePrice,
      price,
      row.sale_start,
      row.sale_end
    );

  return {
    ...row,

    price:
      row.price == null
        ? null
        : safeNumber(
            row.price
          ),

    sale_price:
  saleActive
    ? salePrice
    : null,

final_price:
  saleActive
    ? Number(salePrice)
    : price,

    stock:
      row.stock == null
        ? null
        : safeNumber(
            row.stock
          ),

    sale_stock:
      row.sale_stock == null
        ? null
        : safeNumber(
            row.sale_stock
          ),

    sale_sold:
      safeNumber(
        row.sale_sold
      ),

    sold:
      safeNumber(
        row.sold
      ),

    views:
      safeNumber(
        row.views
      ),

    rating_avg:
      safeNumber(
        row.rating_avg
      ),

    rating_count:
      safeNumber(
        row.rating_count
      ),

    images:
      normalizeImages(
        row.images
      ),

    detail_images:
      normalizeImages(
        row.detail_images
      ),

    is_active:
      row.is_active === true,

    is_featured:
      row.is_featured === true,

    is_digital:
      row.is_digital === true,

    is_unlimited:
      row.is_unlimited === true,

    sale_enabled:
  saleActive,

    has_variants:
      row.has_variants === true,
  };
}
