import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { getBuyerOrderCounts } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  /* ================= VALIDATE ================= */
  if (!userId || typeof userId !== "string") {
    return NextResponse.json(
      { error: "INVALID_USER_ID" },
      { status: 400 }
    );
  }

  try {
    /* ================= DB ================= */
    const counts = await getBuyerOrderCounts(userId);

    return NextResponse.json(counts);
  } catch {
    /* ================= SAFE FALLBACK ================= */
    return NextResponse.json(
      {
        pending: 0,
        pickup: 0,
        shipping: 0,
        completed: 0,
        cancelled: 0,
      },
      { status: 200 }
    );
  }
}
