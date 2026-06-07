
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { previewOrderFromRequest } from "@/lib/orders/order.preview.service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();

    if (!auth.ok) {
      return auth.response;
    }

    const body = await req.json();

    const result = await previewOrderFromRequest({
      userId: auth.userId,
      raw: body,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[ORDER][PREVIEW][ROUTE_CRASH]", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "PREVIEW_FAILED",
      },
      { status: 400 }
    );
  }
}
