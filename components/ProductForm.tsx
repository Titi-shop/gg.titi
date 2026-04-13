"use client";

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
    if (!data.url) throw new Error("NO_URL");
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
        const { url, path } = await getSignedUrl();
        await uploadWithProgress(url, compressed, i);

        return `${baseUrl}/storage/v1/object/public/products/${path}`;
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

    if (submitting) {
      console.log("⚠️ BLOCK DOUBLE SUBMIT");
      return;
    }

    setSubmitting(true);

    try {
        const hasVariants = form.variants.length > 0;
      if (!form.name) {
  alert("Invalid name");
  return;
}

if (!hasVariants && Number(form.price) <= 0) {
  alert("Invalid price");
  return;
}

      if (!form.images.length) {
        alert("Need image");
        return;
      }

const payload = {
   id: form.id,
  name: form.name,
  categoryId: form.categoryId,
  description: form.description,
  detail: form.detail,
  images: form.images,
  thumbnail: form.images[0],
  isActive: form.isActive,
  price: hasVariants ? undefined : Number(form.price),
  stock: hasVariants ? undefined : Number(form.stock || 0),
  salePrice: hasVariants ? undefined : (form.salePrice || null),
  saleStart: form.saleStart || null,
  saleEnd: form.saleEnd || null,

  variants: form.variants,

  shippingRates: Object.entries(form.shippingRates).map(
    ([zone, price]) => ({
      zone,
      price: Number(price),
    })
  ),

  idempotencyKey: generateKey(),
};

      console.log("📦 SUBMIT:", payload);

      await onSubmit(payload);

      console.log("✅ SUBMIT DONE");

    } catch (err) {
      console.error("💥 SUBMIT ERROR:", err);
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

    {/* SALE PRICE */}
    <input
      type="number"
      value={form.salePrice || ""}
      onChange={(e) =>
        form.setSalePrice(e.target.value ? Number(e.target.value) : "")
      }
      placeholder="Sale price"
      className="w-full border p-2 rounded"
    />
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
        name="description"
        defaultValue={initialData?.description || ""}
        placeholder={t.description}
        required
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
      <button className="w-full bg-orange-500 text-white py-3 rounded">
        Submit
      </button>
    </form>
  );
}
