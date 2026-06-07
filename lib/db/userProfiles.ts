import { query } from "@/lib/db";

/* ================= GET ================= */
export async function getUserProfile(userId: string) {
  const res = await query(
    `
    SELECT *
    FROM user_profiles
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return res.rows[0] ?? null;
}

/* ================= UPSERT ================= */
export async function upsertUserProfile(
  userId: string,
  data: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    bio: string | null;

    shop_name: string | null;
    shop_description: string | null;
    shop_banner: string | null;

    country: string;
    province: string | null;
    district: string | null;
    ward: string | null;
    address_line: string | null;
    postal_code: string | null;
  }
) {
  await query(
    `
INSERT INTO user_profiles (
  user_id,
  full_name,
  email,
  phone,
  avatar_url,
  bio,

  shop_name,
  shop_description,
  shop_banner,

  country,
  province,
  district,
  ward,
  address_line,
  postal_code,

  created_at,
  updated_at
)
VALUES (
  $1,$2,$3,$4,$5,$6,
  $7,$8,$9,
  $10,$11,$12,$13,$14,$15,
  NOW(),NOW()
)
ON CONFLICT (user_id)
DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio,

  shop_name = EXCLUDED.shop_name,
  shop_description = EXCLUDED.shop_description,
  shop_banner = EXCLUDED.shop_banner,

  country = EXCLUDED.country,
  province = EXCLUDED.province,
  district = EXCLUDED.district,
  ward = EXCLUDED.ward,
  address_line = EXCLUDED.address_line,
  postal_code = EXCLUDED.postal_code,

  updated_at = NOW()
    `,
    [
      userId,
      data.full_name,
      data.email,
      data.phone,
      data.avatar_url,
      data.bio,

      data.shop_name,
      data.shop_description,
      data.shop_banner,

      data.country,
      data.province,
      data.district,
      data.ward,
      data.address_line,
      data.postal_code,
    ]
  );
}

/* ================= GET BANNER ================= */
export async function getUserShopBanner(userId: string) {
  const res = await query(
    `SELECT shop_banner FROM user_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  return res.rows[0]?.shop_banner ?? null;
}

/* ================= UPDATE BANNER ================= */
export async function updateShopBanner(
  userId: string,
  url: string
) {
  await query(
    `
    INSERT INTO user_profiles (user_id, shop_banner, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      shop_banner = EXCLUDED.shop_banner,
      updated_at = NOW()
    `,
    [userId, url]
  );
}




/* ================= GET AVATAR ================= */
export async function getUserAvatar(userId: string) {
  const res = await query(
    `SELECT avatar_url FROM user_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  return res.rows[0]?.avatar_url ?? null;
}

/* ================= UPDATE AVATAR ================= */
export async function updateAvatar(
  userId: string,
  url: string
) {
  await query(
    `
    INSERT INTO user_profiles (user_id, avatar_url, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
    `,
    [userId, url]
  );
}

