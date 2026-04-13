import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSeller } from "@/lib/auth/guard";

export const runtime = "nodejs"; // 🔥 đảm bảo dùng Node (crypto OK)

export async function POST() {
  try {
    console.log("🚀 CREATE SIGNED URL");

    /* ================= AUTH ================= */
    const auth = await requireSeller();

    if (!auth?.ok) {
      console.error("❌ AUTH FAILED");
      return auth.response ?? NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    if (!userId) {
      console.error("❌ NO USER ID");
      return NextResponse.json(
        { error: "NO_USER" },
        { status: 401 }
      );
    }

    console.log("👤 USER:", userId);

    /* ================= PATH ================= */
    const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;
    const filePath = `products/${userId}/${fileName}`;

    console.log("📂 PATH:", filePath);

    /* ================= SIGNED URL ================= */
    const { data, error } = await supabaseAdmin.storage
      .from("products")
      .createSignedUploadUrl(filePath);

    if (error || !data?.signedUrl) {
      console.error("❌ SIGNED URL ERROR:", error);
      return NextResponse.json(
        { error: "SIGNED_URL_FAILED" },
        { status: 500 }
      );
    }

    console.log("✅ SIGNED URL CREATED");

    /* ================= RESPONSE ================= */
    return NextResponse.json({
      url: data.signedUrl,
      path: filePath,
    });

  } catch (err: any) {
    console.error("💥 API ERROR:", err?.message || err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
