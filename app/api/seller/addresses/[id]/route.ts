import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import {
  updateSellerAddress,
  deleteSellerAddress,
} from "@/lib/db/sellerAddresses";

export const runtime = "nodejs";

/* =====================================================
   PUT /api/seller/addresses/[id]
===================================================== */

export async function PUT(req: Request, { params }: any) {
  try {
    const auth = await requireSeller();

    if (!auth.ok) {
      return auth.response;
    }

    const sellerId = auth.userId;
    const body = await req.json();

    // optional: log debug
    console.log("[ADDRESS UPDATE]", {
      sellerId,
      addressId: params.id,
    });

    const data = await updateSellerAddress(params.id, {
      ...body,
      seller_id: sellerId, // 🔥 đảm bảo ownership
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[ADDRESS UPDATE ERROR]", err);

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/* =====================================================
   DELETE /api/seller/addresses/[id]
===================================================== */

export async function DELETE(_: Request, { params }: any) {
  try {
    const auth = await requireSeller();

    if (!auth.ok) {
      return auth.response;
    }

    const sellerId = auth.userId;

    console.log("[ADDRESS DELETE]", {
      sellerId,
      addressId: params.id,
    });

    await deleteSellerAddress(params.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ADDRESS DELETE ERROR]", err);

    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
