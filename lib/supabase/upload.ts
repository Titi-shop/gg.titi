import { supabase } from "./client";

export async function uploadImage(file: File) {
  console.log("🚀 UPLOAD START");

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;

  console.log("📂 FILE:", fileName);

  const { data, error } = await supabase.storage
    .from("products")
    .upload(fileName, file);

  if (error) {
    console.error("❌ SUPABASE ERROR:", error.message, error);
    alert("UPLOAD ERROR: " + error.message);
    throw error;
  }

  console.log("✅ UPLOAD SUCCESS:", data);

  const { data: publicUrl } = supabase.storage
    .from("products")
    .getPublicUrl(fileName);

  console.log("🌍 PUBLIC URL:", publicUrl?.publicUrl);

  return publicUrl?.publicUrl;
}
