                  import { query } from "@/lib/db";

/* =========================================================
   TYPES (MATCH DB SCHEMA)
========================================================= */

export type SellerAddressType =
  | "return"
  | "warehouse"
  | "pickup"
  | "support";

export interface SellerAddress {
  id: string;
  seller_id: string;

  type: SellerAddressType;

  recipient_name: string | null;
  phone: string | null;

  country: string;

  region: string | null;
  district: string | null;
  ward: string | null;

  address_line: string;
  postal_code: string | null;

  latitude: number | null;
  longitude: number | null;
  place_id: string | null;

  is_default: boolean;
  is_verified: boolean;
  is_active: boolean;

  note: string | null;

  created_at: string;
  updated_at: string;
}

/* =========================================================
   INPUT TYPES
========================================================= */

export type CreateSellerAddressInput = {
  seller_id: string;

  type: SellerAddressType;

  recipient_name?: string | null;
  phone?: string | null;

  country?: string;

  region?: string | null;
  district?: string | null;
  ward?: string | null;

  address_line: string;
  postal_code?: string | null;

  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;

  is_default?: boolean;
  is_verified?: boolean;
  is_active?: boolean;

  note?: string | null;
};

export type UpdateSellerAddressInput = {
  type: SellerAddressType;

  recipient_name?: string | null;
  phone?: string | null;

  country?: string;

  region?: string | null;
  district?: string | null;
  ward?: string | null;

  address_line: string;
  postal_code?: string | null;

  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;

  is_default?: boolean;
  is_verified?: boolean;
  is_active?: boolean;

  note?: string | null;
};

/* =========================================================
   LOG HELPERS
========================================================= */

const log = (action: string, data?: unknown) => {
  console.log(
    `[seller_addresses] ${action}`,
    data ? JSON.stringify(data) : ""
  );
};

const logError = (action: string, error: unknown) => {
  console.error(`[seller_addresses ERROR] ${action}`, error);
};

/* =========================================================
   GET
========================================================= */

export async function getSellerAddresses(
  sellerId: string
): Promise<SellerAddress[]> {
  try {
    log("GET_START", { sellerId });

    const res = await query<SellerAddress>(
      `SELECT *
       FROM seller_addresses
       WHERE seller_id = $1 AND deleted_at IS NULL
       ORDER BY is_default DESC, created_at DESC`,
      [sellerId]
    );

    log("GET_SUCCESS", { count: res.rows.length });

    return res.rows;
  } catch (error) {
    logError("GET_FAIL", error);
    throw error;
  }
}

/* =========================================================
   CREATE
========================================================= */

export async function createSellerAddress(
  payload: CreateSellerAddressInput
): Promise<SellerAddress> {
  try {
    log("CREATE_START", { seller_id: payload.seller_id });

    const res = await query<SellerAddress>(
      `INSERT INTO seller_addresses (
        seller_id,
        type,
        recipient_name,
        phone,
        country,
        region,
        district,
        ward,
        address_line,
        postal_code,
        latitude,
        longitude,
        place_id,
        is_default,
        is_verified,
        is_active,
        note
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17
      )
      RETURNING *`,
      [
        payload.seller_id,
        payload.type,

        payload.recipient_name ?? "",
        payload.phone ?? "",

        payload.country ?? "VN",

        payload.region ?? null,
        payload.district ?? null,
        payload.ward ?? null,

        payload.address_line,
        payload.postal_code ?? null,

        payload.latitude ?? null,
        payload.longitude ?? null,
        payload.place_id ?? null,

        payload.is_default ?? false,
        payload.is_verified ?? false,
        payload.is_active ?? true,

        payload.note ?? null,
      ]
    );

    const created = res.rows[0];

    log("CREATE_SUCCESS", { id: created.id });

    return created;
  } catch (error) {
    logError("CREATE_FAIL", error);
    throw error;
  }
}

/* =========================================================
   UPDATE
========================================================= */

export async function updateSellerAddress(
  id: string,
  payload: UpdateSellerAddressInput
): Promise<SellerAddress> {
  try {
    log("UPDATE_START", { id });

    const res = await query<SellerAddress>(
      `UPDATE seller_addresses
       SET type = $1,
           recipient_name = $2,
           phone = $3,
           country = $4,
           region = $5,
           district = $6,
           ward = $7,
           address_line = $8,
           postal_code = $9,
           latitude = $10,
           longitude = $11,
           place_id = $12,
           is_default = $13,
           is_verified = $14,
           is_active = $15,
           note = $16,
           updated_at = NOW()
       WHERE id = $17 AND deleted_at IS NULL
       RETURNING *`,
      [
        payload.type,

        payload.recipient_name ?? "",
        payload.phone ?? "",

        payload.country ?? "VN",

        payload.region ?? null,
        payload.district ?? null,
        payload.ward ?? null,

        payload.address_line,
        payload.postal_code ?? null,

        payload.latitude ?? null,
        payload.longitude ?? null,
        payload.place_id ?? null,

        payload.is_default ?? false,
        payload.is_verified ?? false,
        payload.is_active ?? true,

        payload.note ?? null,

        id,
      ]
    );

    const updated = res.rows[0];

    log("UPDATE_SUCCESS", { id });

    return updated;
  } catch (error) {
    logError("UPDATE_FAIL", error);
    throw error;
  }
}

/* =========================================================
   DELETE (SOFT DELETE SAFE)
========================================================= */

export async function deleteSellerAddress(
  id: string
): Promise<boolean> {
  try {
    log("DELETE_START", { id });

    await query(
      `UPDATE seller_addresses
       SET deleted_at = NOW()
       WHERE id = $1`,
      [id]
    );

    log("DELETE_SUCCESS", { id });

    return true;
  } catch (error) {
    logError("DELETE_FAIL", error);
    throw error;
  }
}
