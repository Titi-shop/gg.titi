import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import {
  getReturnByIdForSeller,
  updateReturnStatusBySeller,
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
  console.log("📥 [SELLER RETURN][GET]");

  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const sellerId = auth.userId;
  const returnId = params.id;

  const data = await getReturnByIdForSeller(returnId, sellerId);
console.log("📤 API RETURN:", data);
  if (!data) return errorJson("NOT_FOUND", 404);

  return NextResponse.json(data);
}

/* ================= PATCH ================= */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log("🚀 [SELLER RETURN][PATCH]");

  const auth = await requireSeller();
  if (!auth.ok) return auth.response;

  const sellerId = auth.userId;
  const returnId = params.id;

  const body = await req.json();

  const action = body.action;

  console.log("🟡 ACTION:", action);

  if (!["approve", "reject", "received"].includes(action)) {
    return errorJson("INVALID_ACTION");
  }

  await updateReturnStatusBySeller(
    returnId,
    sellerId,
    action
  );

  return NextResponse.json({ success: true });
}
