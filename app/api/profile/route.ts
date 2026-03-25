import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { blockedEmailDomains } from "@/data/validEmailDomains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= EMPTY PROFILE ================= */

function emptyProfile() {
  return {
    full_name: null,
    email: null,
    phone: null,
    avatar_url: null,
    bio: null,

    shop_name: null,
    shop_slug: null,
    shop_description: null,
    shop_banner: null,

    country: "",
    province: null,
    district: null,
    ward: null,
    address_line: null,
    postal_code: null,
  };
}

/* ================= EMAIL CHECK ================= */

function isValidEmail(email: string | null) {
  if (!email) return true;

  const parts = email.split("@");
  if (parts.length !== 2) return false;

  const domain = parts[1].toLowerCase();
  if (blockedEmailDomains.includes(domain)) return false;

  return true;
}

/* ================= GET ================= */

export async function GET() {
  const user = await getUserFromBearer();
  if (!user?.pi_uid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    // 🔥 map pi_uid → uuid
    const userRes = await query(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rowCount === 0) {
      return NextResponse.json({
        success: true,
        profile: emptyProfile(),
      });
    }

    const userId = userRes.rows[0].id;

    const { rows } = await query(
      `
      SELECT *
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    return NextResponse.json({
      success: true,
      profile: rows[0] ?? emptyProfile(),
    });
  } catch (err) {
    console.error("PROFILE GET ERROR:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

/* ================= POST ================= */

export async function POST(req: Request) {
  const user = await getUserFromBearer();
  if (!user?.pi_uid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;

  const normalize = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : null;

  const full_name = normalize(body.full_name, 100);
  const email = normalize(body.email, 100);
  const phone = normalize(body.phone, 20);
  const bio = normalize(body.bio, 500);

  const shop_name = normalize(body.shop_name, 120);
  const shop_description = normalize(body.shop_description, 500);

  const shop_banner =
    typeof body.shop_banner === "string" ? body.shop_banner : null;

  const country =
    typeof body.country === "string" && body.country
      ? body.country.trim().slice(0, 10)
      : "";

  const province = normalize(body.province, 100);
  const district = normalize(body.district, 100);
  const ward = normalize(body.ward, 100);
  const address_line = normalize(body.address_line, 255);
  const postal_code = normalize(body.postal_code, 20);

  const avatar_url =
    typeof body.avatar_url === "string" ? body.avatar_url : null;

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "INVALID_EMAIL_DOMAIN" },
      { status: 400 }
    );
  }

  try {
    // 🔥 map pi_uid → uuid
    const userRes = await query(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rowCount === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userId = userRes.rows[0].id;

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
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PROFILE SAVE ERROR:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
