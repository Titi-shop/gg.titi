"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import { useState, ChangeEvent, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
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
};

type OrderDetail = {
  id: string;
  status: OrderStatus;
  order_items: OrderItem[];
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
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const orderId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : "";

  const [orderItemId, setOrderItemId] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: order, isLoading } = useSWR(
    user && orderId ? `/api/orders/${orderId}` : null,
    fetcher
  );

  /* ================= VALIDATE ================= */

  useEffect(() => {
    if (!order) return;

    if (order.status !== "completed") {
      setError("Only completed orders can be returned");
      return;
    }

    if (order.order_items?.length > 0) {
      setOrderItemId(order.order_items[0].id);
    }
  }, [order]);

  /* ================= IMAGE ================= */

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;

    const selected = Array.from(list).slice(0, 3);

    for (const f of selected) {
      if (f.size > 2 * 1024 * 1024) {
        setError("Max 2MB/image");
        return;
      }
    }

    setFiles(selected);
    setPreviews(selected.map((f) => URL.createObjectURL(f)));
  }

  useEffect(() => {
    return () => {
      previews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previews]);

  /* ================= UPLOAD ================= */

  async function uploadImages(): Promise<string[]> {
    const urls: string[] = [];

    for (const file of files) {
      const form = new FormData();
      form.append("file", file);

      const res = await apiAuthFetch("/api/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("UPLOAD_FAILED");

      const data = await res.json();
      urls.push(data.url);
    }

    return urls;
  }

  /* ================= SUBMIT ================= */

  async function handleSubmit() {
    if (!orderItemId) {
      setError("Order item not found");
      return;
    }

    if (!reason.trim()) {
      setError("Reason required");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      /* upload first */
      const imageUrls = await uploadImages();

      /* send JSON */
      const res = await apiAuthFetch("/api/returns", {
        method: "POST",
        body: JSON.stringify({
          orderId,
          orderItemId,
          reason,
          description,
          images: imageUrls,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Submit failed");
        return;
      }

      router.push("/customer/returns");
    } catch (e) {
      setError("System error");
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
      <h1 className="text-xl font-bold">
        🔄 Return request
      </h1>

      {/* REASON */}
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full border p-2"
        placeholder="Reason"
      />

      {/* DESC */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full border p-2"
      />

      {/* IMAGE */}
      <input
        type="file"
        multiple
        onChange={handleImageChange}
      />

      {previews.length > 0 && (
        <div className="flex gap-2">
          {previews.map((src, i) => (
            <img key={i} src={src} className="w-20 h-20 object-cover" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-red-500">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-black text-white p-2"
      >
        Submit
      </button>
    </main>
  );
}
