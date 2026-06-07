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
  domestic_country_code?: string | null;
};

type ShippingRateRow = {
  product_id: string;
  zone: string;
  code: string;
  price: number;
  domestic_country_code: string | null;
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
  console.log("\n🚀 [SHIPPING][UPSERT] START");
  console.log("📌 productId:", productId);
  console.log("📦 input rates:", rates);

  if (!isUUID(productId)) {
    console.error("❌ INVALID_PRODUCT_ID");
    throw new Error("INVALID_PRODUCT_ID");
  }

  if (!Array.isArray(rates) || rates.length === 0) {
    console.warn("⚠️ EMPTY RATES -> SKIP UPSERT");
    return;
  }

  /* ================= CLEAN ================= */
  const cleanRates = rates.filter((r) => {
    const ok =
      r &&
      typeof r.zone === "string" &&
      typeof r.price === "number" &&
      !Number.isNaN(r.price) &&
      r.price >= 0 &&
      isValidRegion(r.zone);

    if (!ok) {
      console.warn("⚠️ INVALID RATE SKIPPED:", r);
    }

    return ok;
  });

  console.log("🧼 CLEAN RATES:", cleanRates);

  /* ================= DELETE OLD ================= */
  console.log("🗑️ DELETE old shipping_rates...");
  await query(
    `DELETE FROM shipping_rates WHERE product_id = $1`,
    [productId]
  );

  if (cleanRates.length === 0) {
    console.warn("⚠️ NO VALID RATES AFTER CLEAN -> STOP");
    return;
  }

  /* ================= GET ZONES ================= */
  const zones = cleanRates.map((r) => r.zone);

  console.log("🌍 LOOKUP ZONES:", zones);

  const zoneRes = await query<{ id: string; code: string }>(
    `
    SELECT id, code
    FROM shipping_zones
    WHERE code = ANY($1)
    `,
    [zones]
  );

  console.log("🧠 DB ZONES FOUND:", zoneRes.rows);

  if (zoneRes.rows.length === 0) {
    console.error("❌ NO SHIPPING_ZONES FOUND IN DB");
    return;
  }

  const zoneMap = new Map(zoneRes.rows.map((z) => [z.code, z.id]));

  console.log("🧩 ZONE MAP:", [...zoneMap.entries()]);

  /* ================= BUILD INSERT ================= */
  const rows: string[] = [];
  const values: unknown[] = [];

  for (const r of cleanRates) {
    const zoneId = zoneMap.get(r.zone);

    if (!zoneId) {
      console.error("❌ MISSING zoneId for zone:", r.zone);
      continue;
    }

    const isDomestic = r.zone === "domestic";

    rows.push(
      `($${values.length + 1}, $${values.length + 2}, $${values.length + 3}, $${values.length + 4})`
    );

    values.push(
      productId,
      zoneId,
      r.price,
      isDomestic ? r.domestic_country_code ?? null : null
    );
  }

  console.log("🧱 INSERT ROWS COUNT:", rows.length);
  console.log("📦 VALUES:", values);

  /* ================= SAFETY CHECK ================= */
  if (rows.length === 0) {
    console.error("❌ NO VALID ROWS TO INSERT (ZONE MAP FAILED)");
    return;
  }

  /* ================= INSERT ================= */
  const result = await query(
    `
    INSERT INTO shipping_rates (
      product_id,
      zone_id,
      price,
      domestic_country_code
    )
    VALUES ${rows.join(",")}
    `,
    values
  );

  console.log("✅ INSERT DONE");
  console.log("📊 ROWS AFFECTED:", result.rowCount);

  if (!result.rowCount) {
    console.error("❌ INSERT FAILED OR ZERO ROWS INSERTED");
  }

  console.log("🎉 [SHIPPING][UPSERT] SUCCESS\n");
}

/* =====================================================
   GET SHIPPING RATES BY PRODUCT
===================================================== */
export async function getShippingRatesByProduct(
  productId: string
) {
  console.log(
    "\n🚀 [SHIPPING][GET_BY_PRODUCT] ===== START ====="
  );

  try {
    console.log(
      "📥 Product ID:",
      productId
    );

    if (!isUUID(productId)) {
      console.error(
        "❌ INVALID_PRODUCT_ID:",
        productId
      );

      throw new Error(
        "INVALID_PRODUCT_ID"
      );
    }

    console.log(
      "🗄️ Preparing shipping query..."
    );

    const sql = `
      SELECT
        sr.product_id,
        sz.code AS zone,
        sr.price,
        sr.domestic_country_code
      FROM shipping_rates sr
      JOIN shipping_zones sz
        ON sz.id = sr.zone_id
      WHERE sr.product_id = $1
    `;

    console.log(
      "📜 SQL:",
      sql
    );

    console.log(
      "📦 SQL PARAMS:",
      [productId]
    );

    const { rows } =
      await query<ShippingRateRow>(
        sql,
        [productId]
      );

    console.log(
      "✅ Shipping query success"
    );

    console.log(
      "📊 Raw rows count:",
      rows.length
    );

    console.log(
      "📦 RAW DB ROWS:",
      rows
    );

    console.log(
      "🔎 Filtering valid regions..."
    );

    const filtered = rows.filter((r) =>
      isValidRegion(r.zone)
    );

    console.log(
      "✅ Valid region rows:",
      filtered
    );

    console.log(
      "🧩 Mapping shipping rows..."
    );

    const mapped = filtered.map(
      (r) => ({
        zone: r.zone as Region,
        price: Number(r.price),
        domestic_country_code:
          r.domestic_country_code,
      })
    );

    console.log(
      "🎯 FINAL SHIPPING RESULT:",
      mapped
    );

    console.log(
      "📊 Final shipping count:",
      mapped.length
    );

    console.log(
      "🏁 [SHIPPING][GET_BY_PRODUCT] ===== SUCCESS =====\n"
    );

    return mapped;
  } catch (error) {
    console.error(
      "💥 [SHIPPING][GET_BY_PRODUCT] ERROR:",
      error
    );

    throw error;
  }
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
    domestic_country_code?: string | null;
  }[]
> {
  const validIds = productIds.filter(isUUID);
  if (!validIds.length) return [];

  const { rows } = await query<ShippingRateRow>(
    `
    SELECT
      sr.product_id,
      sz.code,
      sr.price,
      sr.domestic_country_code
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
      zone: r.zone as Region,
      price: Number(r.price),
      domestic_country_code: r.domestic_country_code,
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
    ORDER BY sz.id
    LIMIT 1
    `,
    [countryCode.toUpperCase()]
  );

  const code = rows[0]?.code;

  return isValidRegion(code) ? code : null;
}

/* =========================================================
   SHIPPING RESOLVER (FINAL FIXED)
========================================================= */
export async function resolveShippingRateForBuyer({
  productId,
  buyerCountryCode,
}: {
  productId: string;
  buyerCountryCode: string;
}): Promise<{
  zone: Region;
  price: number;
}> {
  const rates = await getShippingRatesByProduct(productId);

  if (!rates.length) {
    throw new Error("SHIPPING_NOT_AVAILABLE");
  }

  const buyer = buyerCountryCode.toUpperCase();

  const domestic = rates.find(
    (r) =>
      r.zone === "domestic" &&
      r.domestic_country_code?.toUpperCase() === buyer
  );

  if (domestic) {
    return {
      zone: "domestic",
      price: domestic.price,
    };
  }

  const buyerZone = await getZoneByCountry(buyer);

  if (buyerZone) {
    const zoneRate = rates.find(
      (r) => r.zone === buyerZone
    );

    if (zoneRate) {
      return {
        zone: buyerZone,
        price: zoneRate.price,
      };
    }
  }

  const globalRate = rates.find(
    (r) => r.zone === "rest_of_world"
  );

  if (globalRate) {
    return {
      zone: "rest_of_world",
      price: globalRate.price,
    };
  }

  throw new Error("SHIPPING_NOT_AVAILABLE");
}
