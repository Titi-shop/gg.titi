import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { query } from "@/lib/db";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import {
  getUserAvatar,
  updateAvatar,
} from "@/lib/db/userProfiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    /* ================= AUTH ================= */
    const user = await getUserFromBearer(req);

    if (!user?.pi_uid) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    /* ================= MAP USER ================= */
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

    /* ================= FILE ================= */
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "INVALID_FILE" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    /* ================= LOAD OLD ================= */
    const oldAvatarUrl = await getUserAvatar(userId);

    /* ================= DELETE OLD ================= */
    if (oldAvatarUrl) {
      try {
        const url = new URL(oldAvatarUrl);
        await del(url.pathname);
      } catch (err) {
        console.warn("⚠️ Failed to delete old avatar:", err);
      }
    }

    /* ================= UPLOAD ================= */
    const blob = await put(
      `avatars/${userId}-${Date.now()}`,
      file,
      {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      }
    );

    /* ================= SAVE ================= */
    await updateAvatar(userId, blob.url);

    /* ================= RESPONSE ================= */
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
