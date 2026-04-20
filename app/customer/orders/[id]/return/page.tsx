"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useState, useEffect, ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";

/* ================= TYPES ================= */

type OrderStatus =
  | "pending"
  | "pickup"
  | "shipping"
  | "completed"
  | "cancelled";

type OrderItem = {
  id: string;
  product_name: string;
  thumbnail?: string;
};

type OrderDetail = {
  id: string;
  status: OrderStatus;
  order_items: OrderItem[];
};

type ReturnItemState = {
  orderItemId: string;
  selected: boolean;
  reason: string;
  files: File[];
  previews: string[];
};

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<OrderDetail | null> => {
  const res = await apiAuthFetch(url);
  if (!res.ok) return null;
  return res.json();
};

/* ================= PAGE ================= */

export default function OrderReturnPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const orderId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : "";

  const [items, setItems] = useState<ReturnItemState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: order, isLoading } = useSWR(
    user && orderId ? `/api/orders/${orderId}` : null,
    fetcher
  );

  /* ================= INIT ================= */

  useEffect(() => {
    if (!order) return;

    if (order.status !== "completed") {
      setError(t.return_only_completed);
      return;
    }

    setItems(
      order.order_items.map((i) => ({
        orderItemId: i.id,
        selected: false,
        reason: "",
        files: [],
        previews: [],
      }))
    );
  }, [order, t]);

  /* ================= IMAGE ================= */

  function handleImageChange(
    e: ChangeEvent<HTMLInputElement>,
    index: number
  ) {
    const list = e.target.files;
    if (!list) return;

    const selected = Array.from(list).slice(0, 3);

    for (const f of selected) {
      if (f.size > 2 * 1024 * 1024) {
        setError(t.return_image_limit);
        return;
      }
    }

    const updated = [...items];

    updated[index].previews.forEach(URL.revokeObjectURL);

    updated[index].files = selected;
    updated[index].previews = selected.map((f) =>
      URL.createObjectURL(f)
    );

    setItems(updated);
  }

  /* ================= UPLOAD ================= */

  async function uploadImages(files: File[]): Promise<string[]> {
    return Promise.all(
      files.map(async (file) => {
        const res = await apiAuthFetch("/api/returns/upload-url", {
          method: "POST",
        });

        if (!res.ok) throw new Error("UPLOAD_URL_FAILED");

        const data = await res.json();

        const uploadRes = await fetch(data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) throw new Error("UPLOAD_FAILED");

        return data.publicUrl;
      })
    );
  }

  /* ================= SUBMIT ================= */

  async function handleSubmit() {
    const selectedItems = items.filter((i) => i.selected);

    if (selectedItems.length === 0) {
      setError(t.return_select_item);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await Promise.all(
        selectedItems.map(async (item) => {
          if (!item.reason.trim()) {
            throw new Error(t.return_reason_required);
          }

          if (item.files.length === 0) {
            throw new Error(t.return_upload_required);
          }

          const imageUrls = await uploadImages(item.files);

          const res = await apiAuthFetch("/api/returns", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orderId,
              orderItemId: item.orderItemId,
              reason: item.reason,
              description: "",
              images: imageUrls,
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || t.return_submit_failed);
          }
        })
      );

      router.push("/customer/returns");

    } catch (err) {
      const message =
        err instanceof Error ? err.message : t.system_error;
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  /* ================= UI ================= */

  if (isLoading || authLoading) {
    return (
      <p className="p-4 text-sm text-gray-500">
        {t.loading}
      </p>
    );
  }

  if (!order) {
    return (
      <p className="p-4 text-red-500">
        {t.order_not_found}
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 space-y-4">

      {/* TITLE */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h1 className="text-lg font-semibold">
          🔄 {t.return_request}
        </h1>
      </div>

      {/* ITEMS */}
      {order.order_items.map((item, index) => {
        const state = items[index];
        if (!state) return null;

        return (
          <div
            key={item.id}
            className={`bg-white rounded-xl p-4 shadow space-y-3 border ${
              state.selected
                ? "border-orange-500"
                : "border-transparent"
            }`}
          >
            {/* HEADER */}
            <div className="flex gap-3 items-center">
              <input
                type="checkbox"
                checked={state.selected}
                onChange={(e) => {
                  const updated = [...items];
                  updated[index].selected = e.target.checked;
                  setItems(updated);
                }}
                className="w-5 h-5"
              />

              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  className="w-14 h-14 rounded-lg object-cover"
                />
              )}

              <p className="text-sm font-medium flex-1">
                {item.product_name}
              </p>
            </div>

            {/* REASON */}
            {state.selected && (
              <input
                value={state.reason}
                onChange={(e) => {
                  const updated = [...items];
                  updated[index].reason = e.target.value;
                  setItems(updated);
                }}
                placeholder={t.return_reason_placeholder}
                className="w-full border rounded-lg p-3 text-sm"
              />
            )}

            {/* IMAGE */}
            {state.selected && (
              <>
                <input
                  type="file"
                  multiple
                  onChange={(e) =>
                    handleImageChange(e, index)
                  }
                  className="text-sm"
                />

                <div className="flex gap-2">
                  {state.previews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      className="w-16 h-16 rounded object-cover"
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* SUBMIT */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-black text-white py-4 rounded-xl font-semibold disabled:opacity-50"
      >
        {submitting
          ? t.return_submitting
          : t.return_submit}
      </button>

    </main>
  );
}
