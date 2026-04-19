import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/* =====================================================
   POST /api/returns/upload-url (RETURN IMAGE)
===================================================== */

export async function POST(): Promise<NextResponse> {
  console.log("🚀 [UPLOAD][RETURN] START");

  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();

    if (!auth.ok) {
      console.error("❌ [UPLOAD][RETURN] UNAUTHORIZED");
      return auth.response;
    }

    const userId = auth.userId;

    console.log("👤 [UPLOAD][RETURN] USER:", userId);

    /* ================= VALIDATE ================= */
    if (!userId || typeof userId !== "string") {
      console.error("❌ [UPLOAD][RETURN] INVALID_USER_ID");
      return NextResponse.json(
        { error: "INVALID_USER" },
        { status: 400 }
      );
    }

    /* ================= PATH ================= */
    const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;
    const filePath = `returns/${userId}/${fileName}`;

    console.log("📂 [UPLOAD][RETURN] PATH:", filePath);

    /* ================= SIGNED URL ================= */
    const { data, error } = await supabaseAdmin.storage
      .from("returns")
      .createSignedUploadUrl(filePath);

    if (error || !data?.signedUrl) {
      console.error("❌ [UPLOAD][RETURN] SIGNED_URL_FAILED", error);
      return NextResponse.json(
        { error: "SIGNED_URL_FAILED" },
        { status: 500 }
      );
    }

    /* ================= PUBLIC URL ================= */
    const { data: publicData } = supabaseAdmin.storage
      .from("returns")
      .getPublicUrl(filePath);

    const publicUrl = publicData?.publicUrl;

    if (!publicUrl) {
      console.error("❌ [UPLOAD][RETURN] PUBLIC_URL_FAILED");
      return NextResponse.json(
        { error: "PUBLIC_URL_FAILED" },
        { status: 500 }
      );
    }

    console.log("🌍 [UPLOAD][RETURN] URL:", publicUrl);

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      publicUrl,
    });

  } catch (err) {
    console.error("💥 [UPLOAD][RETURN] ERROR:", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
