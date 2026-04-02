"use client";

import { useState, useEffect, FormEvent } from "react";
import Image from "next/image";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";

/* =========================
   TYPES
========================= */
interface Category {
  id: string;
  key: string;
  icon?: string;
}

interface ProductVariant {
  optionValue: string;
  stock: number;
  sku?: string | null;
}

interface ProductPayload {
  id?: string;
  name: string;
  price: number;
  salePrice?: number | null;
  saleStart?: string | null;
  saleEnd?: string | null;
  description: string;
  detail: string;
  images: string[];
  thumbnail: string | null;
  categoryId: string;
  stock: number;
  is_active: boolean;
  variants?: ProductVariant[];
  shipping_rates?: {
  zone: string;
  price: number;
}[];
   }

interface ProductFormProps {
  categories: Category[];
  initialData?: ProductPayload;
  onSubmit: (payload: ProductPayload) => Promise<void>;
}

/* =========================
   COMPONENT
========================= */
export default function ProductForm({
  categories,
  initialData,
  onSubmit,
}: ProductFormProps) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
const [shippingRates, setShippingRates] = useState<Record<string, number | "">>({
  domestic: "",
  sea: "",
  asia: "",
  europe: "",
  north_america: "",
  rest_of_world: "",
});
const [name, setName] = useState("");
const [price, setPrice] = useState<number | "">("");
const [categoryId, setCategoryId] = useState("");
const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [saleStart, setSaleStart] = useState("");
  const [saleEnd, setSaleEnd] = useState("");
  const [stock, setStock] = useState<number | "">(1);
  const [isActive, setIsActive] = useState(true);
  const [detail, setDetail] = useState("");
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error" | "";
  }>({
    text: "",
    type: "",
  });

  useEffect(() => {
  if (!initialData) return;

  setName(initialData.name || "");
  setPrice(initialData.price ?? "");
  setCategoryId(initialData.categoryId || "");
  setDescription(initialData.description || "");

  setImages(initialData.images || []);
  setSalePrice(initialData.salePrice ?? "");
  setSaleStart(
    initialData.saleStart
      ? toLocalDateTime(initialData.saleStart)
      : ""
  );
  setSaleEnd(
    initialData.saleEnd
      ? toLocalDateTime(initialData.saleEnd)
      : ""
  );

  setStock(initialData.stock ?? 1);
  setIsActive(initialData.is_active ?? true);
  setDetail(initialData.detail || "");
  setVariants(Array.isArray(initialData.variants) ? initialData.variants : []);

  // 🔥 NEW: map shipping_rates → state
  const newRates: Record<string, number | ""> = {
    domestic: "",
    sea: "",
    asia: "",
    europe: "",
    north_america: "",
    rest_of_world: "",
  };

  if (Array.isArray(initialData.shipping_rates)) {
    for (const r of initialData.shipping_rates) {
      if (r.zone && typeof r.price === "number") {
        newRates[r.zone] = r.price;
      }
    }
  }

  setShippingRates(newRates);
}, [initialData]);

  if (loading || !user) {
    return <div className="text-center p-8">{t.loading}</div>;
  }

  function localToUTC(local: string) {
    if (!local) return null;
    return new Date(local).toISOString();
  }

  function toLocalDateTime(value: string) {
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (
  files: File[],
  setter: React.Dispatch<React.SetStateAction<string[]>>
) => {
  if (!files.length) return;

  setUploadingImage(true);

  try {
    const uploads = files.map(async (file) => {
      const form = new FormData();
      form.append("file", file);

      const res = await apiAuthFetch("/api/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("UPLOAD_FAILED");

      const data = await res.json();
      return data.url;
    });

    const urls = await Promise.all(uploads);

    setter((prev) => [...prev, ...urls]);

  } catch {
    setMessage({
      text: t.upload_failed,
      type: "error",
    });
  } finally {
    setUploadingImage(false);
  }
};

  const uploadDetailImages = async (files: File[]) => {
  if (!files.length) return;

  if (uploadingImage) return; // tránh spam click

  setUploadingImage(true);

  try {
    const uploads = files.map(async (file) => {
      // ✅ check size
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("FILE_TOO_LARGE");
      }

      // ✅ check type
      if (!file.type.startsWith("image/")) {
        throw new Error("INVALID_FILE_TYPE");
      }

      const form = new FormData();
      form.append("file", file);

      const res = await apiAuthFetch("/api/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("UPLOAD_DETAIL_FAILED");

      const data = (await res.json()) as { url?: string };

      if (!data.url) throw new Error("NO_URL_RETURNED");

      return data.url;
    });

    // 🚀 chạy song song
    const urls = await Promise.all(uploads);

    // ✅ update 1 lần (tránh re-render nhiều)
    setDetail((prev) => {
      const html = urls
        .map((url) => `<img src="${url}" />`)
        .join("\n");

      return `${prev}\n${html}\n`;
    });

  } catch (err) {
    console.error("❌ upload detail error:", err);

    setMessage({
      text: t.upload_detail_failed,
      type: "error",
    });
  } finally {
    setUploadingImage(false);
  }
};
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 🔥 dùng state luôn
if (!name || Number(price) <= 0 || !categoryId) {
  setMessage({
    text: t.enter_valid_name_price,
    type: "error",
  });
  return;
}

    if (!images.length) {
      setMessage({
        text: t.need_image,
        type: "error",
      });
      return;
    }

    if (!name || price <= 0 || !categoryId) {
      setMessage({
        text: t.enter_valid_name_price,
        type: "error",
      });
      return;
    }

    if (salePrice !== "") {
      if (!saleStart || !saleEnd) {
        setMessage({
          text: t.need_sale_date,
          type: "error",
        });
        return;
      }

      if (new Date(saleEnd) <= new Date(saleStart)) {
        setMessage({
          text: t.invalid_sale_range,
          type: "error",
        });
        return;
      }
    }

    for (const v of variants) {
  if (!v.optionValue.trim() || v.stock < 0) {
    setMessage({
      text: t.invalid_variant,
      type: "error",
    });
    return;
  }
}
const shipping_rates_array = Object.entries(shippingRates)
  .filter(([_, price]) => price !== "")
  .map(([zone, price]) => ({
    zone,
    price: Number(price),
  }));
    const payload: ProductPayload = {
  id: initialData?.id,
  name,
  price: Number(price),
  categoryId,
  description,
  salePrice: salePrice === "" ? null : salePrice,
  saleStart: salePrice !== "" && saleStart ? localToUTC(saleStart) : null,
  saleEnd: salePrice !== "" && saleEnd ? localToUTC(saleEnd) : null,
  detail,
  images,
  thumbnail: images[0] ?? null,
  stock: stock === "" ? 0 : Number(stock),
  is_active: isActive,
  variants,
  shipping_rates: shipping_rates_array, 
};

    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      await onSubmit(payload);
      setMessage({
        text: initialData ? t.update_success : t.post_success,
        type: "success",
      });
    } catch {
      setMessage({
        text: initialData ? t.update_failed : t.post_failed,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateVariant = (
    index: number,
    key: keyof ProductVariant,
    value: string | number | null
  ) => {
    setVariants((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]: value,
            }
          : item
      )
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <select
  name="categoryId"
  value={categoryId}
  onChange={(e) => setCategoryId(e.target.value)}
  className="w-full border p-2 rounded"
  required
>
        <option value="">{t.select_category}</option>
        {categories.map((c) => {
          const key = c.key as keyof typeof t;
          return (
            <option key={c.id} value={c.id}>
              {t[key] ?? c.key}
            </option>
          );
        })}
      </select>

      <input
  name="name"
  value={name}
  onChange={(e) => setName(e.target.value)}
        placeholder={t.product_name}
        className="w-full border p-2 rounded"
        required
      />

      <div className="grid grid-cols-3 gap-3">
        {images.map((url, i) => (
          <div key={url} className="relative h-28">
            <Image src={url} alt="" fill className="object-cover rounded" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 rounded"
            >
              ✕
            </button>
          </div>
        ))}

        {images.length < 6 && (
          <label className="flex items-center justify-center border-2 border-dashed rounded cursor-pointer h-28">
            ＋
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) =>
                uploadImages(Array.from(e.target.files || []), setImages)
              }
            />
          </label>
        )}
      </div>

      <input
  name="price"
  type="number"
  step="0.00001"
  value={price}
  onChange={(e) =>
    setPrice(e.target.value ? Number(e.target.value) : "")
  }
  placeholder={t.price_pi}
  className="w-full border p-2 rounded"
  required
/>

      <input
        type="number"
        min={0}
        placeholder={t.stock}
        value={stock}
        onChange={(e) =>
          setStock(e.target.value ? Number(e.target.value) : "")
        }
        className="w-full border p-2 rounded"
      />

       <div className="space-y-2">
  <p className="font-medium">🚚 Shipping Fee</p>

  <div className="grid grid-cols-2 gap-3">
    {[
      { key: "domestic", label: "Domestic" },
      { key: "sea", label: "SEA" },
      { key: "asia", label: "Asia" },
      { key: "europe", label: "Europe" },
      { key: "north_america", label: "North America" },
      { key: "rest_of_world", label: "Rest of World" },
    ].map((z) => (
      <input
        key={z.key}
        type="number"
        step="0.00001"
        placeholder={z.label}
        value={shippingRates[z.key] ?? ""}
        onChange={(e) =>
          setShippingRates((prev) => ({
            ...prev,
            [z.key]: e.target.value ? Number(e.target.value) : "",
          }))
        }
        className="border p-2 rounded"
      />
    ))}
  </div>
</div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span>{t.active}</span>
      </label>

      <input
        type="number"
        step="0.00001"
        placeholder={t.sale_price_optional}
        value={salePrice}
        onChange={(e) =>
          setSalePrice(e.target.value ? Number(e.target.value) : "")
        }
        className="w-full border p-2 rounded"
      />

      {salePrice !== "" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 font-medium">
            📅 {t.sale_time}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="datetime-local"
              value={saleStart}
              onChange={(e) => setSaleStart(e.target.value)}
              className="border p-2 rounded"
            />
            <input
              type="datetime-local"
              value={saleEnd}
              onChange={(e) => setSaleEnd(e.target.value)}
              className="border p-2 rounded"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
  <p className="font-medium">{t.product_variants ?? "Biến thể sản phẩm"}</p>

  {variants.map((v, i) => (
    <div key={i} className="grid grid-cols-3 gap-2 items-center">
      <input
        type="text"
        placeholder={t.size ?? "Size / Phân loại"}
        value={v.optionValue}
        onChange={(e) => updateVariant(i, "optionValue", e.target.value)}
        className="border p-2 rounded"
      />

      <input
        type="number"
        min={0}
        placeholder={t.stock ?? "Tồn kho"}
        value={v.stock}
        onChange={(e) => updateVariant(i, "stock", Number(e.target.value))}
        className="border p-2 rounded"
      />

      <input
        type="text"
        placeholder="SKU"
        value={v.sku ?? ""}
        onChange={(e) => updateVariant(i, "sku", e.target.value)}
        className="border p-2 rounded"
      />

      <button
        type="button"
        onClick={() =>
          setVariants((prev) => prev.filter((_, idx) => idx !== i))
        }
        className="bg-red-500 text-white px-2 py-2 rounded col-span-3"
      >
        ✕ Xóa biến thể
      </button>
    </div>
  ))}

  <button
    type="button"
    onClick={() =>
      setVariants((prev) => [
        ...prev,
        {
          optionValue: "",
          stock: 0,
          sku: "",
        },
      ])
    }
    className="bg-green-500 text-white px-3 py-1 rounded"
  >
    + {t.add_variant ?? "Thêm biến thể"}
  </button>
</div>

      <textarea
  name="description"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
        placeholder={t.description}
        required
        className="w-full border p-2 rounded min-h-[70px]"
      />

      <textarea
        name="detail"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder={t.product_detail_html}
        className="w-full border p-2 rounded min-h-[120px]"
      />

      <label className="flex items-center justify-center border-2 border-dashed rounded cursor-pointer h-20">
        {t.add_detail_image}
        <input
          type="file"
          accept="image/*"
          hidden
          multiple
          onChange={(e) =>
            uploadDetailImages(Array.from(e.target.files || []))
          }
        />
      </label>

      <button
        disabled={saving || uploadingImage}
        className="w-full bg-[#ff6600] text-white py-3 rounded-lg font-semibold disabled:opacity-60"
      >
        {saving
          ? t.posting
          : initialData
          ? t.update_product
          : t.post_product}
      </button>

      {message.text && (
        <p
          className={`text-sm ${
            message.type === "error" ? "text-red-500" : "text-green-500"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
