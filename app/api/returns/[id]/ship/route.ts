import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { shipReturnByBuyer } from "@/lib/db/returns";

export const runtime = "nodejs";

/* ================= HELPERS ================= */

function errorJson(code: string, status = 400) {
  return NextResponse.json({ error: code }, { status });
}

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/* ================= PATCH ================= */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log("🚀 [RETURN][SHIP]");

  /* ===== AUTH ===== */
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const userId = auth.userId; // ✅ UUID (đã convert từ pi_uid)
  const returnId = params.id;

  if (!isValidString(returnId)) {
    return errorJson("INVALID_RETURN_ID");
  }

  /* ===== BODY ===== */
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return errorJson("INVALID_JSON");
  }

  const trackingCode =
    typeof body === "object" && body !== null
      ? (body as { tracking_code?: unknown }).tracking_code
      : undefined;

  const shippingProvider =
    typeof body === "object" && body !== null
      ? (body as { shipping_provider?: unknown }).shipping_provider
      : undefined;

  if (!isValidString(trackingCode)) {
    return errorJson("TRACKING_REQUIRED");
  }

  const provider = isValidString(shippingProvider)
    ? shippingProvider.trim()
    : null;

  try {
    await shipReturnByBuyer({
      returnId,
      buyerId: userId,
      trackingCode: trackingCode.trim(),
      shippingProvider: provider,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ [RETURN][SHIP ERROR]", err);

    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return errorJson("NOT_FOUND", 404);
      }

      if (err.message === "INVALID_STATE") {
        return errorJson("INVALID_STATE");
      }
    }

    return errorJson("INTERNAL_ERROR", 500);
  }
}
