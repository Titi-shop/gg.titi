// lib/supabase/upload.ts

import { supabase } from "./client";

export async function uploadImage(file: File) {
  console.log("📡 UPLOAD TO SUPABASE START");

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;

  console.log("📂 FILE NAME:", fileName);

  const { data, error } = await supabase.storage
    .from("products") // ⚠️ bucket name
    .upload(fileName, file);

  if (error) {
    console.error("❌ SUPABASE ERROR:", error);
    throw error;
  }

  console.log("✅ STORAGE RESPONSE:", data);

  const { data: publicUrl } = supabase.storage
    .from("products")
    .getPublicUrl(fileName);

  console.log("🌍 PUBLIC URL:", publicUrl?.publicUrl);

  return publicUrl?.publicUrl;
}
