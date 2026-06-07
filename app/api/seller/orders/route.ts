import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth/guard";
import { getSellerOrders } from "@/lib/db/orders.seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "returned";

function parseOrderStatus(
  v: string | null
): OrderStatus | undefined {
  if (!v) return;

  const normalized =
    v.toLowerCase();

  const allowed: OrderStatus[] = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "completed",
    "cancelled",
    "returned",
  ];

  return allowed.includes(
    normalized as OrderStatus
  )
    ? (normalized as OrderStatus)
    : undefined;
}

export async function GET(req: Request) {
  try {
    /* ================= AUTH ================= */
    const auth = await requireSeller();
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* ================= QUERY ================= */
    const { searchParams } = new URL(req.url);

    const status = parseOrderStatus(searchParams.get("status"));
    const page = Number(searchParams.get("page") ?? "1");

    /* ================= DB ================= */
    const orders = await getSellerOrders(
      userId,
      status,
      page
    );

    return NextResponse.json(orders);

  } catch (err) {
    console.error("SELLER ORDERS ERROR:", err);
    return NextResponse.json([], { status: 200 });
  }
}
