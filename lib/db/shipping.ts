import { query } from "@/lib/db";

export async function upsertShippingRates({
  sellerId,
  rates,
}: {
  sellerId: string;
  rates: { zone: string; price: number }[];
}) {
  if (!sellerId) throw new Error("INVALID_USER");

  for (const r of rates) {
    if (!r.zone || typeof r.price !== "number") continue;

    const zoneRes = await query<{ id: string }>(
      `select id from shipping_zones where code = $1 limit 1`,
      [r.zone]
    );

    if (zoneRes.rowCount === 0) continue;

    const zoneId = zoneRes.rows[0].id;

    await query(
      `
      insert into shipping_rates (zone_id, seller_id, price)
      values ($1,$2,$3)
      on conflict (zone_id, seller_id)
      do update set price = excluded.price
      `,
      [zoneId, sellerId, r.price]
    );
  }
}
