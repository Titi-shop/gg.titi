// app/api/uploadShopBanner/route.ts
import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
};

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // ==============================
    // 🔐 AUTH
    // ==============================
    const user = await getUserFromBearer(req);

    if (!user?.pi_uid) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // ==============================
    // 🔥 MAP pi_uid → userId (UUID)
    // ==============================
    const userRes = await query<UserRow>(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const userId = userRes.rows[0].id;

    // ==============================
    // 📥 READ FILE
    // ==============================
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "INVALID_FILE" },
        { status: 400 }
      );
    }

    // (optional nhưng nên có)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    // ==============================
    // 📄 LOAD CURRENT BANNER
    // ==============================
    const result = await query<{ shop_banner: string | null }>(
      `SELECT shop_banner FROM user_profiles WHERE user_id = $1`,
      [userId] // ✅ FIX
    );

    const oldBanner =
      result.rows.length > 0 ? result.rows[0].shop_banner : null;

    // ==============================
    // 🗑 DELETE OLD
    // ==============================
    if (oldBanner) {
      try {
        const url = new URL(oldBanner);
        await del(url.pathname);
      } catch (err) {
        console.warn("⚠️ Failed to delete old banner:", err);
      }
    }

    // ==============================
    // ☁️ UPLOAD
    // ==============================
    const blob = await put(
      `shop-banners/${userId}-${Date.now()}`, // ✅ dùng UUID
      file,
      {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      }
    );

    // ==============================
    // 💾 UPSERT PROFILE
    // ==============================
    await query(
      `
      INSERT INTO user_profiles (user_id, shop_banner, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        shop_banner = EXCLUDED.shop_banner,
        updated_at = NOW()
      `,
      [userId, blob.url] // ✅ FIX
    );

    // ==============================
    // ✅ RESPONSE
    // ==============================
    return NextResponse.json({
      success: true,
      banner: `${blob.url}?t=${Date.now()}`,
    });

  } catch (err) {
    console.error("❌ UPLOAD SHOP BANNER ERROR:", err);

    return NextResponse.json(
      { error: "UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
