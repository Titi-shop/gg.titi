// lib/db/orders.preview.ts

import { query } from "@/lib/db";

type PreviewItemInput = {
  product_id: string;
  quantity: number;
};

type PreviewOrderInput = {
  userId: string;
  items: PreviewItemInput[];
  country: string;
  zone: string;
};

type PreviewOrderResult = {
  items: {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
  }[];
  subtotal: number;
  shipping_fee: number;
  total: number;
};

export async function previewOrder(
  input: PreviewOrderInput
): Promise<PreviewOrderResult> {
  const { userId, items, country, zone } = input;

  if (!userId) throw new Error("INVALID_USER");
  if (!country) throw new Error("MISSING_COUNTRY");
  if (!zone) throw new Error("MISSING_REGION");

  const { rows: zoneRows } = await query<{ code: string }>(
    `
    SELECT sz.code
    FROM shipping_zone_countries szc
    JOIN shipping_zones sz ON sz.id = szc.zone_id
    WHERE szc.country_code = $1
    LIMIT 1
    `,
    [country.toUpperCase()]
  );

  if (!zoneRows.length) {
    throw new Error("INVALID_COUNTRY");
  }

  const realZone = zoneRows[0].code;

  if (zone !== realZone) {
    throw new Error("INVALID_REGION");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("INVALID_ITEMS");
  }

  const productIds = items.map((i) => i.product_id);

  const { rows: products } = await query<{
    id: string;
    name: string;
    price: number;
  }>(
    `
    SELECT id, name, price
    FROM products
    WHERE id = ANY($1::uuid[])
    `,
    [productIds]
  );

  if (!products.length) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;

  const previewItems = items.map((item) => {
    const p = productMap.get(item.product_id);

    if (!p) throw new Error("INVALID_PRODUCT");

    const qty =
      typeof item.quantity === "number" && item.quantity > 0
        ? item.quantity
        : 1;

    const total = Number(p.price) * qty;

    subtotal += total;

    return {
      product_id: p.id,
      name: p.name,
      price: Number(p.price),
      quantity: qty,
      total,
    };
  });

  const { rows: shippingRows } = await query<{
    product_id: string;
    price: number;
  }>(
    `
    SELECT sr.product_id, sr.price
    FROM shipping_rates sr
    JOIN shipping_zones sz ON sz.id = sr.zone_id
    WHERE sr.product_id = ANY($1::uuid[])
      AND sz.code = $2
    `,
    [productIds, realZone]
  );

  if (!shippingRows.length) {
    throw new Error("SHIPPING_NOT_AVAILABLE");
  }

  const shippingMap = new Map(
    shippingRows.map((r) => [r.product_id, Number(r.price)])
  );

  const firstItem = items[0];

  const shippingPrice = shippingMap.get(firstItem.product_id);

  if (shippingPrice === undefined) {
    throw new Error("SHIPPING_NOT_AVAILABLE");
  }

  const shippingFee = shippingPrice;

  return {
    items: previewItems,
    subtotal,
    shipping_fee: shippingFee,
    total: subtotal + shippingFee,
  };
}
