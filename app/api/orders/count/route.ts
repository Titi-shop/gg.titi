import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guard";
import { getBuyerOrderCounts } from "@/lib/db/orders.buyer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth =
    await requireAuth();

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const counts =
      await getBuyerOrderCounts(
        auth.userId
      );
    return NextResponse.json(
      counts
    );
  } catch (error) {
    console.error(
      "GET /api/orders/count:",
      error
    );

    return NextResponse.json(
      {
        pending_fulfillment: 0,
        processing: 0,
        shipped: 0,
        completed: 0,
        cancelled: 0,
        refunded: 0,
      },
      {
        status: 200,
      }
    );
  }
}
