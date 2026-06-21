import { toUTCFromInput } from "@/lib/utils/time";

import type {
  ProductPayload,
  ProductVariant,
  ShippingRate,
} from "@/types/product";

type BuildPayloadParams = {
  form: any;

  variants: ProductVariant[];

  shippingRates: ShippingRate[];

  hasVariantSale: boolean;

  generateKey: () => string;
};

export function buildProductPayload({
  form,
  variants,
  shippingRates,
  hasVariantSale,
  generateKey,
}: BuildPayloadParams): ProductPayload {

  const hasVariants =
    variants.length > 0;

  const hasSaleTime =
    Boolean(form.sale_start) &&
    Boolean(form.sale_end);

  const hasSalePrice =
    form.sale_price !== "" &&
    form.sale_price !== null &&
    form.sale_price !== undefined;

  return {
    id:
      typeof form.id === "string"
        ? form.id
        : undefined,

    name: form.name,

    category_id:
      form.category_id !== "" &&
      form.category_id !== null &&
      form.category_id !== undefined
        ? Number(form.category_id)
        : undefined,

    description:
      form.description,

    detail:
      form.detail,

    images:
      form.images,

    thumbnail:
      form.images[0] || null,

    is_active:
      form.is_active,

    has_variants:
      hasVariants,

    shipping_rates:
      shippingRates,

    domestic_country_code:
      form.domestic_country_code || null,

    price:
      hasVariants
        ? undefined
        : Number(form.price),

    stock:
      hasVariants
        ? undefined
        : Number(
            form.stock || 0
          ),

    sale_enabled:
      hasVariants
        ? hasVariantSale
        : (
            form.sale_enabled &&
            hasSaleTime &&
            hasSalePrice
          ),

    sale_price:
      hasVariants
        ? null
        : !form.sale_enabled
          ? null
          : Number(
              form.sale_price
            ),

    sale_stock:
      hasVariants ||
      !form.sale_enabled
        ? 0
        : Number(
            form.sale_stock || 0
          ),

    sale_start:
      hasSaleTime
        ? toUTCFromInput(
            form.sale_start
          )
        : null,

    sale_end:
      hasSaleTime
        ? toUTCFromInput(
            form.sale_end
          )
        : null,

    variants,

    idempotency_key:
      generateKey(),
  };
}
