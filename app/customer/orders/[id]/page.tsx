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

interface ApiOrderItem {
  id: string;

  product_id: string | null;
  product_name: string | null;
  thumbnail: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  total_price: number | string | null;
  fulfillment_status: string | null;
}

interface ApiOrder {
  id: string;

  order_number: string;
  fulfillment_status: OrderStatus;

  total: number | string;

  created_at: string;
  seller_message?: string | null;
  seller_cancel_reason?: string | null;
  shipping_name?: string | null;
  shipping_phone?: string | null;
  shipping_address_line?: string | null;
  shipping_ward?: string | null;
  shipping_district?: string | null;
  shipping_region?: string | null;
  shipping_country?: string | null;
  shipping_postal_code?: string | null;

  order_items?: ApiOrderItem[] | null;
}

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
  seller_message: string | null;
  seller_cancel_reason: string | null;
  shipping_name: string;
  shipping_phone: string;

  shipping_address_line: string;
  shipping_ward: string | null;
  shipping_district: string | null;
  shipping_region: string | null;

  shipping_country: string | null;
  shipping_postal_code: string | null;
  order_items: OrderItem[];
}

interface OrderApiResponse {
  ok: boolean;
  order?: ApiOrder;
  error?: string;
}

/* =====================================================
   HELPERS
===================================================== */

function parseNumber(
  value: number | string | null | undefined
): number {
  const n = Number(value ?? 0);

  return Number.isFinite(n) ? n : 0;
}

function getStatusClass(status: string): string {
  switch (status) {
    case "pending_fulfillment":
      return "text-orange-500";

    case "processing":
      return "text-primary";

    case "shipping":
      return "text-blue-500";

    case "completed":
      return "text-green-600";

    case "cancelled":
      return "text-red-500";

    case "refunded":
      return "text-gray-500";

    default:
      return "text-muted";
  }
}

function getStatusBgClass(status: string): string {
  switch (status) {
    case "pending_fulfillment":
      return "bg-orange-100";

    case "processing":
      return "bg-orange-50";

    case "shipping":
      return "bg-blue-50";

    case "completed":
      return "bg-green-50";

    case "cancelled":
      return "bg-red-50";

    case "refunded":
      return "bg-gray-100";

    default:
      return "bg-gray-100";
  }
}

/* =====================================================
   FETCHER
===================================================== */

const fetcher = async (
  url: string
): Promise<Order | null> => {
  try {
    console.log("[ORDER_DETAIL][FETCH_START]", {
      url,
    });

    const token = await getPiAccessToken();

    if (!token) {
      console.warn("[ORDER_DETAIL][NO_TOKEN]");

      return null;
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[ORDER_DETAIL][FETCH_FAILED]", {
        status: res.status,
      });

      return null;
    }

    const json: OrderApiResponse =
      await res.json();

    if (!json?.ok || !json.order) {
      return null;
    }

    const data = json.order;

    return {
      id: data.id,

      order_number: data.order_number,

      fulfillment_status:
        data.fulfillment_status,

      total: parseNumber(data.total),

      created_at: data.created_at,

      seller_message:
        data.seller_message ?? null,

      seller_cancel_reason:
        data.seller_cancel_reason ?? null,

      shipping_name:
        data.shipping_name ?? "",

      shipping_phone:
        data.shipping_phone ?? "",

      shipping_address_line:
        data.shipping_address_line ?? "",

      shipping_ward:
        data.shipping_ward ?? null,

      shipping_district:
        data.shipping_district ?? null,

      shipping_region:
        data.shipping_region ?? null,

      shipping_country:
        data.shipping_country ?? null,

      shipping_postal_code:
        data.shipping_postal_code ?? null,

      order_items: (
        data.order_items ?? []
      ).map(
        (item): OrderItem => ({
          id: item.id,

          product_id:
            item.product_id ?? "",

          product_name:
            item.product_name ?? "",

          thumbnail:
            item.thumbnail ?? "",

          quantity: parseNumber(
            item.quantity
          ),

          unit_price: parseNumber(
            item.unit_price
          ),

          total_price: parseNumber(
            item.total_price
          ),

          fulfillment_status:
            item.fulfillment_status ??
            "pending_fulfillment",
        })
      ),
    };

  } catch (err) {
    console.error(
      "[ORDER_DETAIL][FETCH_ERROR]",
      {
        message:
          err instanceof Error
            ? err.message
            : "UNKNOWN_ERROR",
      }
    );

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
  const { user, loading: authLoading } =
    useAuth();

  const orderId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : "";

  const {
    data: order,
    isLoading,
  } = useSWR<Order | null>(
    user && orderId
      ? `/api/orders/${orderId}`
      : null,
    fetcher
  );

  /* =====================================================
     LOADING
  ===================================================== */

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted">
          {t.loading_order ??
            "Đang tải đơn hàng..."}
        </p>
      </div>
    );
  }

  /* =====================================================
     NOT FOUND
  ===================================================== */

  if (!order) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-red-500">
          {t.order_not_found ??
            "Không tìm thấy đơn hàng"}
        </p>
      </div>
    );
  }

  /* =====================================================
     UI
  ===================================================== */

  return (
    <main className="min-h-screen bg-[var(--background)] pb-24">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="border-b border-black/5 bg-card px-4 py-4">

        <button
          onClick={() => router.back()}
          className="mb-3 text-sm text-muted transition active:scale-95"
        >
          ← {t.back ?? "Quay lại"}
        </button>

        <div className="flex items-start justify-between gap-3">

          <div>

            <p className="text-base font-bold">
              #{order.order_number}
            </p>

            <p className="mt-1 text-xs text-muted">
              {new Date(
                order.created_at
              ).toLocaleString()}
            </p>

          </div>

          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBgClass(
              order.fulfillment_status
            )} ${getStatusClass(
              order.fulfillment_status
            )}`}
          >
            {t[
              `order_fulfillment_status_${order.fulfillment_status}`
            ] ??
              order.fulfillment_status}
          </div>

        </div>

      </div>

      {/* =====================================================
          SHIPPING
      ===================================================== */}

      <div className="mt-3 bg-card px-4 py-4">

        <p className="mb-3 text-sm font-bold">
          📍{" "}
          {t.shipping_address ??
            "Địa chỉ nhận hàng"}
        </p>

        <p className="text-sm font-medium">
          {order.shipping_name}
        </p>

        <p className="mt-1 text-sm text-muted">
          {order.shipping_phone}
        </p>

        <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
          {[
            order.shipping_address_line,
            order.shipping_ward,
            order.shipping_district,
            order.shipping_region,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>

        {(order.shipping_country ||
          order.shipping_postal_code) && (
          <p className="mt-2 text-xs text-muted">
            {order.shipping_country}

            {order.shipping_postal_code &&
              ` · ${order.shipping_postal_code}`}
          </p>
        )}

      </div>

      {/* =====================================================
          SELLER MESSAGE
      ===================================================== */}

      {order.seller_message && (
        <div className="mt-3 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          ✔ {order.seller_message}
        </div>
      )}

      {order.seller_cancel_reason && (
        <div className="mt-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          ✖ {order.seller_cancel_reason}
        </div>
      )}

      {/* =====================================================
          PRODUCTS
      ===================================================== */}

      <div className="mt-3 bg-card">

        {order.order_items.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 border-b border-black/5 p-4 last:border-none"
          >

            <Image
              src={
                item.thumbnail ||
                "/placeholder.png"
              }
              alt={item.product_name}
              width={88}
              height={88}
              className="h-[88px] w-[88px] rounded-xl border border-black/5 object-cover"
            />

            <div className="min-w-0 flex-1">

              <p className="line-clamp-2 text-sm font-semibold">
                {item.product_name}
              </p>

              <div className="mt-2 flex items-center justify-between">

                <p className="text-xs text-muted">
                  x{item.quantity}
                </p>

                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${getStatusBgClass(
                    item.fulfillment_status
                  )} ${getStatusClass(
                    item.fulfillment_status
                  )}`}
                >
                  {item.fulfillment_status}
                </span>

              </div>

              <p className="pi-price mt-3 text-sm">
                π
                {formatPi(item.total_price)}
              </p>

            </div>

          </div>
        ))}

      </div>

      {/* =====================================================
          TOTAL
      ===================================================== */}

      <div className="mt-3 bg-card px-4 py-4">

        <div className="flex items-center justify-between">

          <p className="text-sm text-muted">
            {t.total ?? "Tổng cộng"}
          </p>

          <p className="pi-price text-lg">
            π{formatPi(order.total)}
          </p>

        </div>

      </div>

      {/* =====================================================
          ACTIONS
      ===================================================== */}

      <div className="space-y-3 px-4 pt-4">
  {order.fulfillment_status ===
          "delivered" && (
          <>
            <button
              onClick={() =>
                router.push(
                  `/customer/orders/${order.id}/return`
                )
              }
              className="btn-primary w-full"
            >
              ↩{" "}
              {t.request_return ??
                "Trả hàng / Hoàn tiền"}
            </button>

            {order.order_items.length >
              0 && (
              <button
                onClick={() =>
                  router.push(
                    `/product/${order.order_items[0]?.product_id}`
                  )
                }
                className="w-full rounded-xl border border-black/10 bg-card py-3 text-sm font-semibold transition active:scale-95"
              >
                {t.buy_again ??
                  "Mua lại"}
              </button>
            )}

          </>
        )}

        {order.fulfillment_status ===
          "cancelled" && (
          <>
            <button className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600">
              {t.view_cancel_detail ??
                "Xem chi tiết huỷ"}
            </button>

            {order.order_items.length >
              0 && (
              <button
                onClick={() =>
                  router.push(
                    `/product/${order.order_items[0]?.product_id}`
                  )
                }
                className="btn-primary w-full"
              >
                {t.buy_again ??
                  "Mua lại"}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
         }
