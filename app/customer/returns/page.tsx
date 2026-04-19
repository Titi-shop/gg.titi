"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { getPiAccessToken } from "@/lib/piAuth";

type ReturnRecord = {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
  return_tracking_code: string | null;
  refunded_at: string | null;
};

export default function ReturnsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    async function loadReturns() {
      try {
        const token = await getPiAccessToken();

        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch("/api/returns", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          setReturns(data);
        }
      } catch (err) {
        console.error("Load returns error:", err);
      }

      setLoading(false);
    }

    loadReturns();
  }, [authLoading, user]);

  function getStatusColor(status: string) {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "approved":
        return "bg-green-100 text-green-700";
      case "shipped":
        return "bg-blue-100 text-blue-700";
      case "received":
        return "bg-purple-100 text-purple-700";
      case "refunded":
        return "bg-green-200 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case "pending":
        return t.return_pending ?? "Pending";
      case "approved":
        return t.return_approved ?? "Approved";
      case "shipped":
        return t.return_shipped ?? "Shipped";
      case "received":
        return t.return_received ?? "Received";
      case "refunded":
        return t.return_refunded ?? "Refunded";
      case "rejected":
        return t.return_rejected ?? "Rejected";
      default:
        return status;
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        {t.loading ?? "Loading..."}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-xl mx-auto p-4 space-y-4">

        <h1 className="text-lg font-semibold">
          {t.my_returns ?? "My Returns"}
        </h1>

        {returns.length === 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm text-center text-gray-500">
            {t.no_returns ?? "No return requests yet"}
          </div>
        )}

        {returns.map((r) => (
          <div
            key={r.id}
            onClick={() => router.push(`/customer/returns/${r.id}`)}
            className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition space-y-3"
          >

            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">
                  {t.return_label ?? "Return"} #{r.id}
                </p>

                <p className="text-xs text-gray-400">
                  {t.order ?? "Order"}: {r.order_id}
                </p>
              </div>

              <span
                className={`px-3 py-1 text-xs rounded-full ${getStatusColor(
                  r.status
                )}`}
              >
                {getStatusText(r.status)}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span>{t.return_pending ?? "Pending"}</span>
              <span>→</span>
              <span>{t.return_approved ?? "Approved"}</span>
              <span>→</span>
              <span>{t.return_shipped ?? "Shipped"}</span>
              <span>→</span>
              <span>{t.return_refunded ?? "Refunded"}</span>
            </div>

            {r.return_tracking_code && (
              <div className="text-xs text-blue-600">
                {t.tracking ?? "Tracking"}: {r.return_tracking_code}
              </div>
            )}

            {r.refunded_at && (
              <div className="text-xs text-green-600">
                {t.refunded_at ?? "Refunded at"}:{" "}
                {new Date(r.refunded_at).toLocaleString()}
              </div>
            )}

          </div>
        ))}

      </div>
    </main>
  );
}
