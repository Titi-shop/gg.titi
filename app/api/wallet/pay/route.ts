import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { payWithWallet } from "@/lib/db/wallet";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json();

  const orderId = body?.orderId;

  if (!orderId) {
    return NextResponse.json(
      { error: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  try {
    await payWithWallet({
      userId: auth.userId,
      orderId,
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "FAILED" },
      { status: 400 }
    );
  }
}
