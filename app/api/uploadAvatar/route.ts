
import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // ==============================
    // 🔐 AUTH
    // ==============================
    const user = await getUserFromBearer(req);

    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 🔥 QUAN TRỌNG: lấy UUID từ DB
    const userRes = await query<{ id: string }>(
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
    // 📥 FILE
    // ==============================
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "INVALID_FILE" },
        { status: 400 }
      );
    }

    // ==============================
    // 📄 LOAD OLD AVATAR
    // ==============================
    const result = await query<{ avatar_url: string | null }>(
      `SELECT avatar_url FROM user_profiles WHERE user_id = $1`,
      [userId] // ✅ FIX
    );

    const oldAvatarUrl =
      result.rows.length > 0 ? result.rows[0].avatar_url : null;

    // ==============================
    // 🗑 DELETE OLD
    // ==============================
    if (oldAvatarUrl) {
      try {
        const url = new URL(oldAvatarUrl);
        await del(url.pathname);
      } catch (err) {
        console.warn("⚠️ Failed to delete old avatar:", err);
      }
    }

    // ==============================
    // ☁️ UPLOAD
    // ==============================
    const blob = await put(
      `avatars/${userId}-${Date.now()}`, // ✅ dùng UUID luôn
      file,
      {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      }
    );

    // ==============================
    // 💾 UPSERT
    // ==============================
    await query(
      `
      INSERT INTO user_profiles (user_id, avatar_url, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
      `,
      [userId, blob.url] // ✅ FIX
    );

    // ==============================
    // ✅ RESPONSE
    // ==============================
    return NextResponse.json({
      success: true,
      avatar: `${blob.url}?t=${Date.now()}`,
    });
  } catch (err) {
    console.error("❌ UPLOAD AVATAR ERROR:", err);
    return NextResponse.json(
      { error: "UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
