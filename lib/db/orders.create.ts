import { withTransaction } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type OrderItemInternal = {
  product: {
    id: string;
    seller_id: string;
    name: string;
    thumbnail: string | null;
  };
  variant_id: string | null;
  price: number;
  qty: number;
  total: number;
};

type CreateOrderInput = {
  userId: string;
  piPaymentId: string;
  txid: string;
  idempotencyKey: string;

  items: {
    product_id: string;
    quantity: number;
    variant_id?: string | null;
  }[];

  country: string;
  zone: string;

  shipping: {
    name: string;
    phone: string;
    address_line: string;
    ward?: string | null;
    district?: string | null;
    region?: string | null;
    postal_code?: string | null;
  };
   pricing: {
  subtotal: number;
  shipping_fee: number;
  total: number;

  items: {
    product_id: string;
    variant_id: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
};
};

function isUUID(v: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(v);
}

/* =========================================================
   MAIN
========================================================= */

export async function createOrder(input: CreateOrderInput) {
  const { userId, items } = input;

  if (!userId) throw new Error("INVALID_USER");
  if (!items?.length) throw new Error("INVALID_ITEMS");

  const zone = input.zone?.trim().toLowerCase();
  const country = input.country?.trim().toUpperCase();

  return withTransaction(async (client) => {
     const existingOrder =
  await client.query<{ id: string }>(
    `
    SELECT id
    FROM orders
    WHERE idempotency_key = $1
    LIMIT 1
    `,
    [input.idempotencyKey]
  );

if (existingOrder.rows.length) {
  console.log(
    "[ORDER][IDEMPOTENT_HIT]",
    existingOrder.rows[0].id
  );

  return {
    orderId: existingOrder.rows[0].id,
  };
}
    console.log("🟡 [ORDER][V7][PAID_FLOW] START", {
      userId,
      itemsCount: items.length,
      piPaymentId: input.piPaymentId,
      txid: input.txid,
      idempotencyKey: input.idempotencyKey,
    });

    /* =========================================================
       PRODUCTS LOAD
    ========================================================= */

    const productIds = items.map((i) => i.product_id);

    const { rows: products } = await client.query<any>(
      `
      SELECT id, seller_id, name, price,
             sale_price, sale_start, sale_end,
             thumbnail, is_active, deleted_at, stock
      FROM products
      WHERE id = ANY($1::uuid[])
      FOR UPDATE
      `,
      [productIds]
    );

    const productMap = new Map(products.map((p) => [p.id, p]));

    /* =========================================================
       VARIANTS
    ========================================================= */

    const variantIds = items.map((i) => i.variant_id).filter(Boolean);

    const { rows: variants } =
      variantIds.length > 0
        ? await client.query<any>(
            `
            SELECT
  id,
  product_id,
  price,
  sale_price,
  stock,
  is_active
FROM product_variants
WHERE id = ANY($1::uuid[])
FOR UPDATE
            `,
            [variantIds]
          )
        : { rows: [] };

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    /* =========================================================
       CALCULATE
    ========================================================= */
    let totalQuantity = 0;

    const orderItems: OrderItemInternal[] = [];
const subtotal =
  Number(input.pricing.subtotal);

const shippingFee =
  Number(input.pricing.shipping_fee);

const total =
  Number(input.pricing.total);
    for (const item of items) {
      if (!isUUID(item.product_id)) {
        throw new Error("INVALID_PRODUCT_ID");
      }

      const p = productMap.get(item.product_id);

if (!p) {
  throw new Error("INVALID_PRODUCT");
}

const qty = Math.max(item.quantity, 1);

if (
  p.stock !== null &&
  Number(p.stock) < qty &&
  !item.variant_id
) {
  throw new Error("OUT_OF_STOCK");
}

if (!p.is_active || p.deleted_at) {
  throw new Error("PRODUCT_NOT_AVAILABLE");
}

/* =========================================
   VALIDATE VARIANT
========================================= */

if (item.variant_id) {
  const v = variantMap.get(
    item.variant_id
  );

  if (!v) {
    throw new Error(
      "INVALID_VARIANT"
    );
  }

  if (v.product_id !== p.id) {
    throw new Error(
      "VARIANT_PRODUCT_MISMATCH"
    );
  }

  if (!v.is_active) {
    throw new Error(
      "VARIANT_DISABLED"
    );
  }

  if (
    v.stock !== null &&
    Number(v.stock) < qty
  ) {
    throw new Error(
      "OUT_OF_STOCK"
    );
  }
}

/* =========================================
   PRICE FROM PAYMENT INTENT
========================================= */

const pricingItem =
  input.pricing.items.find(
    (x) =>
      x.product_id === item.product_id &&
      (x.variant_id ?? null) ===
        (item.variant_id ?? null)
  );

if (!pricingItem) {
  throw new Error(
    "PRICING_ITEM_NOT_FOUND"
  );
}

const price =
  Number(pricingItem.unit_price);

const lineTotal =
  Number(pricingItem.subtotal);
      totalQuantity += qty;
      orderItems.push({
  product: {
    id: p.id,
    seller_id: p.seller_id,
    name: p.name,
    thumbnail: p.thumbnail ?? null,
  },
  variant_id: item.variant_id ?? null,
  price,
  qty,
  total: lineTotal,
});

      console.log("🧾 [ORDER][ITEM]", {
  productId: p.id,
  qty,
  price,
  total: lineTotal,
});
    }

    /* =========================================================
   STOCK DEDUCTION (STRICT)
========================================================= */

for (const item of orderItems) {
  let res;

  if (item.variant_id) {
    console.log(
      "[ORDER][STOCK][VARIANT]",
      {
        variantId: item.variant_id,
        qty: item.qty,
      }
    );

    res = await client.query(
      `
      UPDATE product_variants
      SET stock = stock - $1
      WHERE id = $2
      AND stock >= $1
      `,
      [
        item.qty,
        item.variant_id,
      ]
    );

    if (res.rowCount) {
      await client.query(
        `
        UPDATE products
        SET sold = sold + $1
        WHERE id = $2
        `,
        [
          item.qty,
          item.product.id,
        ]
      );
    }
  } else {
    console.log(
      "[ORDER][STOCK][PRODUCT]",
      {
        productId: item.product.id,
        qty: item.qty,
      }
    );

    res = await client.query(
      `
      UPDATE products
      SET
        stock = stock - $1,
        sold = sold + $1
      WHERE id = $2
      AND stock >= $1
      `,
      [
        item.qty,
        item.product.id,
      ]
    );
  }

  if (!res.rowCount) {
    console.error(
      "[ORDER][STOCK_FAIL]",
      {
        productId: item.product.id,
        variantId: item.variant_id,
        qty: item.qty,
      }
    );

    throw new Error("OUT_OF_STOCK");
  }

  console.log(
    "[ORDER][STOCK_OK]",
    {
      productId: item.product.id,
      variantId: item.variant_id,
      qty: item.qty,
    }
  );
}

    /* =========================================================
       CREATE ORDER (PAID ONLY FLOW)
    ========================================================= */

    console.log("🟡 [ORDER][INSERT] CREATE ORDER ROW");

    const orderRes = await client.query<{ id: string }>(
      `
      INSERT INTO orders (
        buyer_id,
        seller_id,

        pi_payment_id,
        pi_txid,
        idempotency_key,

        payment_status,
        paid_at,

        fulfillment_status,

        settlement_status,
        shipment_status,
        delivery_status,

        items_total,
        subtotal,
        discount,
        shipping_fee,
        tax,
        total,
        currency,

        shipping_name,
        shipping_phone,
        shipping_address_line,
        shipping_ward,
        shipping_district,
        shipping_region,
        shipping_country,
        shipping_postal_code,

        total_items,
        total_quantity,

        created_at,
        updated_at
      )
      VALUES (
        $1,$2,

        $3,$4,$5,

        'paid',
        now(),

        'pending_fulfillment',

        'ESCROWED',
        'PENDING',
        'PENDING',

        $6,$7,$8,$9,$10,$11,$12,

        $13,$14,$15,$16,$17,$18,$19,$20,

        $21,$22,

        now(),
        now()
      )
      RETURNING id
      `,
      [
        userId,
        orderItems[0].product.seller_id,

        input.piPaymentId,
        input.txid,
        input.idempotencyKey,

        orderItems.length,
        subtotal,
        0,
        shippingFee,
        0,
        total,
        "PI",

        input.shipping.name,
        input.shipping.phone,
        input.shipping.address_line,
        input.shipping.ward ?? null,
        input.shipping.district ?? null,
        input.shipping.region ?? null,
        country,
        input.shipping.postal_code ?? null,

        orderItems.length,
        totalQuantity,
      ]
    );

    const orderId = orderRes.rows[0].id;

    console.log("🟢 [ORDER][CREATED][PAID_FLOW]", {
      orderId,
      buyerId: userId,
      sellerId: orderItems[0].product.seller_id,
      total,
    });

    /* =========================================================
       ORDER ITEMS INSERT
    ========================================================= */

    for (const item of orderItems) {
      await client.query(
        `
        INSERT INTO order_items (
          order_id,
          product_id,
          variant_id,
          seller_id,
          product_name,
          thumbnail,
          unit_price,
          quantity,
          total_price
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          orderId,
          item.product.id,
          item.variant_id,
          item.product.seller_id,
          item.product.name,
          item.product.thumbnail ?? "",
          item.price,
          item.qty,
          item.total,
        ]
      );
    }

    console.log("🟢 [ORDER][ITEMS_CREATED]", {
      orderId,
      items: orderItems.length,
    });

    /* =========================================================
       RETURN
    ========================================================= */

    return { orderId };
  });
      }
