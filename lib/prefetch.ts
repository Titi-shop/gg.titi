import { mutate } from "swr";

export const prefetchProduct = async (id: string) => {
  try {
    const data = await fetch(`/api/products/${id}`).then(r => r.json());

    mutate(`/api/products/${id}`, data, false); // ❌ không revalidate lại
  } catch (e) {
    console.warn("Prefetch failed", e);
  }
};
