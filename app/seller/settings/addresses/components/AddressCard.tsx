"use client";

import { SellerAddress } from "../types";

type Props = {
  item: SellerAddress;
  onSetDefault?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const typeLabel: Record<SellerAddress["type"], string> = {
  return: "Return",
  warehouse: "Warehouse",
  pickup: "Pickup",
  support: "Support",
};

export default function AddressCard({
  item,
  onSetDefault,
  onDelete,
}: Props) {
  return (
    <div className="rounded-2xl border p-4 bg-[var(--card-bg)] space-y-2">

      {/* TYPE + DEFAULT */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-orange-500">
          {typeLabel[item.type]}
        </span>

        {item.is_default && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500">
            Default
          </span>
        )}
      </div>

      {/* NAME */}
      {item.recipient_name ? (
        <p className="text-sm font-semibold">
          {item.recipient_name}
        </p>
      ) : null}

      {/* PHONE */}
      {item.phone ? (
        <p className="text-xs text-[var(--text-muted)]">
          📞 {item.phone}
        </p>
      ) : null}

      {/* ADDRESS */}
      <p className="text-sm">
        {item.address_line}
      </p>

      {/* LOCATION */}
      <p className="text-xs text-[var(--text-muted)]">
        {[
          item.ward,
          item.district,
          item.province,
          item.country,
        ]
          .filter(Boolean)
          .join(", ")}
      </p>

      {/* ACTIONS */}
      <div className="flex gap-2 pt-2">
        {!item.is_default && (
          <button
            onClick={() => onSetDefault?.(item.id)}
            className="px-3 py-1 text-xs rounded-lg bg-blue-500/10 text-blue-500"
          >
            Set Default
          </button>
        )}

        <button
          onClick={() => onDelete?.(item.id)}
          className="px-3 py-1 text-xs rounded-lg bg-red-500/10 text-red-500"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
