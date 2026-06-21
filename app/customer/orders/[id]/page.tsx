"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";

import { getPiAccessToken } from "@/lib/piAuth";
import { formatPi } from "@/lib/pi";
import { useAuth } from "@/context/AuthContext";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* =====================================================
   TYPES
===================================================== */

type OrderStatus =
  | "pending_fulfillment"
  | "processing"
  | "shipping"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";
type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refunded"
  | "rejected";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  fulfillment_status: string;
}

interface Order {
  id: string;
  order_number: string;
  fulfillment_status: OrderStatus;
  total: number;
  created_at: string;
  order_items: OrderItem[];

  return_status?: ReturnStatus | null;
}

/* =====================================================
   FETCHER
===================================================== */

const fetcher = async (url: string): Promise<Order | null> => {
  try {
    const token = await getPiAccessToken();
    if (!token) return null;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json = await res.json();
    return json?.order ?? null;
  } catch (err) {
    console.error("[ORDER_FETCH_ERROR]", err);
    return null;
  }
};

/* =====================================================
   PAGE
===================================================== */

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const orderId =
    typeof params?.id === "string" ? params.id : "";

  const shouldFetch = !!user && !!orderId;

  const { data: order, isLoading } = useSWR<Order | null>(
    shouldFetch ? `/api/orders/${orderId}` : null,
    fetcher
  );

  /* =====================================================
     LOADING
  ===================================================== */

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">
        {t.loading_order ?? "Đang tải đơn hàng..."}
      </div>
    );
  }

  /* =====================================================
     NOT FOUND
  ===================================================== */

  if (!order) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-red-500">
        {t.order_not_found ?? "Không tìm thấy đơn hàng"}
      </div>
    );
  }

  /* =====================================================
     RETURN LOGIC (QUAN TRỌNG)
  ===================================================== */

  const hasActiveReturn =
  order.return_status &&
  order.return_status !== "rejected";

const canReturn =
  order.fulfillment_status === "delivered" &&
  !hasActiveReturn;
  /* =====================================================
     UI
  ===================================================== */

  return (
    <main className="min-h-screen bg-[var(--background)] pb-24">

      {/* HEADER */}
      <div className="border-b border-black/5 bg-card px-4 py-4">
        <button
          onClick={() => router.back()}
          className="mb-3 text-sm text-muted active:scale-95 transition"
        >
          ← {t.back ?? "Quay lại"}
        </button>

        <div className="flex justify-between items-start">
          <div>
            <p className="font-bold text-base">
              #{order.order_number}
            </p>

            <p className="text-xs text-muted mt-1">
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
<span className="text-xs px-3 py-1 rounded-full bg-orange-100 text-orange-600">
  {order.return_status
    ? `return_${order.return_status}`
    : order.fulfillment_status}
          </span>
        </div>
      </div>

      {/* ITEMS */}
      <div className="bg-card mt-3">
        {order.order_items?.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 p-4 border-b border-black/5"
          >
            <Image
              src={item.thumbnail || "/placeholder.png"}
              alt={item.product_name}
              width={80}
              height={80}
              className="rounded-xl object-cover"
            />

            <div className="flex-1">
              <p className="text-sm font-semibold line-clamp-2">
                {item.product_name}
              </p>

              <p className="text-xs text-muted mt-1">
                x{item.quantity}
              </p>

              <p className="text-sm font-bold mt-2">
                π{formatPi(item.total_price)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* TOTAL */}
      <div className="bg-card mt-3 px-4 py-4 flex justify-between">
        <span className="text-sm text-muted">
          {t.total ?? "Tổng cộng"}
        </span>

        <span className="font-bold">
          π{formatPi(order.total)}
        </span>
      </div>

      {/* ACTIONS */}
      <div className="px-4 pt-4 space-y-3">

        {/* RETURN BUTTON (SAFE) */}
        {canReturn && (
          <button
            onClick={() =>
              router.push(
                `/customer/orders/${order.id}/return`
              )
            }
            className="w-full btn-primary active:scale-95 transition"
          >
            ↩ {t.request_return ?? "Trả hàng / Hoàn tiền"}
          </button>
        )}

        {/* BUY AGAIN */}
        {order.order_items?.length > 0 && (
          <button
            onClick={() => {
              const pid = order.order_items?.[0]?.product_id;
              if (!pid) return;

              router.push(`/product/${pid}`);
            }}
            className="w-full border border-black/10 bg-card py-3 rounded-xl text-sm font-semibold active:scale-95 transition"
          >
            {t.buy_again ?? "Mua lại"}
          </button>
        )}
      </div>
    </main>
  );
}
