import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";

import {
  getReturnByIdForSeller,
} from "@/lib/db/returns";

export const runtime = "nodejs";

/* ================= HELPERS ================= */

function errorJson(code: string, status = 400) {
  return NextResponse.json({ error: code }, { status });
}

/* ================= GET ================= */

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const data = await getReturnByIdForSeller(
      params.id,
      auth.userId
    );

    if (!data) {
      return errorJson("NOT_FOUND", 404);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("SELLER RETURN GET ERROR:", error);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/* ================= PATCH ================= */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const { action } = await req.json();

    if (
      !["approve", "reject", "received"].includes(action)
    ) {
      return errorJson("INVALID_ACTION");
    }

    const returnData = await getReturnByIdForSeller(
      params.id,
      auth.userId
    );

    if (!returnData) {
      return errorJson("NOT_FOUND", 404);
    }

    await updateReturnStatusBySeller(
      params.id,
      auth.userId,
      action
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "SELLER RETURN PATCH ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
