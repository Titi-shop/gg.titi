import type {
  ProductVariantDB,
} from "@/types/product";

/* =========================================================
   TYPES
========================================================= */

export type VariantRow = Pick<
  ProductVariantDB,
  | "id"
  | "product_id"
  | "price"
  | "sale_price"
  | "final_price"
  | "stock"
  | "is_unlimited"
  | "is_active"
>;

export type VariantWithSaleWindow =
  ProductVariantDB & {
    sale_start: string | null;
    sale_end: string | null;
  };
