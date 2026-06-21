import { compressImage } from "@/lib/upload/imageUtils";
import { getPiAccessToken } from "@/lib/piAuth";
import { supabase } from "@/lib/supabase/client";

export async function getSignedUrl() {
  const token =
    await getPiAccessToken();

  const res = await fetch(
    "/api/upload-url",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(
      "SIGNED_URL_FAILED"
    );
  }

  return res.json();
}

export async function uploadImages(
  files: File[]
): Promise<string[]> {
  const uploads =
    files.map(async (file) => {
      const compressed =
        await compressImage(
          file
        );

      const {
        uploadUrl,
        publicUrl,
      } =
        await getSignedUrl();

      await fetch(uploadUrl, {
        method: "PUT",
        body: compressed,
        headers: {
          "Content-Type":
            compressed.type,
        },
      });

      return publicUrl;
    });

  return Promise.all(
    uploads
  );
}

export async function uploadDetailImages(
  userId: string,
  files: File[]
): Promise<string[]> {
  const uploads =
    files.map(async (file) => {
      const path =
        `products/${userId}/${Date.now()}.jpg`;

      await supabase.storage
        .from("products")
        .upload(
          path,
          file
        );

      const { data } =
        supabase.storage
          .from("products")
          .getPublicUrl(path);

      return data.publicUrl;
    });

  return Promise.all(
    uploads
  );
}
