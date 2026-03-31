import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireSeller } from "@/lib/auth/guard";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request): Promise<NextResponse> {
  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= FILE ================= */
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "INVALID_FILE" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    /* ================= PATH ================= */
    const ext = file.name.split(".").pop()?.toLowerCase();
    const safeExt = ext && ext.length <= 5 ? ext : "jpg";

    const filePath = `products/${userId}/${crypto.randomUUID()}.${safeExt}`;

    /* ================= UPLOAD ================= */
    const { error } = await supabase.storage
      .from("products")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("[UPLOAD] FAILED");
      return NextResponse.json(
        { error: "UPLOAD_FAILED" },
        { status: 500 }
      );
    }

    /* ================= URL ================= */
    const { data } = supabase.storage
      .from("products")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
    });

  } catch {
    console.error("[UPLOAD] ERROR");

    return NextResponse.json(
      { error: "UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
