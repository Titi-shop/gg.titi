"use client";

import {
  uploadProductImages,
  uploadDetailImages,
} from "./product-upload";

import {
  showMessage,
} from "./product-notify";

type UploadParams = {
  t: any;

  setUploading: (
    value: boolean
  ) => void;
};

export function useProductUpload({
  t,
  setUploading,
}: UploadParams) {

  const uploadImages =
    async (
      files: File[]
    ): Promise<string[]> => {
      try {
        setUploading(true);

        return await uploadProductImages(
          files
        );
      } catch (error) {
        console.error(error);

        showMessage(
          t.upload_failed
        );

        return [];
      } finally {
        setUploading(false);
      }
    };

  const uploadDetails =
    async (
      files: File[],
      userId: string
    ): Promise<string[]> => {
      try {
        return await uploadDetailImages(
          files,
          userId
        );
      } catch (error) {
        console.error(error);

        showMessage(
          t.upload_failed
        );

        return [];
      }
    };

  return {
    uploadImages,
    uploadDetails,
  };
}
