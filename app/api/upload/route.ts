import { getUserIdByPiUid } from "@/lib/db/users";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request): Promise<NextResponse> {
  try {
    /* =========================
       1️⃣ AUTH
    ========================= */
    const user = await getUserFromBearer(req); // ✅ FIX

    if (!user?.pi_uid) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    /* =========================
       2️⃣ MAP USER + ROLE (1 QUERY)
    ========================= */
    const auth = await requireSeller();
if (!auth.ok) return auth.response;

const user = auth.user;
const userId = await getUserIdByPiUid(user.pi_uid);

if (!userId) {
  return NextResponse.json(
    { error: "USER_NOT_FOUND" },
    { status: 404 }
  );
}
    /* =========================
       4️⃣ FILE
    ========================= */
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "INVALID_FILE" },
        { status: 400 }
      );
    }

    // ✅ SIZE LIMIT (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE" },
        { status: 400 }
      );
    }

    // ✅ TYPE CHECK
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    /* =========================
       5️⃣ PATH
    ========================= */
    const ext = file.name.split(".").pop()?.toLowerCase();

    const safeExt = ext && ext.length <= 5 ? ext : "jpg"; // ✅ tránh lỗi

    const filePath = `products/${userId}/${crypto.randomUUID()}.${safeExt}`;

    /* =========================
       6️⃣ UPLOAD (SUPABASE STORAGE)
    ========================= */
    const { error } = await supabase.storage
      .from("products")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("❌ Supabase upload error:", error);

      return NextResponse.json(
        { error: "UPLOAD_FAILED" },
        { status: 500 }
      );
    }

    /* =========================
       7️⃣ GET URL
    ========================= */
    const { data } = supabase.storage
      .from("products")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
    });

  } catch (err) {
    console.error("❌ Upload error:", err);

    return NextResponse.json(
      { error: "UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
