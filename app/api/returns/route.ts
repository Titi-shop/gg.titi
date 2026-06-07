import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guard";
import {
  getReturnsByBuyer,
  createReturn,
} from "@/lib/db/returns";

export const runtime = "nodejs";

/* =====================================================
   TYPES
===================================================== */

type CreateReturnBody = {
  orderId?: string;
  orderItemId?: string;
  reason?: string;
  description?: string;
  images?: string[];
};

/* =====================================================
   HELPERS
===================================================== */

function isValidUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function errorJson(code: string, status = 400) {
  return NextResponse.json({ error: code }, { status });
}

/* 🔥 validate image URL */
function isValidImageUrl(url: string): boolean {
  return (
    url.startsWith("http") &&
    url.includes("/storage/v1/object/public/")
  );
}

/* =====================================================
   ERROR MAP
===================================================== */

function mapError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "INTERNAL_ERROR";

  console.error("🔥 [RETURNS API][MAP_ERROR]", message);

  switch (message) {
    case "ORDER_NOT_FOUND":
    case "ITEM_NOT_FOUND":
      return errorJson(message, 404);

    case "RETURN_EXISTS":
      return errorJson(message, 409);

    case "ORDER_NOT_RETURNABLE":
    case "INVALID_INPUT":
    case "INVALID_REASON":
      return errorJson(message, 400);

    default:
      return errorJson("INTERNAL_ERROR", 500);
  }
}

/* =====================================================
   GET /api/returns
===================================================== */

export async function GET() {
  console.log("📥 [RETURNS API][GET] START");

  try {
    const auth = await requireAuth();

    if (!auth.ok) {
      console.error("❌ [RETURNS API][GET] UNAUTHORIZED");
      return auth.response;
    }

    const userId = auth.userId;

    console.log("👤 [RETURNS API][GET] USER:", userId);

    const items = await getReturnsByBuyer(userId);

    console.log("📦 [RETURNS API][GET] COUNT:", items.length);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("💥 [RETURNS API][GET] ERROR:", error);
    return mapError(error);
  }
}

/* =====================================================
   POST /api/returns
===================================================== */

export async function POST(req: NextRequest) {
  console.log("🚀 [RETURNS API][POST] START");

  try {
    /* ================= AUTH ================= */
    const auth = await requireAuth();

    console.log("🔐 AUTH:", auth);

    if (!auth.ok) {
      console.error("❌ UNAUTHORIZED");
      return auth.response;
    }

    const userId = auth.userId;

    /* ================= BODY ================= */
    let body: CreateReturnBody;

    try {
      body = (await req.json()) as CreateReturnBody;
    } catch {
      console.error("❌ INVALID_JSON");
      return errorJson("INVALID_JSON", 400);
    }

    console.log("📦 BODY RAW:", body);

    /* ================= NORMALIZE ================= */
    const orderId = body.orderId?.trim() ?? "";
    const orderItemId = body.orderItemId?.trim() ?? "";
    const reason = body.reason?.trim() ?? "";
    const description = body.description?.trim() ?? "";

    /* ================= IMAGE CLEAN ================= */
    const images = Array.isArray(body.images)
      ? body.images
          .filter(
            (v): v is string =>
              typeof v === "string" &&
              v.trim().length > 0 &&
              !v.includes("undefined") && // 🔥 fix bug cũ
              isValidImageUrl(v)
          )
          .slice(0, 5) // 🔥 limit 5 ảnh
      : [];

    console.log("🧹 CLEAN IMAGES:", images);

    /* ================= VALIDATE ================= */

    if (!orderId || !orderItemId || !reason) {
      console.error("❌ INVALID_INPUT");
      return errorJson("INVALID_INPUT", 400);
    }

    if (!isValidUuid(orderId) || !isValidUuid(orderItemId)) {
      console.error("❌ INVALID_UUID");
      return errorJson("INVALID_UUID", 400);
    }

    if (reason.length > 200) {
      return errorJson("INVALID_REASON", 400);
    }

    if (description.length > 2000) {
      return errorJson("INVALID_DESCRIPTION", 400);
    }

    /* ================= CREATE ================= */

    console.log("🟡 CALL createReturn");

    const returnId = await createReturn(
      userId,
      orderId,
      orderItemId,
      reason,
      description,
      images
    );

    console.log("🟢 SUCCESS:", returnId);

    return NextResponse.json(
      {
        success: true,
        id: returnId,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("💥 POST ERROR:", error);
    return mapError(error);
  }
}
