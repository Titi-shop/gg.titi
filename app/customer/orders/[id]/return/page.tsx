"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import {
  useState,
  useEffect,
  ChangeEvent,
  useRef,
  useCallback,
} from "react";
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
  reasonValue: string; // dropdown
  reasonText: string;  // when "other"
  files: File[];
  previews: string[];
};

/* ================= FETCHER ================= */

const fetcher = async (url: string): Promise<OrderDetail | null> => {
  const res = await apiAuthFetch(url);
  if (!res.ok) return null;
  return res.json();
};

/* ================= IMAGE COMPRESS ================= */

async function compressImage(file: File): Promise<File> {
  // giữ type
  const type = file.type || "image/jpeg";

  const img = document.createElement("img");
  const blobUrl = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject();
    img.src = blobUrl;
  });

  // resize tối đa 1280px
  const maxW = 1280;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(img, 0, 0, w, h);

  const quality = 0.7; // 0.6–0.8 tuỳ bạn
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), type, quality)
  );

  URL.revokeObjectURL(blobUrl);

  // trả về file mới
  return new File([blob], file.name, { type });
}

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

  const draftKey = `return_draft_${orderId}`;

  const [items, setItems] = useState<ReturnItemState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const initialized = useRef(false);
  const isDirtyRef = useRef(false);

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

  /* ================= INIT (NO RESET ON I18N) ================= */

  useEffect(() => {
    if (!order || initialized.current) return;

    // try load draft first
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ReturnItemState[];
        setItems(parsed);
        initialized.current = true;
        return;
      } catch {
        // fallback to fresh
      }
    }

    if (order.status !== "completed") {
      setError(t.return_only_completed);
      initialized.current = true;
      return;
    }

    setItems(
      order.order_items.map((i) => ({
        orderItemId: i.id,
        selected: false,
        reasonValue: "",
        reasonText: "",
        files: [],
        previews: [],
      }))
    );

    initialized.current = true;
    // ⚠️ không thêm `t` vào deps để tránh reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, draftKey]);

  /* ================= AUTOSAVE ================= */

  useEffect(() => {
    if (!initialized.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(items));
      isDirtyRef.current = true;
    } catch {
      // ignore quota
    }
  }, [items, draftKey]);

  /* ================= LEAVE WARNING ================= */

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current || submitting) return;
      e.preventDefault();
      e.returnValue = ""; // required
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [submitting]);

  const confirmLeave = useCallback(() => {
    if (!isDirtyRef.current || submitting) return true;
    return window.confirm(t.return_leave_warning);
  }, [submitting, t]);

  /* ================= IMAGE ================= */

  async function handleImageChange(
    e: ChangeEvent<HTMLInputElement>,
    index: number
  ) {
    const list = e.target.files;
    if (!list) return;

    const selected = Array.from(list);

    const updated = [...items];
    const currentFiles = updated[index].files;

    // merge + max 3
    let merged = [...currentFiles, ...selected].slice(0, 3);

    // validate size (raw)
    for (const f of merged) {
      if (f.size > 5 * 1024 * 1024) {
        setError(t.return_image_limit); // you can adjust message
        return;
      }
    }

    // compress all new files
    const compressed = await Promise.all(
      merged.map(async (f) => compressImage(f))
    );

    // revoke old previews
    updated[index].previews.forEach(URL.revokeObjectURL);

    updated[index].files = compressed;
    updated[index].previews = compressed.map((f) =>
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

        return data.publicUrl as string;
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
          const finalReason =
            item.reasonValue === "other"
              ? item.reasonText
              : item.reasonValue;

          if (!finalReason || !finalReason.trim()) {
            throw new Error(t.return_reason_required);
          }

          if (item.files.length === 0) {
            throw new Error(t.return_upload_required);
          }

          const imageUrls = await uploadImages(item.files);

          const res = await apiAuthFetch("/api/returns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              orderItemId: item.orderItemId,
              reason: finalReason,
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

      // clear draft on success
      localStorage.removeItem(draftKey);
      isDirtyRef.current = false;

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
                {/* REASON */}
                <select
                  value={state.reasonValue}
                  onChange={(e) => {
                    const updated = [...items];
                    updated[index].reasonValue = e.target.value;
                    if (e.target.value !== "other") {
                      updated[index].reasonText = "";
                    }
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

                {state.reasonValue === "other" && (
                  <input
                    value={state.reasonText}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[index].reasonText = e.target.value;
                      setItems(updated);
                    }}
                    placeholder={t.return_reason_placeholder}
                    className="w-full border rounded-lg p-3 text-sm"
                  />
                )}

                {/* IMAGE GRID */}
                <div className="grid grid-cols-4 gap-2">
                  {state.previews.map((src, i) => (
                    <div key={i} className="relative h-20">
                      <img
                        src={src}
                        className="w-full h-full object-cover rounded"
                      />
                      <button
                        onClick={() =>
                          removeImage(index, i)
                        }
                        className="absolute -top-2 -right-2 bg-black text-white w-5 h-5 rounded-full text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {state.files.length < 3 && (
                    <label className="border rounded flex items-center justify-center h-20 cursor-pointer text-gray-400">
                      +
                      <input
                        hidden
                        type="file"
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
        onClick={() => {
          if (!confirmLeave()) return;
          handleSubmit();
        }}
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
