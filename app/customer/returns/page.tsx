"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  Clock3,
  PackageCheck,
  RefreshCcw,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";

/* =======================================================
   TYPES
======================================================= */

type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refund_pending"
  | "refunded"
  | "rejected";

type ReturnRecord = {
  id: string;
  return_number?: string | null;

  order_id: string;
  status: ReturnStatus;

  refund_amount?: string | number | null;

  created_at?: string | null;
  refunded_at?: string | null;

  return_tracking_code?: string | null;

  thumbnail?: string | null;
  product_name?: string | null;
};

/* =======================================================
   STORAGE
======================================================= */

const BASE_STORAGE =
  process.env.NEXT_PUBLIC_SUPABASE_URL +
  "/storage/v1/object/public/";

/* =======================================================
   STATUS CONFIG
======================================================= */

function getStatusConfig(
  status: ReturnStatus,
  t: Record<string, string>
) {
  switch (status) {
    case "pending":
      return {
        icon: Clock3,
        text:
          t.return_pending ??
          "Pending Review",
        className:
          "border-yellow-500/20 bg-yellow-500/10 text-yellow-500",
      };

    case "approved":
      return {
        icon: BadgeCheck,
        text:
          t.return_approved ??
          "Approved",
        className:
          "border-blue-500/20 bg-blue-500/10 text-blue-500",
      };

    case "shipping_back":
      return {
        icon: Truck,
        text:
          t.return_shipping_back ??
          "Shipping Back",
        className:
          "border-indigo-500/20 bg-indigo-500/10 text-indigo-500",
      };

    case "received":
      return {
        icon: PackageCheck,
        text:
          t.return_received ??
          "Received",
        className:
          "border-purple-500/20 bg-purple-500/10 text-purple-500",
      };

    case "refund_pending":
      return {
        icon: RefreshCcw,
        text:
          t.return_refund_pending ??
          "Refund Pending",
        className:
          "border-orange-500/20 bg-orange-500/10 text-orange-500",
      };

    case "refunded":
      return {
        icon: Wallet,
        text:
          t.return_refunded ??
          "Refunded",
        className:
          "border-green-500/20 bg-green-500/10 text-green-500",
      };

    case "rejected":
      return {
        icon: XCircle,
        text:
          t.return_rejected ??
          "Rejected",
        className:
          "border-red-500/20 bg-red-500/10 text-red-500",
      };

    default:
      return {
        icon: Clock3,
        text: status,
        className:
          "border-[var(--border)] bg-[var(--card-secondary)] text-[var(--text-muted)]",
      };
  }
}

/* =======================================================
   HELPERS
======================================================= */

function getImage(src?: string | null) {
  if (!src) return "/placeholder.png";

  if (src.startsWith("http")) {
    return src;
  }

  return BASE_STORAGE + "products/" + src;
}

/* =======================================================
   PAGE
======================================================= */

export default function ReturnsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } =
    useAuth();

  const [returns, setReturns] = useState<
    ReturnRecord[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  /* =======================================================
     LOAD
  ======================================================= */

  useEffect(() => {
    if (authLoading || !user) return;

    async function loadReturns() {
      try {
        const res =
          await apiAuthFetch("/api/returns");

        if (!res.ok) {
          setReturns([]);
          return;
        }

        const data = await res.json();

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];

        setReturns(list);
      } catch (err) {
        console.error(
          "❌ LOAD RETURNS ERROR",
          err
        );

        setReturns([]);
      } finally {
        setLoading(false);
      }
    }

    loadReturns();
  }, [authLoading, user]);

  /* =======================================================
     SORT
  ======================================================= */

  const sortedReturns = useMemo(() => {
    return [...returns].sort((a, b) => {
      const da = a.created_at
        ? new Date(a.created_at).getTime()
        : 0;

      const db = b.created_at
        ? new Date(b.created_at).getTime()
        : 0;

      return db - da;
    });
  }, [returns]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading || authLoading) {
    return (
      <main className="min-h-screen bg-[var(--background)]">
        {/* HEADER */}
        <div
          className="
            sticky top-0 z-30
            border-b border-[var(--border)]
            bg-[var(--nav-bg)]/90
            backdrop-blur-xl
          "
        >
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
            <button
              onClick={() => router.back()}
              className="
                flex h-10 w-10 items-center justify-center
                rounded-xl
                bg-[var(--card-secondary)]
                text-[var(--foreground)]
              "
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <h1 className="text-lg font-bold text-[var(--foreground)]">
                {t.my_returns ??
                  "My Returns"}
              </h1>

              <p className="text-xs text-[var(--text-muted)]">
                {t.loading ??
                  "Loading..."}
              </p>
            </div>
          </div>
        </div>

        {/* SKELETON */}
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="
                animate-pulse rounded-3xl
                border border-[var(--border)]
                bg-[var(--card-bg)]
                p-4
              "
            >
              <div className="flex gap-4">
                <div className="h-20 w-20 rounded-2xl bg-[var(--card-secondary)]" />

                <div className="flex-1 space-y-3">
                  <div className="h-4 w-32 rounded bg-[var(--card-secondary)]" />
                  <div className="h-3 w-24 rounded bg-[var(--card-secondary)]" />
                  <div className="h-3 w-full rounded bg-[var(--card-secondary)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--card-secondary)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="min-h-screen bg-[var(--background)] pb-28 transition-colors duration-300">

      {/* =======================================================
          HEADER
      ======================================================= */}

      <div
        className="
          sticky top-0 z-30
          border-b border-[var(--border)]
          bg-[var(--nav-bg)]/90
          backdrop-blur-xl
        "
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.back()}
            className="
              flex h-10 w-10 items-center justify-center
              rounded-xl
              border border-[var(--border)]
              bg-[var(--card-bg)]
              text-[var(--foreground)]
              transition-all duration-200
              active:scale-95
            "
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1">
            <h1 className="text-lg font-bold text-[var(--foreground)]">
              {t.my_returns ??
                "My Returns"}
            </h1>

            <p className="text-xs text-[var(--text-muted)]">
              {sortedReturns.length}{" "}
              {t.return_requests ??
                "return requests"}
            </p>
          </div>
        </div>
      </div>

      {/* =======================================================
          CONTENT
      ======================================================= */}

      <div className="mx-auto max-w-2xl p-4">

        {/* EMPTY */}
        {sortedReturns.length === 0 && (
          <div
            className="
              mt-10 overflow-hidden rounded-3xl
              border border-dashed border-orange-500/20
              bg-[var(--card-bg)]
              p-10 text-center
            "
          >
            <div
              className="
                mx-auto mb-4 flex h-20 w-20
                items-center justify-center
                rounded-full
                bg-orange-500/10
                text-orange-500
              "
            >
              <RefreshCcw size={34} />
            </div>

            <h2 className="text-lg font-bold text-[var(--foreground)]">
              {t.no_return_requests ??
                "No return requests"}
            </h2>

            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {t.no_return_requests_desc ??
                "Your return requests will appear here."}
            </p>
          </div>
        )}

        {/* LIST */}
        <div className="space-y-4">
          {sortedReturns.map((item) => {
            const config =
              getStatusConfig(
                item.status,
                t as Record<string, string>
              );

            const Icon = config.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  router.push(
                    `/customer/returns/${item.id}`
                  )
                }
                className="
                  group w-full overflow-hidden
                  rounded-3xl
                  border border-orange-500/10
                  bg-[var(--card-bg)]
                  text-left
                  shadow-sm
                  transition-all duration-300
                  hover:border-orange-500/30
                  hover:shadow-lg
                  active:scale-[0.99]
                "
              >
                <div className="p-4">

                  {/* TOP */}
                  <div className="flex gap-4">

                    {/* IMAGE */}
                    <div
                      className="
                        relative h-24 w-24 shrink-0
                        overflow-hidden rounded-2xl
                        border border-orange-500/10
                        bg-[var(--card-secondary)]
                      "
                    >
                      <img
                        src={getImage(
                          item.thumbnail
                        )}
                        alt="product"
                        onError={(e) => {
                          e.currentTarget.src =
                            "/placeholder.png";
                        }}
                        className="
                          h-full w-full object-cover
                          transition-transform duration-300
                          group-hover:scale-105
                        "
                      />
                    </div>

                    {/* INFO */}
                    <div className="min-w-0 flex-1">

                      {/* NUMBER */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className="
                              truncate text-sm font-bold
                              text-[var(--foreground)]
                            "
                          >
                            #
                            {item.return_number ??
                              item.id.slice(
                                0,
                                8
                              )}
                          </p>

                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {t.order ?? "Order"}
                            : #
                            {item.order_id?.slice(
                              0,
                              8
                            )}
                          </p>
                        </div>

                        <ChevronRight
                          size={18}
                          className="
                            mt-1 shrink-0
                            text-[var(--text-muted)]
                          "
                        />
                      </div>

                      {/* STATUS */}
                      <div
                        className={`
                          mt-3 inline-flex items-center gap-2
                          rounded-full border px-3 py-1.5
                          text-xs font-semibold
                          ${config.className}
                        `}
                      >
                        <Icon size={14} />

                        <span>
                          {config.text}
                        </span>
                      </div>

                      {/* PRODUCT */}
                      {item.product_name && (
                        <p
                          className="
                            mt-3 line-clamp-2
                            text-sm text-[var(--foreground)]
                          "
                        >
                          {item.product_name}
                        </p>
                      )}

                    </div>
                  </div>

                  {/* TIMELINE */}
                  {item.status !==
                    "rejected" && (
                    <div className="mt-5">
                      <div className="flex items-center gap-2">
                        {[
                          "pending",
                          "approved",
                          "shipping_back",
                          "received",
                          "refund_pending",
                          "refunded",
                        ].map((step, index) => {
                          const steps = [
                            "pending",
                            "approved",
                            "shipping_back",
                            "received",
                            "refund_pending",
                            "refunded",
                          ];

                          const active =
                            steps.indexOf(
                              item.status
                            ) >= index;

                          return (
                            <div
                              key={step}
                              className="flex flex-1 items-center gap-2"
                            >
                              <div
                                className={`
                                  h-2.5 w-2.5 rounded-full
                                  ${
                                    active
                                      ? "bg-orange-500"
                                      : "bg-[var(--border)]"
                                  }
                                `}
                              />

                              {index !==
                                steps.length -
                                  1 && (
                                <div
                                  className={`
                                    h-[2px] flex-1
                                    ${
                                      active
                                        ? "bg-orange-500"
                                        : "bg-[var(--border)]"
                                    }
                                  `}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* EXTRA */}
                  <div className="mt-4 space-y-2">

                    {/* TRACKING */}
                    {item.return_tracking_code && (
                      <div
                        className="
                          rounded-2xl
                          border border-blue-500/10
                          bg-blue-500/5
                          px-3 py-2
                          text-xs text-blue-500
                        "
                      >
                        🚚{" "}
                        {t.return_tracking ??
                          "Tracking"}
                        :{" "}
                        {
                          item.return_tracking_code
                        }
                      </div>
                    )}

                    {/* REFUND */}
                    {item.refund_amount && (
                      <div
                        className="
                          flex items-center justify-between
                          rounded-2xl
                          border border-green-500/10
                          bg-green-500/5
                          px-3 py-2
                        "
                      >
                        <span className="text-xs text-[var(--text-muted)]">
                          {t.refund_amount ??
                            "Refund Amount"}
                        </span>

                        <span className="text-sm font-bold text-green-500">
                          π
                          {formatPi(
                            Number(
                              item.refund_amount
                            )
                          )}
                        </span>
                      </div>
                    )}

                    {/* DATES */}
                    <div
                      className="
                        flex flex-wrap items-center gap-3
                        text-[11px]
                        text-[var(--text-muted)]
                      "
                    >
                      {item.created_at && (
                        <span>
                          🕒{" "}
                          {new Date(
                            item.created_at
                          ).toLocaleString()}
                        </span>
                      )}

                      {item.refunded_at && (
                        <span className="text-green-500">
                          💸{" "}
                          {new Date(
                            item.refunded_at
                          ).toLocaleString()}
                        </span>
                      )}
                    </div>

                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
