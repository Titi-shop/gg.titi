"use server";

import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

export type Region =
  | "domestic"
  | "sea"
  | "asia"
  | "europe"
  | "north_america"
  | "rest_of_world";

export type ShippingRateInput = {
  zone: Region;
  price: number;
};

type ShippingRateRow = {
  product_id: string;
  code: string;
  price: number;
};

/* =========================================================
   VALIDATE
========================================================= */

function isUUID(v: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(v);
}

function isValidRegion(value: string): value is Region {
  return [
    "domestic",
    "sea",
    "asia",
    "europe",
    "north_america",
    "rest_of_world",
  ].includes(value);
}

/* =========================================================
   UPSERT SHIPPING RATES
========================================================= */

export async function upsertShippingRates({
  productId,
  rates,
}: {
  productId: string;
  rates: ShippingRateInput[];
}) {
  console.log("🚀 [DB][SHIPPING][UPSERT] START");

  if (!isUUID(productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  if (!Array.isArray(rates)) return;

  const cleanRates = rates.filter((r) => {
    return (
      r &&
      typeof r.zone === "string" &&
      typeof r.price === "number" &&
      !Number.isNaN(r.price) &&
      r.price >= 0 &&
      isValidRegion(r.zone)
    );
  });

  console.log("📦 CLEAN:", cleanRates);

  /* DELETE OLD */
  await query(
    `
    DELETE FROM shipping_rates
    WHERE product_id = $1
    `,
    [productId]
  );

  if (!cleanRates.length) return;

  /* GET ZONES */
  const zoneRes = await query<{ id: string; code: string }>(
    `
    SELECT id, code
    FROM shipping_zones
    WHERE code = ANY($1)
    `,
    [cleanRates.map((r) => r.zone)]
  );

  const zoneMap = new Map(zoneRes.rows.map((z) => [z.code, z.id]));

  const placeholders: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const r of cleanRates) {
    const zoneId = zoneMap.get(r.zone);
    if (!zoneId) continue;

    placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);

    values.push(productId, zoneId, r.price);
  }

  if (!values.length) return;

  await query(
    `
    INSERT INTO shipping_rates (
      product_id,
      zone_id,
      price
    )
    VALUES ${placeholders.join(",")}
    `,
    values
  );

  console.log("🎉 SHIPPING UPSERT DONE");
}

/* =========================================================
   GET SHIPPING BY PRODUCT
========================================================= */

export async function getShippingRatesByProduct(
  productId: string
): Promise<ShippingRateInput[]> {
  console.log("🚀 [DB][SHIPPING][GET]", productId);

  if (!isUUID(productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const { rows } = await query<ShippingRateRow>(
    `
    SELECT
      sr.product_id,
      sz.code,
      sr.price
    FROM shipping_rates sr
    JOIN shipping_zones sz
      ON sz.id = sr.zone_id
    WHERE sr.product_id = $1
    `,
    [productId]
  );

  const result = rows
    .filter((r) => isValidRegion(r.code))
    .map((r) => ({
      zone: r.code as Region,
      price: Number(r.price),
    }));

  console.log("✅ RESULT:", result);

  return result;
}

/* =========================================================
   GET MULTI PRODUCTS
========================================================= */

export async function getShippingRatesByProducts(
  productIds: string[]
): Promise<
  {
    product_id: string;
    zone: Region;
    price: number;
  }[]
> {
  const validIds = productIds.filter(isUUID);
  if (!validIds.length) return [];

  const { rows } = await query<ShippingRateRow>(
    `
    SELECT
      sr.product_id,
      sz.code,
      sr.price
    FROM shipping_rates sr
    JOIN shipping_zones sz
      ON sz.id = sr.zone_id
    WHERE sr.product_id = ANY($1::uuid[])
    `,
    [validIds]
  );

  return rows
    .filter((r) => isValidRegion(r.code))
    .map((r) => ({
      product_id: r.product_id,
      zone: r.code as Region,
      price: Number(r.price),
    }));
}

/* =========================================================
   COUNTRY → ZONE
========================================================= */

export async function getZoneByCountry(
  countryCode: string
): Promise<Region | null> {
  if (!countryCode) return null;

  const { rows } = await query<{ code: string }>(
    `
    SELECT sz.code
    FROM shipping_zone_countries szc
    JOIN shipping_zones sz
      ON sz.id = szc.zone_id
    WHERE szc.country_code = $1
    LIMIT 1
    `,
    [countryCode.toUpperCase()]
  );

  const code = rows[0]?.code;

  return isValidRegion(code) ? code : null;
}

/* =========================================================
   SHIPPING RESOLVER (SHOPIFY STYLE)
========================================================= */

export async function resolveShippingPrice({
  productId,
  buyerCountryCode,
}: {
  productId: string;
  buyerCountryCode: string;
}): Promise<number> {
  console.log("🚀 RESOLVE SHIPPING");

  const rates = await getShippingRatesByProduct(productId);

  if (!rates.length) return 0;

  const zone = await getZoneByCountry(
    buyerCountryCode.toUpperCase()
  );

  console.log("🌍 ZONE:", zone);

  /* MATCH ZONE */
  if (zone) {
    const match = rates.find((r) => r.zone === zone);
    if (match) {
      console.log("✅ MATCH:", match.price);
      return match.price;
    }
  }

  /* FALLBACK */
  const fallback = rates.find(
    (r) => r.zone === "rest_of_world"
  );

  console.log("🌎 FALLBACK:", fallback?.price || 0);

  return fallback?.price || 0;
}
