import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { cancelOrderByBuyer } from "@/lib/db/orders.buyer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= TYPES ================= */
type CancelResult =
  | "SUCCESS"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATUS";

/* ================= HELPERS ================= */
function isValidId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/* ================= HANDLER ================= */
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const userId: string = auth.userId;
    const orderId = context?.params?.id;

    /* ================= VALIDATION ================= */
    if (!isValidId(orderId)) {
      return NextResponse.json(
        { error: "INVALID_ORDER_ID" },
        { status: 400 }
      );
    }

    /* ================= BODY ================= */
    let reason: string = "buyer_cancelled";

    try {
      const body: unknown = await req.json();

      if (
        body &&
        typeof body === "object" &&
        "cancel_reason" in body &&
        typeof (body as { cancel_reason?: unknown }).cancel_reason === "string"
      ) {
        const value = (body as { cancel_reason: string }).cancel_reason.trim();
        if (value.length > 0) {
          reason = value;
        }
      }
    } catch {
      // ignore parse error → dùng default
    }

    /* ================= LOG INPUT ================= */
    console.log("[ORDER][CANCEL][REQUEST]", {
      orderId,
      userId,
      hasReason: Boolean(reason),
    });

    /* ================= DB ================= */
    const result = (await cancelOrderByBuyer(
      orderId,
      userId,
      reason
    )) as CancelResult;

    /* ================= HANDLE RESULT ================= */
    if (result === "NOT_FOUND") {
      console.warn("[ORDER][CANCEL][NOT_FOUND]", { orderId, userId });

      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (result === "FORBIDDEN") {
      console.warn("[ORDER][CANCEL][FORBIDDEN]", { orderId, userId });

      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (result === "INVALID_STATUS") {
      console.warn("[ORDER][CANCEL][INVALID_STATUS]", { orderId });

      return NextResponse.json(
        { error: "ORDER_CANNOT_BE_CANCELLED" },
        { status: 400 }
      );
    }

    /* ================= SUCCESS ================= */
    console.log("[ORDER][CANCEL][SUCCESS]", {
      orderId,
      userId,
    });

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    /* ================= ERROR ================= */
    console.error("[ORDER][CANCEL][ERROR]", {
      message: err instanceof Error ? err.message : "UNKNOWN",
    });

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
