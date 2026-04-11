import { query } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type CartItemInput = {
  product_id: string;
  variant_id?: string | null;
  quantity?: number;
};

/* =========================================================
   INTERNAL: UUID VALIDATION (NO EXTERNAL LIB)
========================================================= */

const isUUID = (value: unknown): value is string => {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value
    )
  );
};

/* =========================================================
   GET CART
========================================================= */

export async function getCart(userId: string) {
  if (!isUUID(userId)) {
    throw new Error("INVALID_USER_ID");
  }

  const { rows } = await query(
  `
  SELECT 
    c.product_id,
    c.variant_id,
    c.quantity,

    c.unit_price AS price,
    c.final_price AS sale_price,

    c.is_price_changed,
    c.is_out_of_stock,

    p.name,
    p.thumbnail,
    p.images

  FROM cart_items c
  JOIN products p ON p.id = c.product_id

  WHERE c.user_id = $1
  AND c.deleted_at IS NULL

  ORDER BY c.created_at DESC
  `,
  [userId]
);

  return rows;
}

/* =========================================================
   DELETE ITEM
========================================================= */

export async function deleteCartItem(
  userId: string,
  productId: string,
  variantId?: string | null
) {
  if (!isUUID(userId) || !isUUID(productId)) {
    throw new Error("INVALID_INPUT");
  }

  const normalizedVariantId = isUUID(variantId) ? variantId : null;

  await query(
    `
    DELETE FROM cart_items
    WHERE user_id = $1
    AND product_id = $2
    AND variant_id IS NOT DISTINCT FROM $3
    `,
    [userId, productId, normalizedVariantId]
  );
}

/* =========================================================
   UPSERT CART (CORE LOGIC)
========================================================= */

export async function upsertCartItems(
  userId: string,
  items: CartItemInput[]
): Promise<void> {
  if (!isUUID(userId)) {
    throw new Error("INVALID_USER_ID");
  }

  if (!Array.isArray(items) || items.length === 0) return;

  const map = new Map<string, CartItemInput>();

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    if (!isUUID(item.product_id)) continue;

    const variantId = isUUID(item.variant_id)
      ? item.variant_id
      : null;

    let quantity =
      typeof item.quantity === "number" && !Number.isNaN(item.quantity)
        ? item.quantity
        : 1;

    if (quantity <= 0) quantity = 1;
    if (quantity > 10) quantity = 10;

    const key = `${item.product_id}_${variantId ?? "null"}`;

    // ✅ FIX: không cộng dồn nữa
    map.set(key, {
      product_id: item.product_id,
      variant_id: variantId,
      quantity,
    });
  }

  const finalItems = Array.from(map.values());
  if (finalItems.length === 0) return;

  const productIds: string[] = [];
  const variantIds: (string | null)[] = [];
  const quantities: number[] = [];

  for (const item of finalItems) {
    productIds.push(item.product_id);

    variantIds.push(
      item.variant_id && isUUID(item.variant_id)
        ? item.variant_id
        : null
    );

    quantities.push(item.quantity ?? 1);
  }

  await query(
    `
    INSERT INTO cart_items (
      user_id,
      product_id,
      variant_id,
      seller_id,
      unit_price,
      final_price,
      quantity
    )
    SELECT 
      $1,
      x.product_id,
      x.variant_id,
      p.seller_id,
      p.price,
      COALESCE(p.sale_price, p.price),
      x.quantity
    FROM UNNEST($2::uuid[], $3::uuid[], $4::int[]) 
      AS x(product_id, variant_id, quantity)
    JOIN products p ON p.id = x.product_id

    ON CONFLICT ON CONSTRAINT cart_items_unique
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      unit_price = EXCLUDED.unit_price,
      final_price = EXCLUDED.final_price,
      updated_at = NOW()
    `,
    [userId, productIds, variantIds, quantities]
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
) {
  if (!isUUID(userId) || !isUUID(productId)) {
    throw new Error("INVALID_INPUT");
  }

  const normalizedVariantId = isUUID(variantId) ? variantId : null;

  if (quantity <= 0) {
    return deleteCartItem(userId, productId, normalizedVariantId);
  }

  if (quantity > 99) quantity = 99;

  await query(
    `
    UPDATE cart_items
    SET quantity = $4,
        updated_at = NOW()
    WHERE user_id = $1
    AND product_id = $2
    AND variant_id IS NOT DISTINCT FROM $3
    `,
    [userId, productId, normalizedVariantId, quantity]
  );
}
