import { NextResponse } from "next/server";

/* ================= ENV ================= */

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is missing");
}

if (!SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

/* ================= TYPES ================= */

interface ViewBody {
  id: string;
}

/* ================= HELPERS ================= */

function supabaseHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

/* ================= POST ================= */

export async function POST(req: Request) {
  try {
    /* ================= BODY ================= */

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

    /* ================= VALIDATE ID ================= */

    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: "INVALID_ID" },
        { status: 400 }
      );
    }

    /* ================= OPTIONAL: LOG IP ================= */

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    console.log("👁 VIEW FROM:", ip, "PRODUCT:", id);

    /* ================= CALL RPC ================= */

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/increment_product_view`,
      {
        method: "POST",
        headers: supabaseHeaders(),
        body: JSON.stringify({ pid: id }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ VIEW RPC ERROR:", text);

      return NextResponse.json(
        { success: false },
        { status: 500 }
      );
    }

    const data: { views: number }[] = await res.json();

    return NextResponse.json({
      success: true,
      views: data[0]?.views ?? 0,
    });

  } catch (err) {
    console.error("❌ VIEW ERROR:", err);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
