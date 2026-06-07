import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

export type CartItemInput = {
  product_id: string;
  variant_id?: string | null;
  quantity?: number;
};

export type CartRow = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
  price: string;
  sale_price: string;
  is_price_changed: boolean;
  is_out_of_stock: boolean;
  name: string;
  slug: string;
  thumbnail: string;
  images: string[];
};

/* =========================================================
   HELPERS
========================================================= */

function isUUID(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function normalizeQuantity(
  value: unknown
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 1;
  }

  const quantity = Math.floor(value);

  if (quantity < 1) {
    return 1;
  }

  if (quantity > 99) {
    return 99;
  }

  return quantity;
}

function normalizeVariantId(
  value: unknown
): string | null {
  return isUUID(value)
    ? value
    : null;
}

/* =========================================================
   GET CART
========================================================= */

export async function getCart(
  userId: string
): Promise<CartRow[]> {
  console.log(
    "[CART][GET] START",
    { userId }
  );

  if (!isUUID(userId)) {
    throw new Error(
      "INVALID_USER_ID"
    );
  }

  const rs = await query<CartRow>(
    `
    SELECT
      product_id,
      variant_id,
      quantity,
      unit_price::text AS price,
      final_price::text AS sale_price,
      is_price_changed,
      is_out_of_stock,
      product_name AS name,
      product_slug AS slug,
      thumbnail,
      images
    FROM cart_items
    WHERE user_id = $1
    AND deleted_at IS NULL
    ORDER BY created_at DESC
    `,
    [userId]
  );

  console.log(
    "[CART][GET] DONE",
    {
      userId,
      count: rs.rows.length,
    }
  );

  return rs.rows;
}

/* =========================================================
   DELETE ITEM
========================================================= */

export async function deleteCartItem(
  userId: string,
  productId: string,
  variantId?: string | null
): Promise<void> {
  console.log(
    "[CART][DELETE] START",
    {
      userId,
      productId,
      variantId,
    }
  );

  if (!isUUID(userId)) {
    throw new Error(
      "INVALID_USER_ID"
    );
  }

  if (!isUUID(productId)) {
    throw new Error(
      "INVALID_PRODUCT_ID"
    );
  }

  const normalizedVariantId =
    normalizeVariantId(
      variantId
    );

  await query(
    `
    UPDATE cart_items

    SET
      deleted_at = NOW(),
      updated_at = NOW()

    WHERE user_id = $1
    AND product_id = $2
    AND variant_id
      IS NOT DISTINCT FROM $3
    `,
    [
      userId,
      productId,
      normalizedVariantId,
    ]
  );

  console.log(
    "[CART][DELETE] DONE"
  );
}

/* =========================================================
   UPDATE QUANTITY
========================================================= */

export async function updateCartItemQuantity(
  userId: string,
  productId: string,
  variantId: string | null,
  quantity: number
): Promise<void> {
  console.log(
    "[CART][PATCH] START",
    {
      userId,
      productId,
      variantId,
      quantity,
    }
  );

  if (!isUUID(userId)) {
    throw new Error(
      "INVALID_USER_ID"
    );
  }

  if (!isUUID(productId)) {
    throw new Error(
      "INVALID_PRODUCT_ID"
    );
  }

  const normalizedVariantId =
    normalizeVariantId(
      variantId
    );

  const normalizedQuantity =
    normalizeQuantity(quantity);

  await query(
    `
    UPDATE cart_items

    SET
      quantity = $4,
      updated_at = NOW()

    WHERE user_id = $1
    AND product_id = $2
    AND variant_id
      IS NOT DISTINCT FROM $3
    AND deleted_at IS NULL
    `,
    [
      userId,
      productId,
      normalizedVariantId,
      normalizedQuantity,
    ]
  );

  console.log(
    "[CART][PATCH] DONE"
  );
}

/* =========================================================
   UPSERT
========================================================= */

export async function upsertCartItems(
  userId: string,
  items: CartItemInput[]
): Promise<void> {
  console.log(
    "[CART][UPSERT] START",
    {
      userId,
      itemsCount: items.length,
    }
  );

  if (!isUUID(userId)) {
    throw new Error(
      "INVALID_USER_ID"
    );
  }

  if (!Array.isArray(items)) {
    throw new Error(
      "INVALID_ITEMS"
    );
  }

  const deduped = new Map<
    string,
    {
      product_id: string;
      variant_id: string | null;
      quantity: number;
    }
  >();

  for (const item of items) {
    if (!item) {
      continue;
    }

    if (
      !isUUID(item.product_id)
    ) {
      continue;
    }

    const variantId =
      normalizeVariantId(
        item.variant_id
      );

    const quantity =
      normalizeQuantity(
        item.quantity
      );

    const key = `${item.product_id}_${variantId ?? "null"}`;

    const existing =
      deduped.get(key);

    if (existing) {
      existing.quantity += quantity;

      if (
        existing.quantity > 99
      ) {
        existing.quantity = 99;
      }

      continue;
    }

    deduped.set(key, {
      product_id:
        item.product_id,
      variant_id: variantId,
      quantity,
    });
  }

  const finalItems = Array.from(
    deduped.values()
  );

  console.log(
    "[CART][UPSERT] NORMALIZED",
    {
      count:
        finalItems.length,
    }
  );

  if (finalItems.length === 0) {
    return;
  }

  for (const item of finalItems) {
    console.log(
      "[CART][UPSERT] ITEM",
      item
    );

    await query(
      `
      INSERT INTO cart_items (
        user_id,
        product_id,
        variant_id,
        seller_id,
        product_name,
        product_slug,
        thumbnail,
        images,
        unit_price,
        final_price,
        currency,
        quantity,
        is_selected,
        is_available,
        stock_snapshot,
        price_snapshot,
        is_price_changed,
        is_out_of_stock,
        created_at,
        updated_at
      )
      SELECT
        $1,
        p.id,
        $3,
        p.seller_id,
        p.name,
        p.slug,
        COALESCE(
          p.thumbnail,
          ''
        ),
        COALESCE(
          p.images,
          '{}'
        ),
        p.price,
        COALESCE(
          p.sale_price,
          p.final_price,
          p.price
        ),
        p.currency,
        $4,
        true,
        p.is_active,
        p.stock,
        COALESCE(
          p.sale_price,
          p.final_price,
          p.price
        ),
        false,
        CASE
          WHEN p.is_unlimited = false
          AND p.stock <= 0
          THEN true
          ELSE false
        END,
        NOW(),
        NOW()
      FROM products p
      WHERE p.id = $2
      ON CONFLICT (
  user_id,
  product_id,
  variant_key
)
      DO UPDATE SET
        quantity =
          cart_items.quantity
          + EXCLUDED.quantity,
        unit_price =
          EXCLUDED.unit_price,
        final_price =
          EXCLUDED.final_price,
        stock_snapshot =
          EXCLUDED.stock_snapshot,
        price_snapshot =
          EXCLUDED.price_snapshot,
        is_out_of_stock =
          EXCLUDED.is_out_of_stock,
        is_price_changed =
          cart_items.final_price
          IS DISTINCT FROM
          EXCLUDED.final_price,
        deleted_at = NULL,
        updated_at = NOW()
      `,
      [
        userId,
        item.product_id,
        item.variant_id,
        item.quantity,
      ]
    );
  }

  console.log(
    "[CART][UPSERT] DONE"
  );
}
