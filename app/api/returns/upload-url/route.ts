import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST() {
  try {
    console.log("🚀 [UPLOAD RETURN]");

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;
    const filePath = `returns/${userId}/${fileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from("returns")
      .createSignedUploadUrl(filePath);

    if (error || !data?.signedUrl) {
      console.error("❌ SIGNED URL ERROR:", error);
      return NextResponse.json({ error: "SIGNED_URL_FAILED" }, { status: 500 });
    }

    /* ✅ FIX CHUẨN */
    const { data: publicData } = supabaseAdmin.storage
      .from("returns")
      .getPublicUrl(filePath);

    console.log("🌍 PUBLIC URL:", publicData.publicUrl);

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      publicUrl: publicData.publicUrl,
    });

  } catch (err) {
    console.error("💥 UPLOAD ERROR:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
