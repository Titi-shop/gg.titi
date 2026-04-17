"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Search, X } from "lucide-react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ======================================================
   TYPES
====================================================== */

type OrderLite = {
  id: string;
  order_number?: string;
  created_at?: string;
};

type Props = {
  orders: OrderLite[];
  onFiltered: (
    orders: OrderLite[]
  ) => void;
};

/* ======================================================
   COMPONENT
====================================================== */

export default function OrderFilterBar({
  orders,
  onFiltered,
}: Props) {
  const { t } = useTranslation();

  const [search, setSearch] =
    useState("");

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  /* ======================================================
     FILTER
  ====================================================== */

  const filtered = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return orders.filter(
      (order) => {
        const createdAt =
          order.created_at
            ? new Date(
                order.created_at
              ).getTime()
            : 0;

        const from =
          fromDate
            ? new Date(
                fromDate
              ).getTime()
            : null;

        const to =
          toDate
            ? new Date(
                toDate
              ).getTime()
            : null;

        const matchDate =
          (!from ||
            createdAt >= from) &&
          (!to ||
            createdAt <=
              to +
                86400000 -
                1);

        const matchSearch =
          keyword.length === 0 ||
          order.id
            .toLowerCase()
            .includes(
              keyword
            ) ||
          String(
            order.order_number ??
              ""
          )
            .toLowerCase()
            .includes(
              keyword
            );

        return (
          matchDate &&
          matchSearch
        );
      }
    );
  }, [
    orders,
    search,
    fromDate,
    toDate,
  ]);

  /* ======================================================
     PUSH RESULT
  ====================================================== */

  useEffect(() => {
    onFiltered(filtered);
  }, [filtered, onFiltered]);

  /* ======================================================
     HELPERS
  ====================================================== */

  const hasFilter =
    search ||
    fromDate ||
    toDate;

  function resetAll() {
    setSearch("");
    setFromDate("");
    setToDate("");
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <section className="px-4 mt-4 space-y-3">
      {/* SEARCH */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          type="text"
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
          placeholder={
            t.search_order ??
            "Search order ID"
          }
          className="w-full h-11 pl-10 pr-10 rounded-xl border bg-white text-sm outline-none focus:ring-2 focus:ring-gray-300"
        />

        {search && (
          <button
            type="button"
            onClick={() =>
              setSearch("")
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* DATE */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-gray-500 mb-1">
            {t.from_date ??
              "From"}
          </p>

          <input
            type="date"
            value={fromDate}
            onChange={(e) =>
              setFromDate(
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border bg-white text-sm"
          />
        </div>

        <div>
          <p className="text-[11px] text-gray-500 mb-1">
            {t.to_date ??
              "To"}
          </p>

          <input
            type="date"
            value={toDate}
            onChange={(e) =>
              setToDate(
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border bg-white text-sm"
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {filtered.length}{" "}
          {t.orders ??
            "orders"}
        </p>

        {hasFilter ? (
          <button
            type="button"
            onClick={resetAll}
            className="text-xs px-3 py-1.5 rounded-lg border bg-white active:scale-95"
          >
            {t.reset ??
              "Reset"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
