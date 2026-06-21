"use client";

import {
  validateProductSale,
  validateVariantSale,
} from "./product-form.validation";

import {
  buildProductPayload,
  normalizeVariants,
} from "./product-form.payload";

import {
  showMessage,
} from "./product-notify";

export async function submitProductForm({
  form,
  t,
  setErrors,
  onSubmit,
}: any) {

  if (!form.name.trim()) {
    setErrors({
      name: true,
    });

    return;
  }

  if (
    !form.category_id ||
    Number(form.category_id) <= 0
  ) {
    setErrors({
      category: true,
    });

    return;
  }

  if (!form.images.length) {
    setErrors({
      images: true,
    });

    return;
  }

  const normalizedVariants =
    normalizeVariants(
      form.variants
    );

  const productSaleError =
    validateProductSale(
      Boolean(
        form.sale_enabled
      ),
      Number(form.price),
      Number(form.sale_price),
      Number(form.sale_stock),
      form.sale_start,
      form.sale_end
    );

  if (productSaleError) {
    showMessage(
      t[
        productSaleError.toLowerCase() as keyof typeof t
      ] ?? productSaleError
    );

    return;
  }

  const variantSaleError =
    validateVariantSale(
      normalizedVariants,
      form.sale_start,
      form.sale_end
    );

  if (variantSaleError) {
    showMessage(
      t[
        variantSaleError.toLowerCase() as keyof typeof t
      ] ?? variantSaleError
    );

    return;
  }

  const shippingRates =
    Object.entries(
      form.shipping_rates
    ).map(([zone, price]) => ({
      zone,
      price: Number(price || 0),
      domestic_country_code:
        zone === "domestic"
          ? form.domestic_country_code
          : null,
    }));

  const hasVariantSale =
    normalizedVariants.some(
      (variant) =>
        Boolean(
          variant.sale_enabled
        ) &&
        Number(
          variant.sale_price
        ) > 0
    );

  const payload =
    buildProductPayload({
      form,
      variants:
        normalizedVariants,
      shippingRates,
      hasVariantSale,
      generateKey: () =>
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
    });

  await onSubmit(
    payload
  );
}
