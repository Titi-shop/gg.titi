import type {
  Category,
  ProductPayload,
} from "@/types/product";

/* =========================
   PROPS
========================= */

export interface ProductFormProps {
  categories: Category[];

  initialData?:
    Partial<ProductPayload>;

  onSubmit: (
    payload: ProductPayload
  ) => Promise<void>;
}

/* =========================
   ERRORS
========================= */

export interface ProductFormErrors {
  name?: boolean;

  category?: boolean;

  images?: boolean;

  price?: boolean;

  sale_price?: boolean;

  sale_stock?: boolean;

  sale_start?: boolean;

  sale_end?: boolean;
}

/* =========================
   UPLOAD URL
========================= */

export interface SignedUrlResponse {
  uploadUrl: string;

  publicUrl: string;
}
