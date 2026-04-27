"use client";
import { toUTCFromInput } from "@/lib/utils/time";
import { FormEvent, useState } from "react";
import { compressImage } from "@/lib/upload/imageUtils";
import { getPiAccessToken } from "@/lib/piAuth";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase/client";

import { useProductForm } from "./product/useProductForm";
import ShippingRates from "./product/ShippingRates";
import VariantEditor from "./product/VariantEditor";

/* =========================
   TYPES
========================= */
interface Category {
  id: string;
  key: string;
}

interface ProductFormProps {
  categories: Category[];
  initialData?: any;
  onSubmit: (payload: any) => Promise<void>;
}

export default function ProductForm({
  categories,
  initialData,
  onSubmit,
}: ProductFormProps) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const form = useProductForm(initialData);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /* =========================
     IDEMPOTENCY KEY
  ========================= */
  const generateKey = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  /* =========================
     UPLOAD PROGRESS
  ========================= */
  const uploadWithProgress = (
    url: string,
    file: File,
    index: number
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          console.log(`📊 [${index}] ${percent}%`);
        }
      };

      xhr.onload = () =>
        xhr.status === 200 ? resolve() : reject(xhr.status);

      xhr.onerror = () => reject("NETWORK_ERROR");

      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });

  /* =========================
     GET SIGNED URL
  ========================= */
  const getSignedUrl = async () => {
    const token = await getPiAccessToken();
    const res = await fetch("/api/upload-url", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ SIGNED URL FAIL:", text);
      throw new Error("SIGNED_URL_FAILED");
    }

    const data = await res.json();
    if (!data.uploadUrl) throw new Error("NO_URL");
return data;
};
  /* =========================
     MAIN IMAGE UPLOAD
  ========================= */
  const handleUpload = async (files: File[]) => {
    if (!files.length) return;

    try {
      setUploading(true);

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!baseUrl) throw new Error("ENV_ERROR");
      const uploads = files.map(async (file, i) => {
        const compressed = await compressImage(file);
        const { uploadUrl, publicUrl } = await getSignedUrl();
       await uploadWithProgress(uploadUrl, compressed, i);
       return publicUrl;
      });

      const urls = await Promise.all(uploads);
      form.setImages((prev: string[]) => [...prev, ...urls]);
    } catch (err) {
      console.error("💥 UPLOAD ERROR:", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /* =========================
     DETAIL IMAGE
  ========================= */
  const uploadDetailImages = async (files: File[]) => {
    if (!files.length) return;

    try {
      const uploads = files.map(async (file) => {
        const path = `products/${user.id}/detail-${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("products")
          .upload(path, file);

        if (error) throw error;

        const { data } = supabase.storage
          .from("products")
          .getPublicUrl(path);
        return data.publicUrl;
      });

      const urls = await Promise.all(uploads);

      form.setDetail((prev: string) => {
        const html = urls.map((u) => `<img src="${u}" />`).join("\n");
        return prev + "\n" + html;
      });

    } catch (err) {
      console.error("💥 DETAIL ERROR:", err);
    }
  };

  if (loading || !user) {
    return <div className="p-8 text-center">{t.loading}</div>;
  }

  /* =========================
     SUBMIT
  ========================= */
  const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();

  if (submitting) return;
  setSubmitting(true);

  try {
    const hasVariants = form.variants.length > 0;
     const hasSaleTime = form.saleStart && form.saleEnd;
const hasSalePrice = Number(form.salePrice) > 0;

if (hasSaleTime && !form.saleEnabled) {
  alert("Có thời gian sale thì phải bật sale");
  setSubmitting(false);
  return;
}

if (form.saleEnabled && !hasSaleTime) {
  alert("Bật sale phải có thời gian bắt đầu/kết thúc");
  setSubmitting(false);
  return;
}

if (form.saleEnabled && !hasSalePrice) {
  alert("Sale phải có giá sale");
  setSubmitting(false);
  return;
}

    /* ================= VALIDATE ================= */

    if (!form.name) {
  alert("Invalid name");
  setSubmitting(false);
  return;
}

    if (!form.images.length) {
      alert("Need image");
      return;
    }

    /* 🔥 MIN PRICE */
    if (!hasVariants && Number(form.price) < 0.00001) {
      alert("Price must be >= 0.00001 PI");
      return;
    }

    /* 🔥 SALE VALIDATION */
    if (!hasVariants && form.saleEnabled) {
  const sale = Number(form.salePrice);
  const price = Number(form.price);

  if (Number.isNaN(sale) || sale < 0.00001) {
  alert("Sale price must be >= 0.00001");
  setSubmitting(false);
  return;
}

  if (sale >= price) {
  alert("Sale price must be less than price");
  setSubmitting(false);
  return;
}
    }
    /* ================= PAYLOAD ================= */
const shippingRatesPayload = Object.entries(form.shippingRates)
  .map(([zone, price]) => ({
    zone,
    price: Number(price || 0),
  }));
const normalizedVariants = form.variants.map((v) => ({
  ...v,
  saleEnabled: false, // ❌ CHẶN VARIANT SALE
  salePrice: null,
  saleStock: 0,
  saleSold: 0,
}));
const payload = {
  id: form.id,
  name: form.name,
  categoryId: form.categoryId,
  description: form.description,
  detail: form.detail,
  images: form.images,
  thumbnail: form.images[0],
  isActive: form.isActive,

  shippingRates: shippingRatesPayload,

  domesticCountryCode: form.primaryShippingCountry || null,

  price: hasVariants ? undefined : Number(form.price),
  stock: hasVariants ? undefined : Number(form.stock || 0),

  salePrice:
    hasVariants || !form.saleEnabled ? null : Number(form.salePrice),

  saleEnabled:
  hasVariants
    ? undefined
    : form.saleEnabled && hasSaleTime && hasSalePrice,

  saleStock:
    hasVariants || !form.saleEnabled ? 0 : Number(form.saleStock || 0),

  saleStart: form.saleStart ? toUTCFromInput(form.saleStart) : null,
  saleEnd: form.saleEnd ? toUTCFromInput(form.saleEnd) : null,
  variants: normalizedVariants,

  idempotencyKey: generateKey(),
};

    console.log("📦 SUBMIT:", payload);

    await onSubmit(payload);

  } catch (err) {
    console.error(err);
    alert("Submit failed");
  } finally {
    setSubmitting(false);
  }
};

  /* =========================
     UI
  ========================= */
  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* CATEGORY */}
      <select
        value={form.categoryId}
        onChange={(e) => form.setCategoryId(e.target.value)}
        className="w-full border p-2 rounded"
      >
        <option value="">Select category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.key}</option>
        ))}
      </select>

      {/* NAME */}
      <input
        value={form.name}
        onChange={(e) => form.setName(e.target.value)}
        placeholder="Product name"
        className="w-full border p-2 rounded"
      />

      {/* IMAGE */}
      <div className="space-y-2">

        <div className="grid grid-cols-3 gap-2">
          {form.images.map((img: string, i: number) => (
            <div key={img} className="relative group">
              <img
                src={img}
                className="h-24 w-full object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() =>
                  form.setImages((prev: string[]) =>
                    prev.filter((_, idx) => idx !== i)
                  )
                }
                className="absolute top-1 right-1 bg-black/60 text-white px-2 rounded text-xs opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <label className="flex flex-col items-center justify-center border-2 border-dashed h-28 rounded-xl cursor-pointer hover:bg-gray-50">
          {uploading ? "Uploading..." : "＋ Upload Image"}
          <input
            type="file"
            hidden
            multiple
            accept="image/*"
            onChange={(e) =>
              handleUpload(Array.from(e.target.files || []))
            }
          />
        </label>

      </div>
       {/* PRICE + STOCK + SALE (ONLY WHEN NO VARIANTS) */}
{form.variants.length === 0 && (
  <>
    {/* PRICE */}
    <input
  type="number"
  step="0.00001"
  min="0.00001"
  value={form.price}
  onChange={(e) =>
    form.setPrice(e.target.value ? Number(e.target.value) : "")
  }
  placeholder="Price"
  className="w-full border p-2 rounded"
/>

    {/* STOCK */}
    <input
      type="number"
      value={form.stock}
      onChange={(e) =>
        form.setStock(Number(e.target.value))
      }
      placeholder="Stock"
      className="w-full border p-2 rounded"
    />

    {/* 🔥 SALE ENABLE */}
    <label className="flex justify-between border p-2 rounded">
      <span>Enable Sale</span>
      <input
  type="checkbox"
  checked={form.saleEnabled || false}
  onChange={(e) => {
    const checked = e.target.checked;

    form.setSaleEnabled(checked);

    if (!checked) {
      form.setSaleStart(null);
      form.setSaleEnd(null);
      form.setSalePrice("");
      form.setSaleStock(0);
    }
  }}
/>
    </label>

    {/* SALE PRICE */}
    {form.saleEnabled && (
     <input
  type="number"
  step="0.00001"
  min="0.00001"
  inputMode="decimal"
  value={form.salePrice === "" ? "" : form.salePrice}
  onChange={(e) => {
    const val = e.target.value;

    if (val === "") {
      form.setSalePrice("");
      return;
    }

    form.setSalePrice(Number(val));
  }}
  placeholder="Sale price"
  className="w-full border p-2 rounded"
/>
    )}

    {/* 🔥 SALE STOCK */}
    {form.saleEnabled && (
      <input
  type="number"
  value={form.saleStock || 0}
  onChange={(e) => {
    const val = Number(e.target.value);

    if (val > form.stock) {
      alert("Sale stock cannot exceed stock");
      return;
    }

    form.setSaleStock(val);
  }}
  placeholder="Sale stock"
  className="w-full border p-2 rounded"
    />
    )}
  </>
)}

      <div className="grid grid-cols-2 gap-2">
        <input
          type="datetime-local"
          value={form.saleStart || ""}
          onChange={(e) => form.setSaleStart(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="datetime-local"
          value={form.saleEnd || ""}
          onChange={(e) => form.setSaleEnd(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* SHIPPING */}
      <ShippingRates
  shippingRates={form.shippingRates}
  setShippingRates={form.setShippingRates}
  primaryShippingCountry={form.primaryShippingCountry}
  setPrimaryShippingCountry={form.setPrimaryShippingCountry}
   />

      {/* ACTIVE */}
      <label className="flex justify-between border p-3 rounded">
        <span>Active</span>
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => form.setIsActive(e.target.checked)}
        />
      </label>

      {/* VARIANT */}
      <VariantEditor
        variants={form.variants}
        setVariants={form.setVariants}
      />
            <textarea
  value={form.description}
  onChange={(e) => form.setDescription(e.target.value)}
  placeholder={t.description}
  className="w-full border p-2 rounded min-h-[70px]"
/>

           {/* DETAIL */}
      <textarea
        value={form.detail}
        onChange={(e) => form.setDetail(e.target.value)}
        className="w-full border p-2 rounded"
      />

      {/* DETAIL IMAGE */}
      <label className="border-2 border-dashed h-20 flex items-center justify-center rounded cursor-pointer">
        + Detail Image
        <input
          type="file"
          hidden
          multiple
          onChange={(e) =>
            uploadDetailImages(Array.from(e.target.files || []))
          }
        />
      </label>

      {/* SUBMIT */}
      <button
  type="submit"
  disabled={submitting}
  className={`w-full py-3 rounded text-white transition-all duration-200
    ${
      submitting
        ? "bg-gray-400 cursor-not-allowed"
        : "bg-orange-500 active:scale-95"
    }
  `}
>
  {submitting ? "Đang đăng..." : "Đăng sản phẩm"}
</button>
    </form>
  );
}
