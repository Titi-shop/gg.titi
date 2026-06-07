import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { createPiIntentFromRequest } from "@/lib/payments/payment.intent.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await getUserFromBearer();

    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const raw = await req.json().catch(() => null);

    const result = await createPiIntentFromRequest({
      userId: auth.userId,
      raw,
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("[PAYMENT][CREATE_INTENT_ROUTE_CRASH]", e);

    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "CREATE_INTENT_FAILED",
      },
      { status: 400 }
    );
  }
}
