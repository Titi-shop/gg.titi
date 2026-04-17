"use client";

import { formatPi } from "@/lib/pi";
import CustomerOrderActions from "./CustomerOrderActions";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

type Props = {
  order: any;
  onDetail: () => void;
  onCancel?: () => void;
  onReceived?: () => void;
  onBuyAgain?: () => void;
};

export default function CustomerOrderCard({
  order,
  onDetail,
  onCancel,
  onReceived,
  onBuyAgain,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">

      {/* HEADER */}
      <div className="flex justify-between px-4 py-3 border-b bg-gray-50 text-sm">
        <span className="font-medium">
          #{order.order_number}
        </span>

        <span className="text-orange-500 font-medium">
          {t[`order_${order.status}`] ?? order.status}
        </span>
      </div>

      {/* ITEMS */}
      <div className="divide-y">
        {order.order_items?.map(
          (item: any, idx: number) => (
            <div
              key={idx}
              className="flex gap-3 p-4"
            >
              <img
                src={
                  item.thumbnail ||
                  item.images?.[0] ||
                  "/placeholder.png"
                }
                className="w-16 h-16 rounded-lg object-cover bg-gray-100"
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2">
                  {item.product_name}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  x{item.quantity} · π
                  {formatPi(item.unit_price)}
                </p>

                {item.seller_message && (
                  <p className="text-xs text-green-600 mt-1">
                    💌 {item.seller_message}
                  </p>
                )}

                {item.seller_cancel_reason &&
                  order.status === "cancelled" && (
                    <p className="text-xs text-red-500 mt-1">
                      {item.seller_cancel_reason}
                    </p>
                  )}
              </div>
            </div>
          )
        )}
      </div>

      {/* FOOTER */}
      <div
        className="px-4 py-3 border-t bg-gray-50 flex justify-between items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm">
          {t.total ?? "Total"}:{" "}
          <b>π{formatPi(order.total)}</b>
        </span>

        <CustomerOrderActions
          status={order.status}
          onDetail={onDetail}
          onCancel={onCancel}
          onReceived={onReceived}
          onBuyAgain={onBuyAgain}
        />
      </div>
    </div>
  );
}
