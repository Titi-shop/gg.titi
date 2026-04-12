"use client";

import Image from "next/image";
import { uploadImage } from "@/lib/supabase/upload";

export default function ImageUpload({
  images,
  setImages,
}: {
  images: string[];
  setImages: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  /* ================= REMOVE ================= */
  const removeImage = (index: number) => {
    console.log("🗑 REMOVE IMAGE:", index);
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  /* ================= UPLOAD ================= */
  const handleUpload = async (files: File[]) => {
    console.log("📂 FILES SELECTED:", files);

    if (!files.length) {
      console.warn("⚠️ NO FILE SELECTED");
      return;
    }

    try {
      const urls: string[] = [];

      for (const file of files) {
        console.log("🚀 START UPLOAD:", {
          name: file.name,
          size: file.size,
          type: file.type,
        });

        /* ===== VALIDATE ===== */
        if (!file.type.startsWith("image/")) {
          console.error("❌ INVALID FILE TYPE:", file.type);
          alert("File không phải ảnh");
          continue;
        }

        if (file.size > 5 * 1024 * 1024) {
          console.error("❌ FILE TOO LARGE:", file.size);
          alert("Ảnh vượt quá 5MB");
          continue;
        }

        /* ===== UPLOAD ===== */
        const url = await uploadImage(file);

        console.log("✅ UPLOAD SUCCESS:", url);

        if (!url) {
          console.error("❌ NO URL RETURNED");
          continue;
        }

        urls.push(url);
      }

      console.log("📦 ALL UPLOADED URLS:", urls);

      if (urls.length) {
        setImages((prev) => {
          const newImages = [...prev, ...urls];
          console.log("🖼 UPDATED IMAGES:", newImages);
          return newImages;
        });
      } else {
        console.warn("⚠️ NO IMAGE UPLOADED");
      }

    } catch (err: any) {
      console.error("❌ UPLOAD ERROR FULL:", err);
      alert("Upload lỗi — xem console");
    }
  };

  /* ================= UI ================= */
  return (
    <div className="grid grid-cols-3 gap-3">

      {/* IMAGE LIST */}
      {images.map((url, i) => (
        <div key={url} className="relative h-28">
          <Image
            src={url}
            alt=""
            fill
            className="object-cover rounded"
            onError={() => console.error("❌ IMAGE LOAD FAIL:", url)}
          />

          <button
            type="button"
            onClick={() => removeImage(i)}
            className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 rounded"
          >
            ✕
          </button>
        </div>
      ))}

      {/* UPLOAD BUTTON */}
      {images.length < 6 && (
        <label className="flex items-center justify-center border-2 border-dashed rounded cursor-pointer h-28 hover:bg-gray-50">
          ＋

          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              console.log("📥 INPUT CHANGE:", files);
              handleUpload(files);
            }}
          />
        </label>
      )}
    </div>
  );
}
