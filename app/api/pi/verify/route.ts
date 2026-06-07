import { NextResponse } from "next/server";
import { upsertUserFromPi } from "@/lib/db/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= TYPES ================= */
type PiMeResponse = {
  uid?: string;
  username?: string;
  wallet_address?: string | null;
};

/* ================= BLOCK GET ================= */
export async function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}

/* ================= POST ================= */
export async function POST(req: Request) {
  try {
    /* ================= 1️⃣ GET TOKEN ================= */
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "MISSING_ACCESS_TOKEN" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7).trim();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "MISSING_ACCESS_TOKEN" },
        { status: 400 }
      );
    }

    /* ================= 2️⃣ VERIFY PI ================= */
    const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

const piRes = await fetch("https://api.minepi.com/v2/me", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  },
  cache: "no-store",
  signal: controller.signal,
}).finally(() => clearTimeout(timeout));

    if (!piRes.ok) {
      return NextResponse.json(
        { success: false, error: "INVALID_ACCESS_TOKEN" },
        { status: 401 }
      );
    }

    const data = (await piRes.json()) as PiMeResponse;

    if (typeof data.uid !== "string" || typeof data.username !== "string") {
      return NextResponse.json(
        { success: false, error: "INVALID_PI_USER" },
        { status: 401 }
      );
    }

    const pi_uid = data.uid;
    const username = data.username.trim();
    const wallet_address = data.wallet_address ?? null;

    /* ================= 3️⃣ UPSERT USER (DB LAYER) ================= */
    const dbUser = await upsertUserFromPi(pi_uid, username);

    if (!dbUser?.id) {
      return NextResponse.json(
        { success: false, error: "USER_NOT_FOUND" },
        { status: 500 }
      );
    }

    /* ================= 4️⃣ ROLE ================= */
    const role =
      dbUser.role === "seller" ||
      dbUser.role === "admin" ||
      dbUser.role === "customer"
        ? dbUser.role
        : "customer";

    /* ================= 5️⃣ RESPONSE ================= */
   return NextResponse.json({
  success: true,
  user: {
    id: dbUser.id,
    username,
    wallet_address,
    role,
  },
});

  } catch (err) {
    console.error("❌ PI VERIFY ERROR:", err);

    return NextResponse.json(
      { success: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
