import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  getPendingSellerRequest,
  createSellerRequest,
} from "@/lib/db/sellerRequests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    /* 1️⃣ AUTH + ROLE */
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { userId, role } = auth;

    /* 2️⃣ ALREADY SELLER */
    if (role === "seller" || role === "admin") {
      return NextResponse.json({
        success: true,
        role,
        message: "ALREADY_SELLER",
      });
    }

    /* 3️⃣ CHECK PENDING */
    const existing = await getPendingSellerRequest(userId);

    if (existing) {
      return NextResponse.json(
        { error: "REQUEST_ALREADY_PENDING" },
        { status: 409 }
      );
    }

    /* 4️⃣ CREATE REQUEST */
    await createSellerRequest(userId);

    return NextResponse.json({
      success: true,
      status: "pending",
    });

  } catch (err) {
    console.error("SELLER REGISTER FATAL:", err);

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
