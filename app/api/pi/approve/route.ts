
import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

type Body = {
  paymentId?: unknown;
};

export async function POST(req: Request) {
  try {
    console.log("🟡 [PI][APPROVE] START");

    /* ================= AUTH ================= */

    const auth = await getUserFromBearer();

    if (!auth) {
      console.error("❌ [PI][APPROVE] UNAUTHORIZED");
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    console.log("🟢 [PI][APPROVE] AUTH_OK", { userId });

    /* ================= BODY ================= */

    const raw = await req.json().catch(() => null);

    if (!raw || typeof raw !== "object") {
      console.error("❌ [PI][APPROVE] INVALID_BODY", raw);
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const body = raw as Body;

    const paymentId =
  typeof body.paymentId === "string"
    ? body.paymentId.trim()
    : "";

console.log("🟡 [PI][APPROVE] PAYMENT_ID", paymentId); // ✅ THÊM Ở ĐÂY

    if (!paymentId) {
      console.error("❌ [PI][APPROVE] MISSING_PAYMENT_ID");
      return NextResponse.json(
        { error: "MISSING_PAYMENT_ID" },
        { status: 400 }
      );
    }

    console.log("🟡 [PI][APPROVE] PAYMENT_ID", paymentId);

    /* ================= CALL PI ================= */

    console.log("🟡 [PI][APPROVE] CALL_PI");

    const approveRes = await fetch(
      `${PI_API}/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_KEY}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const text = await approveRes.text();

    console.log("🟡 [PI][APPROVE] PI_STATUS", approveRes.status);

    /* ================= HANDLE ERROR ================= */

    if (!approveRes.ok) {
      console.error("❌ [PI][APPROVE] PI_ERROR", {
        status: approveRes.status,
        body: text,
      });

      return NextResponse.json(
        { error: "PI_APPROVE_FAILED" },
        { status: 400 }
      );
    }

    /* ================= SUCCESS ================= */

    console.log("🟢 [PI][APPROVE] SUCCESS");

    return new NextResponse(text, {
      status: approveRes.status,
    });

  } catch (err) {
    console.error("🔥 [PI][APPROVE] CRASH", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
