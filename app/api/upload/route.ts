import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  console.log("🚀 [UPLOAD] START");

  try {
    /* ================= AUTH ================= */
    console.log("🔐 [UPLOAD] CHECK AUTH");

    const auth = await requireSeller();

    console.log("🔐 [UPLOAD] AUTH RESULT:", auth);

    if (!auth.ok) {
      console.error("❌ [UPLOAD] UNAUTHORIZED");
      return auth.response; // <- đây chính là 401
    }

    const userId = auth.userId;
    console.log("👤 [UPLOAD] USER:", userId);

    /* ================= FILE ================= */
    console.log("📥 [UPLOAD] PARSE FORM DATA");

    const form = await req.formData();
    const file = form.get("file");

    console.log("📥 [UPLOAD] FILE RAW:", file);

    if (!(file instanceof File)) {
      console.error("❌ [UPLOAD] INVALID FILE");
      return NextResponse.json(
        { error: "INVALID_FILE" },
        { status: 400 }
      );
    }

    console.log("📂 [UPLOAD] FILE INFO:", {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (file.size > 5 * 1024 * 1024) {
      console.error("❌ [UPLOAD] FILE TOO LARGE");
      return NextResponse.json(
        { error: "FILE_TOO_LARGE" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      console.error("❌ [UPLOAD] INVALID TYPE:", file.type);
      return NextResponse.json(
        { error: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    /* ================= PATH ================= */
    const ext = file.name.split(".").pop()?.toLowerCase();
    const safeExt = ext && ext.length <= 5 ? ext : "jpg";

    const filePath = `products/${userId}/${crypto.randomUUID()}.${safeExt}`;

    console.log("📁 [UPLOAD] PATH:", filePath);

    /* ================= UPLOAD ================= */
    console.log("☁️ [UPLOAD] START UPLOAD TO SUPABASE");

    const { data: uploadData, error } = await supabaseAdmin.storage
      .from("products")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("❌ [UPLOAD] SUPABASE ERROR:", error);
      return NextResponse.json(
        { error: "UPLOAD_FAILED", detail: error.message },
        { status: 500 }
      );
    }

    console.log("✅ [UPLOAD] SUCCESS:", uploadData);

    /* ================= URL ================= */
    const { data } = supabaseAdmin.storage
      .from("products")
      .getPublicUrl(filePath);

    console.log("🌍 [UPLOAD] PUBLIC URL:", data.publicUrl);

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
    });

  } catch (err) {
    console.error("💥 [UPLOAD] SERVER ERROR:", err);

    return NextResponse.json(
      {
        error: "UPLOAD_FAILED",
        detail: String(err),
      },
      { status: 500 }
    );
  }
}
