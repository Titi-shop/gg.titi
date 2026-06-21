"use client";

export const dynamic = "force-dynamic";

import useSWR from "swr";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
} from "react";

import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

/* =========================================================
   TYPES
========================================================= */

type OrderStatus =
  | "pending_fulfillment"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refunded"
  | "rejected";

type OrderItem = {
  id: string;
  product_name: string;
  thumbnail?: string | null;
};

type OrderDetail = {
  id: string;

  fulfillment_status: OrderStatus;

  return_status?: ReturnStatus | null;

  order_items: OrderItem[];
};

type ReturnItemState = {
  orderItemId: string;

  selected: boolean;

  reasonValue: string;

  reasonText: string;

  files: File[];

  previews: string[];
};

/* =========================================================
   CONST
========================================================= */

const ALLOWED_RETURN_STATUS: OrderStatus[] = [
  "delivered",
];

/* =========================================================
   FETCHER
========================================================= */

const fetcher = async (
  url: string
): Promise<OrderDetail | null> => {
  const res = await apiAuthFetch(url);

  if (!res.ok) {
    return null;
  }

  const data = await res.json();

  return data?.order ?? null;
};

/* =========================================================
   IMAGE COMPRESS
========================================================= */

async function compressImage(
  file: File
): Promise<File> {
  const type =
    file.type || "image/jpeg";

  const blobUrl =
    URL.createObjectURL(file);

  const img = new Image();

  await new Promise<void>(
    (resolve, reject) => {
      img.onload = () => resolve();

      img.onerror = () =>
        reject(
          new Error("IMAGE_LOAD_FAILED")
        );

      img.src = blobUrl;
    }
  );

  const maxWidth = 1280;

  const scale = Math.min(
    1,
    maxWidth / img.width
  );

  const width = Math.round(
    img.width * scale
  );

  const height = Math.round(
    img.height * scale
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx =
    canvas.getContext("2d");

  if (!ctx) {
    URL.revokeObjectURL(blobUrl);
    return file;
  }

  ctx.drawImage(
    img,
    0,
    0,
    width,
    height
  );

  const blob: Blob =
    await new Promise((resolve) =>
      canvas.toBlob(
        (b) =>
          resolve(
            b as Blob
          ),
        type,
        0.7
      )
    );

  URL.revokeObjectURL(blobUrl);

  return new File(
    [blob],
    file.name,
    {
      type,
    }
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function OrderReturnPage() {
  const { t } =
    useTranslation();

  const router =
    useRouter();

  const params =
    useParams<{
      id: string;
    }>();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const orderId =
    typeof params?.id ===
    "string"
      ? params.id
      : Array.isArray(
            params?.id
          )
        ? params.id[0]
        : "";

  const draftKey =
    `return_draft_${orderId}`;

  const [items, setItems] =
    useState<
      ReturnItemState[]
    >([]);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const initialized =
    useRef(false);

  const dirtyRef =
    useRef(false);

  /* =====================================================
     SWR
  ===================================================== */

  const {
    data: order,
    isLoading,
  } = useSWR<
    OrderDetail | null
  >(
    user && orderId
      ? `/api/orders/${orderId}`
      : null,
    fetcher,
    {
      revalidateOnFocus:
        false,

      shouldRetryOnError:
        false,
    }
  );

  /* =====================================================
     REDIRECT IF RETURN EXISTS
  ===================================================== */

  useEffect(() => {
    if (!order) return;

    if (
      order.return_status
    ) {
      router.replace(
        `/customer/orders/${order.id}`
      );
    }
  }, [order, router]);

  /* =====================================================
     VALIDATE STATUS
  ===================================================== */

  useEffect(() => {
    if (!order) return;

    const allowed =
      ALLOWED_RETURN_STATUS.includes(
        order.fulfillment_status
      );

    if (!allowed) {
      setError(
        t.return_only_delivered ??
          "Chỉ có thể hoàn trả khi đơn đã giao"
      );
    }
  }, [order, t]);

  /* =====================================================
     REASONS
  ===================================================== */

  const reasons = [
    {
      value: "damaged",
      label:
        t.return_reason_damaged,
    },

    {
      value: "wrong_item",
      label:
        t.return_reason_wrong,
    },

    {
      value:
        "not_as_described",

      label:
        t.return_reason_not_match,
    },

    {
      value: "other",

      label:
        t.return_reason_other,
    },
  ];

  /* =====================================================
     INIT
  ===================================================== */

  useEffect(() => {
    if (
      !order ||
      initialized.current
    ) {
      return;
    }

    const allowed =
      ALLOWED_RETURN_STATUS.includes(
        order.fulfillment_status
      );

    if (!allowed) {
      return;
    }

    const saved =
      localStorage.getItem(
        draftKey
      );

    if (saved) {
      try {
        const parsed =
          JSON.parse(saved);

        setItems(parsed);

        initialized.current =
          true;

        return;
      } catch {
        localStorage.removeItem(
          draftKey
        );
      }
    }

    setItems(
      order.order_items.map(
        (item) => ({
          orderItemId:
            item.id,

          selected: false,

          reasonValue: "",

          reasonText: "",

          files: [],

          previews: [],
        })
      )
    );

    initialized.current =
      true;
  }, [order, draftKey]);

  /* =====================================================
     AUTOSAVE
  ===================================================== */

  useEffect(() => {
    if (
      !initialized.current
    ) {
      return;
    }

    try {
      const safeItems =
        items.map((item) => ({
          ...item,

          files: [],
        }));

      localStorage.setItem(
        draftKey,
        JSON.stringify(
          safeItems
        )
      );

      dirtyRef.current =
        true;
    } catch {
      //
    }
  }, [items, draftKey]);

  /* =====================================================
     BEFORE UNLOAD
  ===================================================== */

  useEffect(() => {
    const handler = (
      e: BeforeUnloadEvent
    ) => {
      if (
        !dirtyRef.current ||
        submitting
      ) {
        return;
      }

      e.preventDefault();

      e.returnValue = "";
    };

    window.addEventListener(
      "beforeunload",
      handler
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handler
      );
    };
  }, [submitting]);

  /* =====================================================
     CONFIRM LEAVE
  ===================================================== */

  const confirmLeave =
    useCallback(() => {
      if (
        !dirtyRef.current ||
        submitting
      ) {
        return true;
      }

      return window.confirm(
        t.return_leave_warning ??
          "Rời trang?"
      );
    }, [
      submitting,
      t,
    ]);

  /* =====================================================
     IMAGE CHANGE
  ===================================================== */

  async function handleImageChange(
    e: ChangeEvent<HTMLInputElement>,
    index: number
  ) {
    const list =
      e.target.files;

    if (!list) {
      return;
    }

    try {
      const selected =
        Array.from(list);

      const updated = [
        ...items,
      ];

      const current =
        updated[index];

      const merged = [
        ...current.files,
        ...selected,
      ].slice(0, 3);

      for (const file of merged) {
        if (
          file.size >
          5 *
            1024 *
            1024
        ) {
          setError(
            t.return_image_limit
          );

          return;
        }
      }

      const compressed =
        await Promise.all(
          merged.map(
            async (
              file
            ) =>
              compressImage(
                file
              )
          )
        );

      current.previews.forEach(
        (preview) => {
          URL.revokeObjectURL(
            preview
          );
        }
      );

      current.files =
        compressed;

      current.previews =
        compressed.map(
          (file) =>
            URL.createObjectURL(
              file
            )
        );

      setItems(updated);
    } catch {
      setError(
        t.system_error
      );
    }
  }

  /* =====================================================
     REMOVE IMAGE
  ===================================================== */

  function removeImage(
    itemIndex: number,
    imageIndex: number
  ) {
    const updated = [
      ...items,
    ];

    const preview =
      updated[itemIndex]
        .previews[
        imageIndex
      ];

    if (preview) {
      URL.revokeObjectURL(
        preview
      );
    }

    updated[
      itemIndex
    ].files.splice(
      imageIndex,
      1
    );

    updated[
      itemIndex
    ].previews.splice(
      imageIndex,
      1
    );

    setItems(updated);
  }

  /* =====================================================
     UPLOAD IMAGES
  ===================================================== */

  async function uploadImages(
    files: File[]
  ): Promise<string[]> {
    return Promise.all(
      files.map(
        async (file) => {
          const res =
            await apiAuthFetch(
              "/api/returns/upload-url",
              {
                method:
                  "POST",
              }
            );

          if (!res.ok) {
            throw new Error(
              "UPLOAD_URL_FAILED"
            );
          }

          const data =
            await res.json();

          const uploadRes =
            await fetch(
              data.uploadUrl,
              {
                method:
                  "PUT",

                headers: {
                  "Content-Type":
                    file.type,
                },

                body: file,
              }
            );

          if (
            !uploadRes.ok
          ) {
            throw new Error(
              "UPLOAD_FAILED"
            );
          }

          return data.publicUrl as string;
        }
      )
    );
  }

  /* =====================================================
     SUBMIT
  ===================================================== */

  async function handleSubmit() {
    if (!order) {
      return;
    }

    const selectedItems =
      items.filter(
        (item) =>
          item.selected
      );

    if (
      selectedItems.length ===
      0
    ) {
      setError(
        t.return_select_item
      );

      return;
    }

    try {
      setSubmitting(true);

      setError(null);

      for (const item of selectedItems) {
        const finalReason =
          item.reasonValue ===
          "other"
            ? item.reasonText
            : item.reasonValue;

        if (
          !finalReason.trim()
        ) {
          throw new Error(
            t.return_reason_required
          );
        }

        if (
          item.files
            .length === 0
        ) {
          throw new Error(
            t.return_upload_required
          );
        }

        const imageUrls =
          await uploadImages(
            item.files
          );

        const res =
          await apiAuthFetch(
            "/api/returns",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                {
                  orderId,

                  orderItemId:
                    item.orderItemId,

                  reason:
                    finalReason,

                  description:
                    "",

                  images:
                    imageUrls,
                }
              ),
            }
          );

        if (!res.ok) {
          const data =
            await res
              .json()
              .catch(
                () =>
                  null
              );

          throw new Error(
            data?.error ??
              t.return_submit_failed
          );
        }
      }

      localStorage.removeItem(
        draftKey
      );

      dirtyRef.current =
        false;

      router.replace(
        "/customer/returns"
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t.system_error;

      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  /* =====================================================
     CLEANUP PREVIEW
  ===================================================== */

  useEffect(() => {
    return () => {
      items.forEach(
        (item) => {
          item.previews.forEach(
            (
              preview
            ) => {
              URL.revokeObjectURL(
                preview
              );
            }
          );
        }
      );
    };
  }, [items]);

  /* =====================================================
     LOADING
  ===================================================== */

  if (
    isLoading ||
    authLoading
  ) {
    return (
      <p className="p-4">
        {t.loading}
      </p>
    );
  }

  /* =====================================================
     NOT FOUND
  ===================================================== */

  if (
    !order?.id ||
    !Array.isArray(
      order.order_items
    )
  ) {
    return (
      <div className="p-4">
        <p className="text-red-500">
          {
            t.order_not_found
          }
        </p>

        <button
          onClick={() =>
            router.push(
              "/customer/orders"
            )
          }
          className="mt-4 rounded-lg bg-black px-4 py-2 text-white"
        >
          {t.back}
        </button>
      </div>
    );
  }

  /* =====================================================
     UI
  ===================================================== */

  return (
    <main className="min-h-screen bg-gray-100 p-4 space-y-4">
      {/* TITLE */}

      <div className="rounded-xl bg-white p-4 shadow">
        <h1 className="text-lg font-semibold">
          🔄{" "}
          {
            t.return_request
          }
        </h1>
      </div>

      {/* ITEMS */}

      {order.order_items.map(
        (
          item,
          index
        ) => {
          const state =
            items[index];

          if (!state) {
            return null;
          }

          return (
            <div
              key={
                item.id
              }
              className={`rounded-xl border bg-white p-4 shadow space-y-3 ${
                state.selected
                  ? "border-orange-500"
                  : "border-transparent"
              }`}
            >
              {/* HEADER */}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={
                    state.selected
                  }
                  onChange={(
                    e
                  ) => {
                    const updated =
                      [
                        ...items,
                      ];

                    updated[
                      index
                    ].selected =
                      e.target.checked;

                    setItems(
                      updated
                    );
                  }}
                />

                {item.thumbnail && (
                  <img
                    src={
                      item.thumbnail
                    }
                    alt={
                      item.product_name
                    }
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                )}

                <p className="text-sm font-medium">
                  {
                    item.product_name
                  }
                </p>
              </div>

              {/* FORM */}

              {state.selected && (
                <>
                  {/* REASON */}

                  <select
                    value={
                      state.reasonValue
                    }
                    onChange={(
                      e
                    ) => {
                      const updated =
                        [
                          ...items,
                        ];

                      updated[
                        index
                      ].reasonValue =
                        e.target.value;

                      if (
                        e
                          .target
                          .value !==
                        "other"
                      ) {
                        updated[
                          index
                        ].reasonText =
                          "";
                      }

                      setItems(
                        updated
                      );
                    }}
                    className="w-full rounded-lg border p-3 text-sm"
                  >
                    <option value="">
                      {
                        t.return_select_reason
                      }
                    </option>

                    {reasons.map(
                      (
                        reason
                      ) => (
                        <option
                          key={
                            reason.value
                          }
                          value={
                            reason.value
                          }
                        >
                          {
                            reason.label
                          }
                        </option>
                      )
                    )}
                  </select>

                  {/* OTHER */}

                  {state.reasonValue ===
                    "other" && (
                    <input
                      value={
                        state.reasonText
                      }
                      onChange={(
                        e
                      ) => {
                        const updated =
                          [
                            ...items,
                          ];

                        updated[
                          index
                        ].reasonText =
                          e.target.value;

                        setItems(
                          updated
                        );
                      }}
                      placeholder={
                        t.return_reason_placeholder
                      }
                      className="w-full rounded-lg border p-3 text-sm"
                    />
                  )}

                  {/* IMAGE GRID */}

                  <div className="grid grid-cols-4 gap-2">
                    {state.previews.map(
                      (
                        src,
                        imageIndex
                      ) => (
                        <div
                          key={
                            imageIndex
                          }
                          className="relative h-20"
                        >
                          <img
                            src={
                              src
                            }
                            alt=""
                            className="h-full w-full rounded object-cover"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              removeImage(
                                index,
                                imageIndex
                              )
                            }
                            className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-black text-xs text-white"
                          >
                            ×
                          </button>
                        </div>
                      )
                    )}

                    {state.files
                      .length <
                      3 && (
                      <label className="flex h-20 cursor-pointer items-center justify-center rounded border text-gray-400">
                        +

                        <input
                          hidden
                          multiple
                          type="file"
                          accept="image/*"
                          onChange={(
                            e
                          ) =>
                            handleImageChange(
                              e,
                              index
                            )
                          }
                        />
                      </label>
                    )}
                  </div>

                  <p className="text-xs text-gray-400">
                    {
                      t.return_max_3_images
                    }
                  </p>
                </>
              )}
            </div>
          );
        }
      )}

      {/* ERROR */}

      {error && (
        <div className="rounded bg-red-50 p-3 text-red-600">
          {error}
        </div>
      )}

      {/* SUBMIT */}

      <button
        type="button"
        onClick={() => {
          if (
            !confirmLeave()
          ) {
            return;
          }

          handleSubmit();
        }}
        disabled={
          submitting
        }
        className="w-full rounded-xl bg-black py-4 font-semibold text-white disabled:opacity-50"
      >
        {submitting
          ? t.return_submitting
          : t.return_submit}
      </button>
    </main>
  );
}
