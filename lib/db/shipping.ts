import { query } from "@/lib/db";

/* =========================
   TYPES
========================= */

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
  zone_id: string;
  price: number;
};

/* =========================
   VALIDATE
========================= */

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

/* =========================
   UPSERT (PRODUCT BASED)
========================= */

export async function upsertShippingRates({
  productId,
  rates,
}: {
  productId: string;
  rates: ShippingRateInput[];
}) {
  if (!isUUID(productId)) {
    throw new Error("INVALID_PRODUCT");
  }

  if (!Array.isArray(rates)) return;

  const cleanRates = rates.filter(
    (r) =>
      r &&
      typeof r.zone === "string" &&
      typeof r.price === "number" &&
      !Number.isNaN(r.price) &&
      r.price >= 0 &&
      isValidRegion(r.zone_id)
  );

  /* ================= DELETE OLD ================= */

  await query(
    `
    DELETE FROM shipping_rates
    WHERE product_id = $1
    `,
    [productId]
  );

  if (!cleanRates.length) return;

  /* ================= BULK INSERT ================= */

  const values: unknown[] = [];
  const placeholders: string[] = [];

  let idx = 1;

  for (const r of cleanRates) {
    placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
    values.push(productId, r.zoneId, r.price);
  }

  await query(
    `
    INSERT INTO shipping_rates (product_id, zone_code, price)
    VALUES ${placeholders.join(",")}
    `,
    values
  );
}

/* =========================
   GET — SINGLE PRODUCT
========================= */

export async function getShippingRatesByProduct(
  productId: string
): Promise<ShippingRateInput[]> {
  if (!isUUID(productId)) {
    throw new Error("INVALID_PRODUCT");
  }

  const { rows } = await query<{
    zone_id: string;
    price: number;
  }>(
    `
    SELECT zone_id, price
    FROM shipping_rates
    WHERE product_id = $1
    `,
    [productId]
  );

  return rows
    .filter((r) => isValidRegion(r.zone_id))
    .map((r) => ({
      zone: r.zone_id,
      price: Number(r.price),
    }));
}

/* =========================
   GET — MULTIPLE PRODUCTS (🔥 QUAN TRỌNG)
========================= */

export async function getShippingRatesByProducts(
  productIds: string[]
): Promise<
  { product_id: string; zone: Region; price: number }[]
> {
  if (!Array.isArray(productIds)) return [];

  const validIds = productIds.filter(isUUID);

  if (!validIds.length) return [];

  const { rows } = await query<ShippingRateRow>(
    `
    SELECT product_id, zone_id, price
    FROM shipping_rates
    WHERE product_id = ANY($1::uuid[])
    `,
    [validIds]
  );

  return rows
    .filter((r) => isValidRegion(r.zone_id))
    .map((r) => ({
      product_id: r.product_id,
      zone: r.zone_id,
      price: Number(r.price),
    }));
}

/* =========================
   ZONE BY COUNTRY
========================= */

export async function getZoneByCountry(
  countryCode: string
): Promise<string | null> {
  if (!countryCode) return null;

  const { rows } = await query<{ code: string }>(
    `
    SELECT sz.code
    FROM shipping_zone_countries szc
    JOIN shipping_zones sz ON sz.id = szc.zone_id
    WHERE szc.country_code = $1
    LIMIT 1
    `,
    [countryCode.toUpperCase()]
  );

  return rows[0]?.code ?? null;
}
