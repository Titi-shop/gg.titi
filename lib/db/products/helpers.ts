import { query } from "@/lib/db";
import type { ProductStatus } from "@/types/Product";

/* =========================================================
   UUID
========================================================= */

export function isUUID(
  value: string
): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(
    value
  );
}

/* =========================================================
   NUMBER
========================================================= */

export function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const parsed =
    Number(value);

  return Number.isNaN(parsed)
    ? fallback
    : parsed;
}

export function safeNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isNaN(parsed)
    ? null
    : parsed;
}

/* =========================================================
   IMAGES
========================================================= */

export function normalizeImages(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is string =>
      typeof item === "string" &&
      item.trim().length > 0
  );
}

/* =========================================================
   SLUG
========================================================= */

export function slugify(
  value: string
): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9\s-]/g,
      ""
    )
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function generateUniqueSlug(
  name: string
): Promise<string> {
  const baseSlug =
    slugify(name);

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const result =
      await query<{
        id: string;
      }>(
        `
        SELECT id
        FROM products
        WHERE slug = $1
        LIMIT 1
        `,
        [slug]
      );

    if (
      result.rows.length === 0
    ) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/* =========================================================
   STATUS
========================================================= */

export function normalizeStatus(
  status?: ProductStatus,
  is_active?: boolean
): ProductStatus {
  if (status) {
    return status;
  }

  return is_active === false
    ? "hidden"
    : "active";
}
/* =========================================================
   LOGGER
========================================================= */

export function log(
  step: string,
  data?: unknown
): void {
  console.log(
    `🧪 [DB][PRODUCTS] ${step}`,
    data ?? ""
  );
}

export function logError(
  step: string,
  error: unknown
): void {
  console.error(
    `💥 [DB][PRODUCTS] ${step}`,
    error
  );
}
