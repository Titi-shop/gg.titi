import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { settlePiPayment } from "@/lib/payments/payment.settle.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const auth = await getUserFromBearer();
    if (!auth?.userId) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          requestId,
        },
        { status: 401 }
      );
    }
    const raw = await req.json().catch(() => null);
    const result = await settlePiPayment({
      raw,
      userId: auth.userId,
      requestId,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[PAYMENT][SUBMIT_ROUTE_CRASH]", e);

    return NextResponse.json(
      {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : "SUBMIT_FAILED",
        requestId,
      },
      { status: 400 }
    );
  }
}
