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

  /* ================= REASONS ================= */

  const reasons = [
    { value: "damaged", label: t.return_reason_damaged },
    { value: "wrong_item", label: t.return_reason_wrong },
    { value: "not_as_described", label: t.return_reason_not_match },
    { value: "other", label: t.return_reason_other },
  ];

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

    const selected = Array.from(list);

    const updated = [...items];

    const currentFiles = updated[index].files;

    const merged = [...currentFiles, ...selected].slice(0, 3);

    for (const f of merged) {
      if (f.size > 2 * 1024 * 1024) {
        setError(t.return_image_limit);
        return;
      }
    }

    updated[index].previews.forEach(URL.revokeObjectURL);

    updated[index].files = merged;
    updated[index].previews = merged.map((f) =>
      URL.createObjectURL(f)
    );

    setItems(updated);
  }

  function removeImage(index: number, imgIndex: number) {
    const updated = [...items];

    updated[index].files.splice(imgIndex, 1);
    updated[index].previews.splice(imgIndex, 1);

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
          if (!item.reason) {
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
      const msg =
        err instanceof Error ? err.message : t.system_error;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  /* ================= UI ================= */

  if (isLoading || authLoading) {
    return <p className="p-4">{t.loading}</p>;
  }

  if (!order) {
    return <p className="p-4 text-red-500">{t.order_not_found}</p>;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 space-y-4">

      <h1 className="text-lg font-semibold">
        🔄 {t.return_request}
      </h1>

      {order.order_items.map((item, index) => {
        const state = items[index];
        if (!state) return null;

        return (
          <div
            key={item.id}
            className={`bg-white rounded-xl p-4 shadow space-y-3 border ${
              state.selected ? "border-orange-500" : ""
            }`}
          >
            {/* HEADER */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={state.selected}
                onChange={(e) => {
                  const updated = [...items];
                  updated[index].selected = e.target.checked;
                  setItems(updated);
                }}
              />

              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  className="w-14 h-14 rounded-lg object-cover"
                />
              )}

              <p className="text-sm font-medium">
                {item.product_name}
              </p>
            </div>

            {/* FORM */}
            {state.selected && (
              <>
                {/* REASON DROPDOWN */}
                <select
                  value={state.reason}
                  onChange={(e) => {
                    const updated = [...items];
                    updated[index].reason = e.target.value;
                    setItems(updated);
                  }}
                  className="w-full border rounded-lg p-3 text-sm"
                >
                  <option value="">
                    {t.return_select_reason}
                  </option>
                  {reasons.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>

                {/* IMAGE GRID */}
                <div className="grid grid-cols-4 gap-2">

                  {state.previews.map((src, i) => (
                    <div
                      key={i}
                      className="relative w-full h-20"
                    >
                      <img
                        src={src}
                        className="w-full h-full object-cover rounded"
                      />

                      <button
                        onClick={() =>
                          removeImage(index, i)
                        }
                        className="absolute -top-2 -right-2 bg-black text-white text-xs w-5 h-5 rounded-full"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* ADD BUTTON */}
                  {state.files.length < 3 && (
                    <label className="border rounded flex items-center justify-center text-gray-400 text-sm cursor-pointer h-20">
                      +
                      <input
                        type="file"
                        hidden
                        onChange={(e) =>
                          handleImageChange(e, index)
                        }
                      />
                    </label>
                  )}

                </div>

                <p className="text-xs text-gray-400">
                  {t.return_max_3_images}
                </p>
              </>
            )}
          </div>
        );
      })}

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded">
          {error}
        </div>
      )}

      {/* SUBMIT */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-black text-white py-4 rounded-xl font-semibold"
      >
        {submitting
          ? t.return_submitting
          : t.return_submit}
      </button>

    </main>
  );
}
