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
    /* ================= 1️⃣ OPTIONAL AUTH ================= */

    let userId: string | null = null;

    try {
      const user = await getUserFromBearer(req); // ✅ FIX: thêm req

      if (user?.pi_uid) {
        const userRes = await query<{ id: string }>(
          `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
          [user.pi_uid]
        );

        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
        }
      }
    } catch {
      // ❗ ignore auth error → vẫn cho xem
    }

    /* ================= 2️⃣ BODY ================= */

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

    /* ================= 3️⃣ VALIDATE ================= */

    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: "INVALID_ID" },
        { status: 400 }
      );
    }

    /* ================= 4️⃣ LOG ================= */

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    console.log("👁 VIEW:", { ip, productId: id, userId });

    /* ================= 5️⃣ DB ================= */

    const views = await incrementProductView(id);

    /* ================= 6️⃣ RESPONSE ================= */

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
