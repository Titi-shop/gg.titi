
"use client";
import { compressImage } from "@/lib/upload/imageUtils";
import { FormEvent } from "react";
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
  icon?: string;
}

interface ProductFormProps {
  categories: Category[];
  initialData?: any;
  onSubmit: (payload: any) => Promise<void>;
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

  const form = useProductForm(initialData);
   /* =========================
   UPLOAD PROGRESS HELPER
========================= */
const uploadWithProgress = (
  url: string,
  file: File,
  index: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        console.log(`📊 [${index}] Progress: ${percent}%`);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        console.error("❌ Upload failed:", xhr.status);
        reject();
      }
    };

    xhr.onerror = () => {
      console.error("💥 Network error");
      reject();
    };

    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
};
 /* =========================
     UPLOAD IMAGE (SUPABASE DIRECT)
  ========================= */
  const handleUpload = async (files: File[]) => {
  if (!files.length) return;

  console.log("🚀 PRO UPLOAD START");

  try {
    const uploads = files.map(async (file, index) => {
      console.log(`📂 [${index}] Original:`, file.name);

      /* ================= COMPRESS ================= */
      const compressed = await compressImage(file);
      /* ================= GET SIGNED URL ================= */
const res = await fetch("/api/upload-url", {
  method: "POST",
});

if (!res.ok) {
  const text = await res.text();
  console.error("❌ GET SIGNED URL FAILED:", res.status, text);
  throw new Error("SIGNED_URL_FAILED");
}

const { url, path } = await res.json();

if (!url) {
  console.error("❌ NO URL RETURNED");
  throw new Error("NO_URL");
}

      console.log(`🔑 [${index}] Signed URL ready`);

      /* ================= UPLOAD WITH PROGRESS ================= */
      await uploadWithProgress(url, compressed, index);

      /* ================= PUBLIC URL ================= */
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!baseUrl) {
  console.error("❌ ENV URL MISSING");
  throw new Error("ENV_ERROR");
}

const publicUrl = `${baseUrl}/storage/v1/object/public/products/${path}`;

      console.log(`✅ [${index}] DONE:`, publicUrl);

      return publicUrl;
    });

    const urls = await Promise.all(uploads);

    console.log("🔥 ALL DONE:", urls);

    form.setImages((prev: string[]) => [...prev, ...urls]);

  } catch (err) {
    console.error("💥 PRO UPLOAD ERROR:", err);
    alert("Upload failed");
  }
};

  /* =========================
     UPLOAD DETAIL IMAGE
  ========================= */
  const uploadDetailImages = async (files: File[]) => {
    if (!files.length) return;

    console.log("🖼️ DETAIL UPLOAD START");

    try {
      const uploads = files.map(async (file) => {
        console.log("📂 Detail uploading:", file.name);

        const ext = file.name.split(".").pop();
        const filePath = `products/detail-${Date.now()}-${Math.random()}.${ext}`;

        const { error } = await supabase.storage
          .from("products")
          .upload(filePath, file);

        if (error) {
          console.error("❌ Detail upload error:", error);
          throw error;
        }

        const { data } = supabase.storage
          .from("products")
          .getPublicUrl(filePath);

        return data.publicUrl;
      });

      const urls = await Promise.all(uploads);

      console.log("🔥 DETAIL URLS:", urls);

      form.setDetail((prev: string) => {
        const html = urls.map((url) => `<img src="${url}" />`).join("\n");
        return prev + "\n" + html;
      });

    } catch (err) {
      console.error("💥 DETAIL UPLOAD ERROR:", err);
    }
  };

  if (loading || !user) {
    return <div className="text-center p-8">{t.loading}</div>;
  }

  /* =========================
     SUBMIT
  ========================= */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    console.log("📤 SUBMIT START");

    if (!form.name || Number(form.price) <= 0 || !form.categoryId) {
      alert("Invalid input");
      return;
    }

    if (!form.images.length) {
      alert("Need image");
      return;
    }

    const shipping_rates_array = Object.entries(form.shippingRates)
      .filter(([_, price]) => price !== "")
      .map(([zone, price]) => ({
        zone,
        price: Number(price),
      }));

    const payload = {
      id: initialData?.id,
      name: form.name,
      price: Number(form.price),
      categoryId: form.categoryId,
      description: form.description,
      detail: form.detail,
      images: form.images,
      thumbnail: form.images[0] ?? null,
      stock: Number(form.stock || 0),
      isActive: form.isActive,
      salePrice: form.salePrice || null,
      saleStart: form.saleStart || null,
      saleEnd: form.saleEnd || null,
      variants: form.variants,
      shippingRates: shipping_rates_array,
    };

    console.log("📦 PAYLOAD:", payload);

    await onSubmit(payload);
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
        required
      >
        <option value="">Select category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.key}
          </option>
        ))}
      </select>

      {/* NAME */}
      <input
        value={form.name}
        onChange={(e) => form.setName(e.target.value)}
        placeholder="Product name"
        className="w-full border p-2 rounded"
        required
      />

      {/* IMAGE UPLOAD */}
<div className="space-y-3">

  {/* PREVIEW */}
  {form.images.length > 0 && (
    <div className="grid grid-cols-3 gap-2">
      {form.images.map((img: string, i: number) => (
        <div key={img} className="relative group">
          <img
            src={img}
            className="h-24 w-full object-cover rounded-lg border"
          />

          {/* REMOVE */}
          <button
            type="button"
            onClick={() =>
              form.setImages((prev: string[]) =>
                prev.filter((_, index) => index !== i)
              )
            }
            className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )}

  {/* UPLOAD BUTTON */}
  <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-xl h-28 cursor-pointer hover:bg-gray-50 transition">

    <span className="text-2xl">＋</span>
    <span className="text-sm text-gray-500">
      Upload image
    </span>

    <input
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        const files = Array.from(e.target.files || []);
        console.log("📥 FILE CHANGED:", files);
        handleUpload(files);
      }}
    />
  </label>

</div>

      {/* PRICE */}
      <input
        type="number"
        value={form.price}
        onChange={(e) =>
          form.setPrice(e.target.value ? Number(e.target.value) : "")
        }
        placeholder="Price (Pi)"
        className="w-full border p-2 rounded"
        required
      />

      {/* STOCK */}
      <input
        type="number"
        value={form.stock}
        onChange={(e) =>
          form.setStock(e.target.value ? Number(e.target.value) : "")
        }
        placeholder="Stock"
        className="w-full border p-2 rounded"
      />

      {/* SHIPPING */}
      <ShippingRates
        shippingRates={form.shippingRates}
        setShippingRates={form.setShippingRates}
      />

      {/* ACTIVE */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => form.setIsActive(e.target.checked)}
        />
        <span>Active</span>
      </label>

      {/* SALE */}
      <input
        type="number"
        value={form.salePrice}
        onChange={(e) =>
          form.setSalePrice(e.target.value ? Number(e.target.value) : "")
        }
        placeholder="Sale Price"
        className="w-full border p-2 rounded"
      />

      {/* VARIANTS */}
      <VariantEditor
        variants={form.variants}
        setVariants={form.setVariants}
      />

      {/* DESCRIPTION */}
      <textarea
        value={form.description}
        onChange={(e) => form.setDescription(e.target.value)}
        placeholder="Description"
        className="w-full border p-2 rounded"
      />

      {/* DETAIL */}
      <textarea
        value={form.detail}
        onChange={(e) => form.setDetail(e.target.value)}
        placeholder="Detail"
        className="w-full border p-2 rounded"
      />

      {/* DETAIL IMAGE */}
      <label className="flex items-center justify-center border-2 border-dashed rounded cursor-pointer h-20">
        + Thêm ảnh mô tả
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

      {/* SUBMIT */}
      <button className="w-full bg-orange-500 text-white py-3 rounded">
        Submit
      </button>
    </form>
  );
}
