"use client";

import Image from "next/image";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";

/* ======================================================
   TYPES
====================================================== */

export interface OrderItem {
  id: string;
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: string;
  order_number: string;
  created_at: string;
  shipping_name?: string;
  total: number;
  order_items: OrderItem[];
}

type Props = {
  order: Order;
  onClick?: () => void;
  actions?: React.ReactNode;
};

/* ======================================================
   HELPERS
====================================================== */

function formatDate(
  value: string
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );
}

/* ======================================================
   COMPONENT
====================================================== */

export default function OrderCard({
  order,
  onClick,
  actions,
}: Props) {
  const { t } =
    useTranslation();

  const items =
    order.order_items ?? [];

  const totalQty =
    items.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );

  return (
    <article
      onClick={onClick}
      className="bg-white rounded-2xl border shadow-sm overflow-hidden active:scale-[0.998] transition cursor-pointer"
    >
      {/* HEADER */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            #
            {
              order.order_number
            }
          </p>

          <p className="text-xs text-gray-500 mt-1">
            {formatDate(
              order.created_at
            )}
          </p>
        </div>

        <span className="text-[11px] px-2 py-1 rounded-full bg-gray-200 text-gray-700 whitespace-nowrap">
          {items.length}{" "}
          {t.items ??
            "items"}
        </span>
      </div>

      {/* CUSTOMER */}
      {order.shipping_name ? (
        <div className="px-4 py-3 border-b text-sm">
          <span className="text-gray-500">
            {t.customer ??
              "Customer"}
            :
          </span>{" "}
          <span className="font-medium">
            {
              order.shipping_name
            }
          </span>
        </div>
      ) : null}

      {/* PRODUCTS */}
      <div className="divide-y">
        {items.map(
          (item) => (
            <div
              key={item.id}
              className="flex gap-3 p-4"
            >
              {/* IMAGE */}
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                <Image
                  src={
                    item.thumbnail ||
                    "/placeholder.png"
                  }
                  alt={
                    item.product_name
                  }
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>

              {/* INFO */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2">
                  {
                    item.product_name
                  }
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  x
                  {
                    item.quantity
                  }{" "}
                  · π
                  {formatPi(
                    item.unit_price
                  )}
                </p>
              </div>
            </div>
          )
        )}
      </div>

      {/* FOOTER */}
      <div
        className="px-4 py-3 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        {/* TOTAL */}
        <div className="text-sm">
          <p className="text-gray-500 text-xs">
            {totalQty}{" "}
            {t.quantity ??
              "qty"}
          </p>

          <p className="font-semibold">
            {t.total ??
              "Total"}
            : π
            {formatPi(
              order.total
            )}
          </p>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end">
          {actions}
        </div>
      </div>
    </article>
  );
}
