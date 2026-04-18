"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useState, useEffect, ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

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
  unit_price?: number;
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
      setError("Only completed orders can be returned");
      return;
    }

    const mapped = order.order_items.map((i) => ({
      orderItemId: i.id,
      selected: false,
      reason: "",
      files: [],
      previews: [],
    }));

    setItems(mapped);
  }, [order]);

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
        setError("Max 2MB/image");
        return;
      }
    }

    const updated = [...items];

    // cleanup old preview
    updated[index].previews.forEach((u) =>
      URL.revokeObjectURL(u)
    );

    updated[index].files = selected;
    updated[index].previews = selected.map((f) =>
      URL.createObjectURL(f)
    );

    setItems(updated);
  }

  /* ================= UPLOAD ================= */

  async function uploadImages(files: File[]): Promise<string[]> {
    const urls: string[] = [];

    for (const file of files) {
      const res = await apiAuthFetch("/api/returns/upload-url", {
        method: "POST",
      });

      if (!res.ok) throw new Error("UPLOAD_URL_FAILED");

      const { uploadUrl, publicUrl } = await res.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("UPLOAD_FAILED");

      urls.push(publicUrl);
    }

    return urls;
  }

  /* ================= SUBMIT ================= */

  async function handleSubmit() {
    if (!order || order.status !== "completed") {
      setError("Order not returnable");
      return;
    }

    const selectedItems = items.filter((i) => i.selected);

    if (selectedItems.length === 0) {
      setError("Select at least 1 item");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      for (const item of selectedItems) {
        if (!item.reason.trim()) {
          setError("Reason required");
          return;
        }

        if (item.files.length === 0) {
          setError("Please upload images");
          return;
        }

        const imageUrls = await uploadImages(item.files);

        console.log("[RETURN SUBMIT]", {
          orderId,
          orderItemId: item.orderItemId,
          imageUrls,
        });

        const res = await apiAuthFetch("/api/returns", {
          method: "POST",
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
          throw new Error(data?.error || "Submit failed");
        }
      }

      router.push("/customer/returns");

    } catch (err: any) {
      console.error("RETURN ERROR:", err);
      setError(err.message || "System error");
    } finally {
      setSubmitting(false);
    }
  }

  /* ================= UI ================= */

  if (isLoading || authLoading) {
    return <p className="p-4">Loading...</p>;
  }

  if (!order) {
    return <p className="p-4 text-red-500">Order not found</p>;
  }

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4">

      <h1 className="text-lg font-bold">
        🔄 Return request
      </h1>

      {/* ITEM LIST */}
      {order.order_items.map((item, index) => {
        const state = items[index];

        return (
          <div
            key={item.id}
            className="bg-white p-3 rounded-xl border space-y-2"
          >
            {/* SELECT */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state?.selected || false}
                onChange={(e) => {
                  const updated = [...items];
                  updated[index].selected = e.target.checked;
                  setItems(updated);
                }}
              />
              <span className="text-sm font-medium">
                {item.product_name}
              </span>
            </label>

            {/* REASON */}
            {state?.selected && (
              <input
                value={state.reason}
                onChange={(e) => {
                  const updated = [...items];
                  updated[index].reason = e.target.value;
                  setItems(updated);
                }}
                placeholder="Reason"
                className="w-full border p-2 text-sm rounded"
              />
            )}

            {/* IMAGE */}
            {state?.selected && (
              <>
                <input
                  type="file"
                  multiple
                  onChange={(e) =>
                    handleImageChange(e, index)
                  }
                />

                <div className="flex gap-2">
                  {state.previews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      className="w-16 h-16 object-cover rounded"
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
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {/* SUBMIT */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-black text-white p-3 rounded-lg disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit return"}
      </button>

    </main>
  );
}
