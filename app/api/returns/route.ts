import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  createReturn,
  getReturnsByBuyer,
} from "@/lib/db/orders";
import { supabase } from "@/lib/db/supabase"; // ⚠️ dùng nếu bạn đã có sẵn

export const dynamic = "force-dynamic";

/* =========================================================
   POST — CREATE RETURN
========================================================= */
export async function POST(req: NextRequest) {
  try {
    console.log("🟡 [RETURN POST] START");

    /* ================= AUTH ================= */
    const auth = await requireAuth();

    if (!auth.ok) {
      console.log("🔴 [RETURN POST] UNAUTHORIZED");
      return auth.response;
    }

    const userId = auth.userId;
    console.log("🟢 [RETURN POST] USER:", userId);

    /* ================= PARSE ================= */
    const contentType = req.headers.get("content-type") ?? "";
    console.log("🟡 [RETURN POST] CONTENT-TYPE:", contentType);

    let orderId: string | null = null;
    let orderItemId: string | null = null;
    let reason: string | null = null;
    let description: string | null = null;
    let images: string[] = [];

    /* ================= MULTIPART ================= */
    if (contentType.startsWith("multipart/form-data")) {
      console.log("🟡 [RETURN POST] PARSE FORM DATA");

      const form = await req.formData();

      orderId = form.get("order_id") as string;
      orderItemId = form.get("order_item_id") as string;
      reason = (form.get("reason") as string)?.trim();
      description = (form.get("description") as string)?.trim();

      const files = form.getAll("images");

      console.log("🟡 [RETURN POST] FILE COUNT:", files.length);

      for (const file of files) {
        if (!(file instanceof File)) continue;

        console.log("🟡 [RETURN POST] FILE:", file.name, file.size);

        if (file.size > 2 * 1024 * 1024) {
          console.log("🔴 IMAGE TOO LARGE");
          return NextResponse.json(
            { error: "IMAGE_TOO_LARGE" },
            { status: 400 }
          );
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const fileName = `returns/${userId}/${Date.now()}-${file.name}`;

        console.log("🟡 [UPLOAD] START:", fileName);

        const { error } = await supabase.storage
          .from("returns")
          .upload(fileName, buffer, {
            contentType: file.type,
          });

        if (error) {
          console.error("❌ [UPLOAD ERROR]:", error);
          throw new Error("UPLOAD_FAILED");
        }

        const { data } = supabase.storage
          .from("returns")
          .getPublicUrl(fileName);

        console.log("🟢 [UPLOAD DONE]:", data.publicUrl);

        images.push(data.publicUrl);
      }
    }

    /* ================= JSON FALLBACK ================= */
    else {
      console.log("🟡 [RETURN POST] PARSE JSON");

      const body = await req.json();

      orderId = body.order_id;
      orderItemId = body.order_item_id;
      reason = body.reason?.trim();
      description = body.description?.trim();
    }

    console.log("🟡 [RETURN POST] DATA:", {
      orderId,
      orderItemId,
      reason,
      imageCount: images.length,
    });

    /* ================= VALIDATE ================= */
    if (!orderId || !orderItemId || !reason) {
      console.log("🔴 INVALID PAYLOAD");

      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    if (images.length === 0) {
      console.log("🔴 IMAGE REQUIRED");

      return NextResponse.json(
        { error: "IMAGE_REQUIRED" },
        { status: 400 }
      );
    }

    if (images.length > 3) {
      console.log("🔴 TOO MANY IMAGES");

      return NextResponse.json(
        { error: "MAX_3_IMAGES" },
        { status: 400 }
      );
    }

    /* ================= DB ================= */
    console.log("🟡 [DB] CREATE RETURN");

    await createReturn(
      userId, // ✅ UUID đúng rule
      orderId,
      orderItemId,
      reason,
      description,
      images
    );

    console.log("🟢 [RETURN POST] SUCCESS");

    return NextResponse.json({
      success: true,
    });

  } catch (err) {
    console.error("❌ [RETURN POST ERROR]:", err);

    if (err instanceof Error) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/* =========================================================
   GET — BUYER RETURNS
========================================================= */
export async function GET() {
  try {
    console.log("🟡 [RETURN GET] START");

    const auth = await requireAuth();

    if (!auth.ok) {
      console.log("🔴 [RETURN GET] UNAUTHORIZED");
      return auth.response;
    }

    const userId = auth.userId;

    console.log("🟢 [RETURN GET] USER:", userId);

    const data = await getReturnsByBuyer(userId);

    console.log("🟢 [RETURN GET] COUNT:", data.length);

    return NextResponse.json(data);

  } catch (err) {
    console.error("❌ [RETURN GET ERROR]:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
