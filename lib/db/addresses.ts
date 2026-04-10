import { query } from "@/lib/db";

/* =========================
   GET ADDRESSES
========================= */
export async function getAddressesByUser(
  userId: string
) {
  const res = await query(
    `
    SELECT *
    FROM addresses
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return res.rows;
}

/* =========================
   CREATE ADDRESS
========================= */
export async function createAddress(
  userId: string,
  data: {
    full_name: string;
    phone: string;
    country: string;
    province: string;
    district: string | null;
    ward: string | null;
    address_line: string;
    postal_code: string | null;
    label: string;
  }
) {
  await query(
    `UPDATE addresses SET is_default = false WHERE user_id = $1`,
    [userId]
  );

  const res = await query(
    `
    INSERT INTO addresses (
      user_id,
      full_name,
      phone,
      country,
      province,
      district,
      ward,
      address_line,
      postal_code,
      label,
      is_default
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
    RETURNING *
    `,
    [
      userId,
      data.full_name,
      data.phone,
      data.country,
      data.province,
      data.district,
      data.ward,
      data.address_line,
      data.postal_code,
      data.label,
    ]
  );

  return res.rows[0];
}

/* =========================
   SET DEFAULT
========================= */
export async function setDefaultAddress(
  userId: string,
  addressId: string
) {
  await query(
    `UPDATE addresses SET is_default = false WHERE user_id = $1`,
    [userId]
  );

  await query(
    `
    UPDATE addresses
    SET is_default = true
    WHERE id = $1 AND user_id = $2
    `,
    [addressId, userId]
  );
}

/* =========================
   DELETE
========================= */
export async function deleteAddress(
  userId: string,
  addressId: string
) {
  await query(
    `
    DELETE FROM addresses
    WHERE id = $1 AND user_id = $2
    `,
    [addressId, userId]
  );
}


/* =========================
   UPDATE ADDRESS
========================= */

interface UpdateAddressPayload {
  full_name: string;
  phone: string;
  country: string;
  province: string;
  address_line: string;
  postal_code?: string | null;
  label?: "home" | "office" | "other";
}

export async function updateAddress(
  userId: string,
  id: string,
  data: UpdateAddressPayload
) {
  const res = await query(
    `
    UPDATE addresses
    SET
      full_name = $1,
      phone = $2,
      country = $3,
      province = $4,
      address_line = $5,
      postal_code = $6,
      label = $7,
      updated_at = NOW()
    WHERE id = $8
      AND user_id = $9
    RETURNING *
    `,
    [
      data.full_name,
      data.phone,
      data.country,
      data.province,
      data.address_line,
      data.postal_code ?? null,
      data.label ?? "home",
      id,
      userId,
    ]
  );

  return res.rows[0] ?? null;
}
