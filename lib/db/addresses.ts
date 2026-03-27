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
