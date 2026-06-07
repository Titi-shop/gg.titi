import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { piAuthorizePayment } from "@/lib/payments/payment.authorize.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await getUserFromBearer();

  if (!auth) {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const result = await piAuthorizePayment({
      userId: auth.userId,
      body,
      authorizationHeader: req.headers.get("authorization") || "",
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "AUTHORIZE_FAILED",
      },
      { status: 400 }
    );
  }
}
