

import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";

import {
  getReturnByIdForSeller,
  markReturnReceivedBySeller,
} from "@/lib/db/returns";

export const runtime = "nodejs";

/* ================= HELPERS ================= */

function errorJson(code: string, status = 400) {
  return NextResponse.json(
    { error: code },
    { status }
  );
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

/* ================= POST ================= */

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSeller();

    if (!auth.ok) {
      return auth.response;
    }

    const returnId = params.id;

    if (!isValidUuid(returnId)) {
      return errorJson("INVALID_RETURN_ID");
    }

    const existing = await getReturnByIdForSeller(
      returnId,
      auth.userId
    );

    if (!existing) {
      return errorJson("NOT_FOUND", 404);
    }

    if (existing.status !== "shipping_back") {
      return errorJson("INVALID_STATUS");
    }

    const updated = await markReturnReceivedBySeller(
      returnId,
      auth.userId
    );

    if (!updated) {
      return errorJson("UPDATE_FAILED");
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error("[SELLER_RETURN_RECEIVED]", error);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
