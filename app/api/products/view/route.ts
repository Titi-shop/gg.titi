import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { query } from "@/lib/db";
import { incrementProductView } from "@/lib/db/products";

/* ================= TYPES ================= */

interface ViewBody {
  id: string;
}

/* ================= POST ================= */

export async function POST(req: Request) {
  try {
    /* ================= 1️⃣ AUTH ================= */

    const user = await getUserFromBearer();

    if (!user?.pi_uid) {
      return NextResponse.json(
        { success: false, message: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    /* ================= 2️⃣ MAP UUID ================= */

    const userRes = await query(
      `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
      [user.pi_uid]
    );

    if (userRes.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    // ⚠️ không cần dùng userId nhưng vẫn phải map theo rule
    const userId = userRes.rows[0].id;

    /* ================= 3️⃣ BODY ================= */

    const body: unknown = await req.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("id" in body) ||
      typeof (body as ViewBody).id !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { id } = body as ViewBody;

    /* ================= 4️⃣ VALIDATE ================= */

    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: "INVALID_ID" },
        { status: 400 }
      );
    }

    /* ================= 5️⃣ LOG ================= */

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    console.log("👁 VIEW FROM:", ip, "PRODUCT:", id);

    /* ================= 6️⃣ DB CALL ================= */

    const views = await incrementProductView(id);

    /* ================= 7️⃣ RESPONSE ================= */

    return NextResponse.json({
      success: true,
      views,
    });

  } catch (err) {
    console.error("❌ VIEW ERROR:", err);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
