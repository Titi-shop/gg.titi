export const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");

      const MAX_WIDTH = 1000;

      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);

          const newFile = new File([blob], file.name, {
            type: "image/jpeg",
          });

          console.log("🧠 COMPRESSED:", file.size, "→", newFile.size);

          resolve(newFile);
        },
        "image/jpeg",
        0.7 // 👈 quality
      );
    };

    reader.readAsDataURL(file);
  });
};
