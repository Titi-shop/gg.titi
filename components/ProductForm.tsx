
"use client";

import { useState, FormEvent } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { compressImage } from "@/lib/upload/imageUtils";

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

/* =========================
   COMPONENT
========================= */
export default function ProductForm({
  categories,
  initialData,
  onSubmit,
}: any) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  const form = useProductForm(initialData);

  const [uploading, setUploading] = useState(false);

  /* =========================
     HELPER: UPLOAD PROGRESS
  ========================= */
  const uploadWithProgress = (
    url: string,
    file: File
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("PUT", url);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          console.log("📊 Upload:", percent + "%");
        }
      };

      xhr.onload = () => (xhr.status === 200 ? resolve() : reject());
      xhr.onerror = () => reject();

      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });

  /* =========================
     MAIN UPLOAD
  ========================= */
  const handleUpload = async (files: File[]) => {
    if (!files.length) return;

    setUploading(true);
    console.log("🚀 START UPLOAD");

    try {
      const uploads = files.map(async (file) => {
        console.log("📂 File:", file.name);

        const compressed = await compressImage(file);

        /* GET SIGNED URL */
        const res = await fetch("/api/upload-url", {
          method: "POST",
        });

        if (!res.ok) {
          console.error("❌ SIGNED URL FAIL");
          throw new Error();
        }

        const { url, path } = await res.json();

        /* UPLOAD */
        await uploadWithProgress(url, compressed);

        /* PUBLIC URL */
        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${path}`;

        return publicUrl;
      });

      const urls = await Promise.all(uploads);

      form.setImages((prev: string[]) => [...prev, ...urls]);

      console.log("✅ DONE:", urls);
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
        const compressed = await compressImage(file);

        const res = await fetch("/api/upload-url", {
          method: "POST",
        });

        const { url, path } = await res.json();

        await uploadWithProgress(url, compressed);

        return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${path}`;
      });

      const urls = await Promise.all(uploads);

      form.setDetail((prev: string) => {
        const html = urls.map((u) => `<img src="${u}" />`).join("\n");
        return prev + "\n" + html;
      });
    } catch (err) {
      console.error("DETAIL ERROR:", err);
    }
  };

  if (loading || !user) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  /* =========================
     SUBMIT
  ========================= */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.images.length) {
      alert("Thiếu dữ liệu");
      return;
    }

    await onSubmit({
      ...form,
      thumbnail: form.images[0],
    });
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
        <option value="">Category</option>
        {categories.map((c: Category) => (
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
      />

      {/* IMAGE */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {form.images.map((img: string, i: number) => (
            <div key={img} className="relative group">
              <img src={img} className="h-24 w-full rounded object-cover" />

              <button
                type="button"
                onClick={() =>
                  form.setImages((p: string[]) =>
                    p.filter((_, index) => index !== i)
                  )
                }
                className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 rounded opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <label
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl h-28 cursor-pointer ${
            uploading ? "opacity-50" : "hover:bg-gray-50"
          }`}
        >
          <span className="text-2xl">＋</span>
          <span className="text-sm text-gray-500">
            {uploading ? "Uploading..." : "Upload image"}
          </span>

          <input
            type="file"
            hidden
            multiple
            onChange={(e) =>
              handleUpload(Array.from(e.target.files || []))
            }
          />
        </label>
      </div>

      {/* PRICE */}
      <input
        type="number"
        value={form.price}
        onChange={(e) => form.setPrice(Number(e.target.value))}
        placeholder="Price"
        className="w-full border p-2 rounded"
      />

      {/* SHIPPING */}
      <ShippingRates
        shippingRates={form.shippingRates}
        setShippingRates={form.setShippingRates}
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
        className="w-full border p-2 rounded"
      />

      {/* DETAIL */}
      <textarea
        value={form.detail}
        onChange={(e) => form.setDetail(e.target.value)}
        className="w-full border p-2 rounded"
      />

      {/* DETAIL IMAGE */}
      <label className="flex items-center justify-center border-2 border-dashed rounded h-20 cursor-pointer">
        + Thêm ảnh mô tả
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
