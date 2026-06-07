import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { requireAuth } from "@/lib/auth/guard";

import {
  getUserAvatar,
  updateAvatar,
} from "@/lib/db/userProfiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

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

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE" },
        { status: 400 }
      );
    }

    /* ================= GET OLD ================= */
    const oldAvatarUrl = await getUserAvatar(userId);

    /* ================= DELETE OLD ================= */
    if (oldAvatarUrl) {
      try {
        const url = new URL(oldAvatarUrl);
        await del(url.pathname);
      } catch {
        console.warn("[AVATAR] DELETE_OLD_FAILED");
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

    return NextResponse.json({
      success: true,
      avatar: `${blob.url}?t=${Date.now()}`,
    });

  } catch {
    console.error("[AVATAR] UPLOAD_FAILED");

    return NextResponse.json(
      { error: "UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
