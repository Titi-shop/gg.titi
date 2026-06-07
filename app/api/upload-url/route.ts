import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSeller } from "@/lib/auth/guard";

export const runtime = "nodejs";

/* =====================================================
   POST /api/upload-url (PRODUCT IMAGE)
===================================================== */

export async function POST(): Promise<NextResponse> {
  console.log("🚀 [UPLOAD][PRODUCT] START");

  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();

    if (!auth.ok) {
      console.error("❌ [UPLOAD][PRODUCT] UNAUTHORIZED");
      return auth.response;
    }

    const userId = auth.userId;

    console.log("👤 [UPLOAD][PRODUCT] USER:", userId);

    /* ================= VALIDATE ================= */
    if (!userId || typeof userId !== "string") {
      console.error("❌ [UPLOAD][PRODUCT] INVALID_USER_ID");
      return NextResponse.json(
        { error: "INVALID_USER" },
        { status: 400 }
      );
    }

    /* ================= PATH ================= */
    const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;
    const filePath = `products/${userId}/${fileName}`;

    console.log("📂 [UPLOAD][PRODUCT] PATH:", filePath);

    /* ================= SIGNED URL ================= */
    const { data, error } = await supabaseAdmin.storage
      .from("products")
      .createSignedUploadUrl(filePath);

    if (error || !data?.signedUrl) {
      console.error("❌ [UPLOAD][PRODUCT] SIGNED_URL_FAILED", error);
      return NextResponse.json(
        { error: "SIGNED_URL_FAILED" },
        { status: 500 }
      );
    }

    /* ================= PUBLIC URL ================= */
    const { data: publicData } = supabaseAdmin.storage
      .from("products")
      .getPublicUrl(filePath);

    const publicUrl = publicData?.publicUrl;

    if (!publicUrl) {
      console.error("❌ [UPLOAD][PRODUCT] PUBLIC_URL_FAILED");
      return NextResponse.json(
        { error: "PUBLIC_URL_FAILED" },
        { status: 500 }
      );
    }

    console.log("🌍 [UPLOAD][PRODUCT] URL:", publicUrl);

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      publicUrl,
    });

  } catch (err) {
    console.error("💥 [UPLOAD][PRODUCT] ERROR:", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
