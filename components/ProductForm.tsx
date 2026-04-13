"use client";

"use client";

import { FormEvent } from "react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch"; // ✅ ĐẶT Ở ĐÂY

import { useProductForm } from "./product/useProductForm";
import ImageUpload from "./product/ImageUpload";
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
     UPLOAD IMAGE (MAIN)
  ========================= */
  const handleUpload = async (files: File[]) => {
  if (!files.length) return;

  console.log("🚀 HANDLE UPLOAD START");

  try {
    const uploads = files.map(async (file) => {
      console.log("📂 Uploading:", file.name);

      const formData = new FormData();
      formData.append("file", file);

      const res = await apiAuthFetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("❌ Upload failed:", res.status);
        throw new Error("UPLOAD_FAILED");
      }

      const data = await res.json();
      console.log("✅ Uploaded:", data);

      return data.url;
    });

    const urls = await Promise.all(uploads);

    console.log("🔥 FINAL URLS:", urls);

    form.setImages((prev: string[]) => [...prev, ...urls]);

  } catch (err) {
    console.error("❌ HANDLE UPLOAD ERROR:", err);
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

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          console.error("❌ Detail upload failed:", res.status);
          throw new Error("UPLOAD_FAILED");
        }

        const data = await res.json();
        console.log("✅ Detail uploaded:", data);

        return data.url;
      });

      const urls = await Promise.all(uploads);

      console.log("🔥 DETAIL URLS:", urls);

      form.setDetail((prev: string) => {
        const html = urls.map((url) => `<img src="${url}" />`).join("\n");
        return prev + "\n" + html;
      });

    } catch (err) {
      console.error("❌ DETAIL UPLOAD ERROR:", err);
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
      <div className="relative h-28">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            console.log("📥 FILE CHANGED:", files);
            handleUpload(files);
          }}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />

        <div className="flex items-center justify-center border-2 border-dashed rounded h-28">
          ＋
        </div>
      </div>

      {/* PREVIEW */}
      <div className="grid grid-cols-3 gap-2">
        {form.images.map((img: string) => (
          <img key={img} src={img} className="h-20 object-cover rounded" />
        ))}
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
