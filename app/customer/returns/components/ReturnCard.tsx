"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { formatPi } from "@/lib/pi";

import type { ReturnRecord } from "../types";
import { getImage, getStatusConfig } from "../utils";

type Props = {
  item: ReturnRecord;
};

export default function ReturnCard({ item }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  const config = getStatusConfig(item.status, t as Record<string, string>);
  const Icon = config.icon;

  const orderId =
    item.order_id && item.order_id !== "null"
      ? item.order_id
      : null;

  const goOrder = () => {
    if (orderId) router.push(`/customer/orders/${orderId}`);
  };

  const goReturn = () => {
    router.push(`/customer/returns/${item.id}`);
  };

  const goShip = () => {
    router.push(`/customer/returns/${item.id}/shipping`);
  };

  const steps = [
    "pending",
    "approved",
    "shipping_back",
    "received",
    "refund_pending",
    "refunded",
  ];

  const status = item.status;

  return (
    <div className="group w-full overflow-hidden rounded-3xl border border-orange-500/10 bg-[var(--card-bg)] shadow-sm transition hover:border-orange-500/30 hover:shadow-lg">
      <div className="p-4">

        {/* HEADER */}
        <div className="flex gap-4">

          <div className="h-24 w-24 overflow-hidden rounded-2xl border bg-[var(--card-secondary)]">
            <img
              src={getImage(item.thumbnail)}
              onError={(e) => (e.currentTarget.src = "/placeholder.png")}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">

            {/* CLICK HEADER -> ORDER */}
            <div
              className="flex cursor-pointer items-start justify-between"
              onClick={goOrder}
            >
              <div>
                <p className="text-sm font-bold">
                  #{item.return_number ?? item.id.slice(0, 8)}
                </p>

                <p className="text-xs text-muted">
                  {t.order ?? "Order"}: #{orderId?.slice(0, 8) ?? "---"}
                </p>
              </div>

              <ChevronRight size={18} />
            </div>

            {/* STATUS */}
            <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}>
              <Icon size={14} />
              {config.text}
            </div>

            {/* PRODUCT */}
            {item.product_name && (
              <p className="mt-2 text-sm">{item.product_name}</p>
            )}
          </div>
        </div>

        {/* TIMELINE */}
        {!["rejected", "cancelled"].includes(status) && (
          <div className="mt-5 flex gap-2">
            {steps.map((s, i) => {
              const active = steps.indexOf(status) >= i;

              return (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${active ? "bg-orange-500" : "bg-gray-300"}`} />
                  {i < steps.length - 1 && (
                    <div className={`h-[2px] flex-1 ${active ? "bg-orange-500" : "bg-gray-300"}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* INFO */}
        <div className="mt-4 space-y-2">

          {item.return_tracking_code && (
            <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-600">
              🚚 {item.return_tracking_code}
            </div>
          )}

          {item.refund_amount && (
            <div className="flex justify-between rounded-xl bg-green-50 px-3 py-2">
              <span className="text-xs text-muted">
                {t.refund_amount ?? "Refund"}
              </span>
              <span className="text-sm font-bold text-green-600">
                π{formatPi(Number(item.refund_amount))}
              </span>
            </div>
          )}
        </div>

        {/* ACTIONS (IMPORTANT PART) */}
        <div className="mt-4 flex flex-wrap gap-2">

          {/* ALWAYS: VIEW RETURN */}
          <button onClick={goReturn} className="btn-secondary">
            {t.view_return ?? "View Return"}
          </button>

          {/* ALWAYS: VIEW ORDER (SECONDARY) */}
          {orderId && (
            <button onClick={goOrder} className="btn-outline">
              {t.view_order ?? "View Order"}
            </button>
          )}

          {/* PENDING */}
          {status === "pending" && (
            <>
              <button className="btn-danger">
                {t.cancel_return ?? "Cancel Return"}
              </button>
            </>
          )}

          {/* APPROVED */}
          {status === "approved" && (
            <>
              <button onClick={goShip} className="btn-primary">
                {t.ship_return ?? "Ship Return"}
              </button>
            </>
          )}

          {/* SHIPPING BACK */}
          {status === "shipping_back" && (
            <button className="btn-primary">
              {t.track_return ?? "Track Return"}
            </button>
          )}

          {/* RECEIVED */}
          {status === "received" && (
            <button className="btn-secondary">
              {t.waiting_refund ?? "Waiting Refund"}
            </button>
          )}

          {/* REFUNDED */}
          {status === "refunded" && (
            <button className="btn-success">
              {t.view_refund ?? "View Refund"}
            </button>
          )}

          {/* REJECTED */}
          {status === "rejected" && (
            <button className="btn-danger">
              {t.view_reason ?? "View Reason"}
            </button>
          )}
        </div>

        {/* DATES */}
        <div className="mt-3 text-[11px] text-muted">
          {item.created_at && (
            <span>🕒 {new Date(item.created_at).toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  );
              }
