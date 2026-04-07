import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PI_API = process.env.PI_API_URL!;
const PI_KEY = process.env.PI_API_KEY!;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const paymentId =
      typeof body.paymentId === "string" ? body.paymentId : "";

    const txid =
      typeof body.txid === "string" ? body.txid : "";

    if (!paymentId || !txid) {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    console.log("🟡 [INCOMPLETE] COMPLETE START", {
      paymentId,
      txid,
    });

    const res = await fetch(
      `${PI_API}/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    );

    const data = await res.text();

    console.log("🟢 [INCOMPLETE] PI RES:", res.status, data);

    return new NextResponse(data, { status: res.status });

  } catch (err) {
    console.error("❌ [INCOMPLETE] ERROR", err);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
