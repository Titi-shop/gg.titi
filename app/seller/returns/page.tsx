"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";

import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

/* =====================================================
   TYPES
===================================================== */

type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refund_pending"
  | "refunded"
  | "rejected";

type SellerReturnAction =
  | "approve"
  | "reject"
  | "received";

type ReturnItem = {
  id: string;
  return_number: string;
  status: ReturnStatus;
  created_at: string | null;

  product_name: string;
  thumbnail: string;
  quantity: number;
};

type ReturnDetail = {
  id: string;
  status: ReturnStatus;
  reason: string;

  description?: string | null;

  evidence_images?: string[];

  return_tracking_code?: string;
};

/* =====================================================
   PAGE
===================================================== */

export default function SellerReturnsPage() {

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const { t } = useTranslation();

  const [items, setItems] =
    useState<ReturnItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [tab, setTab] =
    useState<
      ReturnStatus | "all"
    >("all");

  /* ================= SHEET ================= */

  const [openId, setOpenId] =
    useState<string | null>(
      null
    );

  const [detail, setDetail] =
    useState<ReturnDetail | null>(
      null
    );

  const [
    loadingDetail,
    setLoadingDetail,
  ] = useState(false);

  const [acting, setActing] =
    useState(false);

  /* =====================================================
     LOAD LIST
  ===================================================== */

  useEffect(() => {
    if (
      authLoading ||
      !user
    ) {
      return;
    }

    void load();

  }, [
    authLoading,
    user,
    tab,
  ]);

  async function load() {

    try {
      setLoading(true);

      const url =
        tab === "all"
          ? "/api/seller/returns"
          : `/api/seller/returns?status=${tab}`;

      const res =
        await apiAuthFetch(
          url
        );

      if (!res.ok) {
        return;
      }

      const json:
        | {
            items?: ReturnItem[];
          }
        | undefined =
        await res.json();

      setItems(
        json?.items ?? []
      );

    } catch (error) {
      console.error(
        "[SELLER_RETURNS][LOAD]",
        error
      );

    } finally {
      setLoading(false);
    }
  }

  /* =====================================================
     LOAD DETAIL
  ===================================================== */

  async function openDetail(
    id: string
  ) {
    try {
      setOpenId(id);

      setLoadingDetail(
        true
      );

      const res =
        await apiAuthFetch(
          `/api/seller/returns/${id}`
        );

      if (!res.ok) {
        return;
      }

      const json:
        | ReturnDetail
        | undefined =
        await res.json();

      setDetail(
        json ?? null
      );

    } catch (error) {
      console.error(
        "[SELLER_RETURNS][DETAIL]",
        error
      );

    } finally {
      setLoadingDetail(
        false
      );
    }
  }

  function closeSheet() {
    setOpenId(null);
    setDetail(null);
  }

  /* =====================================================
     ACTION
  ===================================================== */

  async function handleAction(
    action: SellerReturnAction
  ) {

    if (
      !openId ||
      acting
    ) {
      return;
    }

    try {
      setActing(true);

      const res =
        await apiAuthFetch(
          `/api/seller/returns/${openId}/${action}`,
          {
            method: "POST",
          }
        );

      if (!res.ok) {

        const json:
          | {
              error?: string;
            }
          | undefined =
          await res
            .json()
            .catch(
              () =>
                undefined
            );

        alert(
          json?.error ??
            t.action_failed ??
            "Action failed"
        );

        return;
      }

      await Promise.all([
        openDetail(openId),
        load(),
      ]);

    } catch (error) {
      console.error(
        "[SELLER_RETURNS][ACTION]",
        error
      );

    } finally {
      setActing(false);
    }
  }

  /* =====================================================
     STATUS
  ===================================================== */

  function getStatusLabel(
    status: ReturnStatus
  ) {

    switch (status) {

      case "pending":
        return t.pending;

      case "approved":
        return t.approved;

      case "shipping_back":
        return (
          t.shipping_back
        );

      case "received":
        return t.received;

      case "refund_pending":
        return (
          t.refund_pending
        );

      case "refunded":
        return t.refunded;

      case "rejected":
        return t.rejected;

      default:
        return status;
    }
  }

  function getStatusColor(
    status: ReturnStatus
  ) {

    switch (status) {

      case "pending":
        return "bg-yellow-100 text-yellow-700";

      case "approved":
        return "bg-blue-100 text-blue-700";

      case "shipping_back":
        return "bg-indigo-100 text-indigo-700";

      case "received":
        return "bg-purple-100 text-purple-700";

      case "refund_pending":
        return "bg-orange-100 text-orange-700";

      case "refunded":
        return "bg-green-100 text-green-700";

      case "rejected":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  /* =====================================================
     TABS
  ===================================================== */

  const tabs: (
    | ReturnStatus
    | "all"
  )[] = [
    "all",
    "pending",
    "approved",
    "shipping_back",
    "received",
    "refund_pending",
    "refunded",
    "rejected",
  ];

  /* =====================================================
     UI
  ===================================================== */

  return (
    <main className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <div className="bg-primary text-white px-4 py-4 font-semibold shadow">
        {t.return_orders}
      </div>

      {/* TABS */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex gap-2 px-3 py-2 min-w-max">

          {tabs.map(
            (tabKey) => (
              <button
                key={tabKey}
                onClick={() =>
                  setTab(
                    tabKey
                  )
                }
                className={`px-3 py-1 text-sm rounded-full transition ${
                  tab === tabKey
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {t[
                  tabKey
                ] ?? tabKey}
              </button>
            )
          )}

        </div>
      </div>

      {/* LIST */}
      <div className="p-3 space-y-3">

        {loading && (
          <p className="text-center text-sm text-gray-500">
            Loading...
          </p>
        )}

        {!loading &&
          items.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-500">
              No returns found
            </div>
          )}

        {items.map(
          (item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                openDetail(
                  item.id
                )
              }
              className="w-full bg-white rounded-xl p-3 flex gap-3 shadow-sm text-left"
            >

              <img
                src={
                  item.thumbnail ||
                  "/placeholder.png"
                }
                alt={
                  item.product_name
                }
                className="w-20 h-20 rounded object-cover bg-gray-100"
              />

              <div className="flex-1 min-w-0">

                <p className="text-sm font-medium line-clamp-2">
                  {
                    item.product_name
                  }
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Qty:{" "}
                  {
                    item.quantity
                  }
                </p>

                <div className="flex items-center justify-between mt-3 gap-2">

                  <span
                    className={`text-xs px-2 py-1 rounded whitespace-nowrap ${getStatusColor(
                      item.status
                    )}`}
                  >
                    {getStatusLabel(
                      item.status
                    )}
                  </span>

                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {item.created_at
                      ? new Date(
                          item.created_at
                        ).toLocaleString()
                      : "-"}
                  </span>

                </div>
              </div>
            </button>
          )
        )}

      </div>

      {/* =====================================================
         BOTTOM SHEET
      ===================================================== */}

      {openId && (
        <div className="fixed inset-0 z-50">

          {/* OVERLAY */}
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={
              closeSheet
            }
          />

          {/* SHEET */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 animate-slideUp max-h-[80vh] overflow-auto">

            {/* HANDLE */}
            <div className="w-10 h-1 bg-gray-300 rounded mx-auto mb-3" />

            {loadingDetail && (
              <p className="text-sm text-gray-500">
                Loading...
              </p>
            )}

            {detail && (
              <>

                <p className="font-semibold text-lg">
                  {
                    t.return_detail
                  }
                </p>

                {/* STATUS */}
                <div className="mt-3">
                  <span
                    className={`px-2 py-1 text-xs rounded ${getStatusColor(
                      detail.status
                    )}`}
                  >
                    {getStatusLabel(
                      detail.status
                    )}
                  </span>
                </div>

                {/* REASON */}
                <div className="mt-5">

                  <p className="text-sm font-semibold">
                    {t.reason}
                  </p>

                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                    {
                      detail.reason
                    }
                  </p>

                </div>

                {/* IMAGES */}
                {!!detail
                  .evidence_images
                  ?.length && (
                  <div className="flex gap-2 mt-4 overflow-x-auto">

                    {detail.evidence_images.map(
                      (
                        image,
                        index
                      ) => (
                        <img
                          key={`${image}-${index}`}
                          src={
                            image
                          }
                          alt={`evidence-${index}`}
                          className="w-20 h-20 rounded object-cover bg-gray-100"
                        />
                      )
                    )}

                  </div>
                )}

                {/* ACTIONS */}
                <div className="mt-6 space-y-2">

                  {detail.status ===
                    "pending" && (
                    <div className="flex gap-2">

                      <button
                        type="button"
                        disabled={
                          acting
                        }
                        onClick={() =>
                          handleAction(
                            "approve"
                          )
                        }
                        className="flex-1 bg-green-500 disabled:opacity-50 text-white py-3 rounded-lg font-medium"
                      >
                        {acting
                          ? "..."
                          : t.approve}
                      </button>

                      <button
                        type="button"
                        disabled={
                          acting
                        }
                        onClick={() =>
                          handleAction(
                            "reject"
                          )
                        }
                        className="flex-1 bg-red-500 disabled:opacity-50 text-white py-3 rounded-lg font-medium"
                      >
                        {acting
                          ? "..."
                          : t.reject}
                      </button>

                    </div>
                  )}

                  {detail.status ===
                    "shipping_back" && (
                    <button
                      type="button"
                      disabled={
                        acting
                      }
                      onClick={() =>
                        handleAction(
                          "received"
                        )
                      }
                      className="w-full bg-primary disabled:opacity-50 text-white py-3 rounded-lg font-medium"
                    >
                      {acting
                        ? "..."
                        : t.mark_received}
                    </button>
                  )}

                </div>

              </>
            )}
          </div>
        </div>
      )}

      {/* ANIMATION */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }

          to {
            transform: translateY(0);
          }
        }

        .animate-slideUp {
          animation: slideUp 0.25s ease;
        }
      `}</style>

    </main>
  );
}
