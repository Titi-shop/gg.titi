import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

import {
  createReview,
  getReviewsByUser,
} from "@/lib/db/reviews";

/* =========================================================
   POST /api/reviews
   - Tạo review
========================================================= */
export async function POST(req: Request) {
  try {
    /* ================= AUTH ================= */
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    /* ================= BODY ================= */
    const body: unknown = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const b = body as Record<string, unknown>;

    const orderId =
      typeof b.order_id === "string" ? b.order_id : null;

    const productId =
      typeof b.product_id === "string" ? b.product_id : null;

    const rawComment =
      typeof b.comment === "string" ? b.comment.trim() : "";

    const comment =
      rawComment.length > 0 ? rawComment : "Default review";

    const ratingRaw = b.rating;

    const rating =
      typeof ratingRaw === "number"
        ? ratingRaw
        : typeof ratingRaw === "string"
        ? Number(ratingRaw)
        : null;

    if (
      !orderId ||
      !productId ||
      rating === null ||
      Number.isNaN(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return NextResponse.json(
        { error: "INVALID_REVIEW_DATA" },
        { status: 400 }
      );
    }

    /* ================= CREATE ================= */
    const review = await createReview(
      userId,
      orderId,
      productId,
      rating,
      comment
    );

    return NextResponse.json({
      success: true,
      review,
    });

  } catch (error) {
    console.error("REVIEW ERROR:", error);

    const message =
      error instanceof Error ? error.message : "INTERNAL_ERROR";

    /* map lỗi từ DB layer */
    if (
      message === "PRODUCT_NOT_IN_ORDER" ||
      message === "ORDER_ITEM_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }

    if (message === "FORBIDDEN_ORDER") {
      return NextResponse.json(
        { error: message },
        { status: 403 }
      );
    }

    if (
      message === "ORDER_NOT_REVIEWABLE" ||
      message === "ALREADY_REVIEWED"
    ) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/* =========================================================
   GET /api/reviews
   - Lấy review của user hiện tại
========================================================= */
export async function GET() {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    const reviews = await getReviewsByUser(userId);

    return NextResponse.json({
      reviews,
    });

  } catch (error) {
    console.error("GET REVIEWS ERROR:", error);

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
