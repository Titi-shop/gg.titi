import { query } from "@/lib/db";

/* ================= TYPES ================= */

export type ReviewRow = {
  id: string;
  order_id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type OrderCheckRow = {
  buyer_id: string;
  status: string;
};

type OrderItemRow = {
  id: string;
  seller_id: string;
  product_name: string;
  thumbnail: string | null;
};

/* =========================================================
   CHECK ORDER + PRODUCT
========================================================= */
export async function getOrderForReview(
  orderId: string,
  productId: string
): Promise<OrderCheckRow | null> {
  const res = await query<OrderCheckRow>(
    `
    select o.buyer_id, o.status
    from orders o
    join order_items oi on oi.order_id = o.id
    where o.id = $1
    and oi.product_id = $2
    limit 1
    `,
    [orderId, productId]
  );

  return res.rows[0] ?? null;
}

/* =========================================================
   GET ORDER ITEM
========================================================= */
export async function getOrderItemForReview(
  orderId: string,
  productId: string
): Promise<OrderItemRow | null> {
  const res = await query<OrderItemRow>(
    `
    select
      id,
      seller_id,
      product_name,
      thumbnail
    from order_items
    where order_id = $1
    and product_id = $2
    limit 1
    `,
    [orderId, productId]
  );

  return res.rows[0] ?? null;
}

/* =========================================================
   CHECK REVIEW EXISTS
========================================================= */
export async function checkReviewExists(
  orderId: string,
  productId: string,
  userId: string
): Promise<boolean> {
  const res = await query(
    `
    select 1
    from reviews
    where order_id = $1
    and product_id = $2
    and user_id = $3
    limit 1
    `,
    [orderId, productId, userId]
  );

  return res.rows.length > 0;
}

/* =========================================================
   CREATE REVIEW
========================================================= */
export async function createReview(
  userId: string,
  orderId: string,
  productId: string,
  rating: number,
  comment: string
): Promise<ReviewRow> {
  /* ===== CHECK ORDER ===== */
  const order = await getOrderForReview(orderId, productId);

  if (!order) {
    throw new Error("PRODUCT_NOT_IN_ORDER");
  }

  if (order.buyer_id !== userId) {
    throw new Error("FORBIDDEN_ORDER");
  }

  const status = order.status.toLowerCase();

  if (status !== "completed" && status !== "received") {
    throw new Error("ORDER_NOT_REVIEWABLE");
  }

  /* ===== GET ITEM ===== */
  const item = await getOrderItemForReview(orderId, productId);

  if (!item) {
    throw new Error("ORDER_ITEM_NOT_FOUND");
  }

  /* ===== CHECK EXIST ===== */
  const exists = await checkReviewExists(orderId, productId, userId);

  if (exists) {
    throw new Error("ALREADY_REVIEWED");
  }

  /* ===== INSERT ===== */
  const insert = await query<ReviewRow>(
    `
    insert into reviews (
      order_id,
      order_item_id,
      product_id,
      seller_id,
      user_id,
      product_name,
      product_thumbnail,
      rating,
      comment
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    returning *
    `,
    [
      orderId,
      item.id,
      productId,
      item.seller_id,
      userId,
      item.product_name,
      item.thumbnail,
      rating,
      comment,
    ]
  );

  const review = insert.rows[0];

  /* ===== UPDATE AVG ===== */
  await query(
    `
    update products
    set rating_avg = (
      select avg(rating)
      from reviews
      where product_id = $1
    )
    where id = $1
    `,
    [productId]
  );

  return review;
}

/* =========================================================
   GET REVIEWS BY USER
========================================================= */
export async function getReviewsByUser(userId: string) {
  const res = await query<{
    order_id: string;
    product_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
  }>(
    `
    select order_id, product_id, rating, comment, created_at
    from reviews
    where user_id = $1
    order by created_at desc
    `,
    [userId]
  );

  return res.rows;
}
