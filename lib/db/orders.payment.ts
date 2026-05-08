import { withTransaction } from "@/lib/db";

/* =========================================================
   TYPES
========================================================= */

type FinalizePaidOrderParams = {
  paymentIntentId: string;
  piPaymentId: string;
  txid: string;

  verifiedAmount: number;
  receiverWallet: string;

  piPayload: unknown;
  rpcPayload: unknown;
};

type PaymentIntentRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;

  unit_price: string;
  subtotal: string;
  discount: string;
  shipping_fee: string;
  total_amount: string;
  currency: string;

  shipping_snapshot: {
    name?: string;
    phone?: string;
    address_line?: string;
    ward?: string;
    district?: string;
    region?: string;
    postal_code?: string;
  };

  country: string;
  zone: string;

  merchant_wallet: string;

  status: string;
  pi_payment_id: string | null;
  txid: string | null;
};

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error("INVALID_NUMBER");
  return n;
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.00001;
}

/* =========================================================
   FINALIZE ORDER FROM VERIFIED PAYMENT
========================================================= */

export async function finalizePaidOrderFromIntent({
  paymentIntentId,
  piPaymentId,
  txid,
  verifiedAmount,
  receiverWallet,
  piPayload,
  rpcPayload,
}: FinalizePaidOrderParams) {
  console.log("🟡 [DB FINALIZE] START", {
    paymentIntentId,
    piPaymentId,
    txid,
    verifiedAmount,
  });

  return withTransaction(async (client) => {
    /* =====================================================
       1. LOCK PAYMENT INTENT
    ===================================================== */

    const intentRes = await client.query<PaymentIntentRow>(
      `
      SELECT *
      FROM payment_intents
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentIntentId]
    );

    if (!intentRes.rows.length) {
      throw new Error("PAYMENT_INTENT_NOT_FOUND");
    }

    const intent = intentRes.rows[0];

    console.log("🟡 [DB FINALIZE] INTENT_LOCKED", {
      id: intent.id,
      status: intent.status,
      total: intent.total_amount,
      product: intent.product_id,
      variant: intent.variant_id,
      qty: intent.quantity,
    });

    /* =====================================================
       2. IDEMPOTENT RETURN
    ===================================================== */

    if (intent.status === "paid") {
      const existingOrder = await client.query<{ id: string }>(
        `
        SELECT id
        FROM orders
        WHERE pi_payment_id = $1
        LIMIT 1
        `,
        [piPaymentId]
      );

      console.log("🟢 [DB FINALIZE] ALREADY_PAID");

      return {
        ok: true,
        already: true,
        orderId: existingOrder.rows[0]?.id ?? null,
      };
    }

    if (
      intent.status !== "submitted" &&
      intent.status !== "verifying"
    ) {
      throw new Error("INVALID_PAYMENT_INTENT_STATUS");
    }

    /* =====================================================
       3. VERIFY MONEY AGAIN
    ===================================================== */

    const expectedAmount = safeNumber(intent.total_amount);

    if (!sameAmount(expectedAmount, verifiedAmount)) {
      throw new Error("AMOUNT_MISMATCH");
    }

    if (
  (intent.merchant_wallet || "").trim() !==
  (receiverWallet || "").trim()
) {
  throw new Error("RECEIVER_MISMATCH");
}

    console.log("🟢 [DB FINALIZE] MONEY_VERIFIED");

    /* =====================================================
       4. DUPLICATE ORDER CHECK
    ===================================================== */

    const dupOrder = await client.query<{ id: string }>(
      `
      SELECT id
      FROM orders
      WHERE pi_payment_id = $1
      LIMIT 1
      `,
      [piPaymentId]
    );

    if (dupOrder.rows.length) {
      console.log("🟢 [DB FINALIZE] DUPLICATE_ORDER_RETURN");

      await client.query(
        `
        UPDATE payment_intents
        SET
          status = 'paid',
          paid_at = now(),
          txid = $2,
          updated_at = now()
        WHERE id = $1
        `,
        [paymentIntentId, txid]
      );

      return {
        ok: true,
        already: true,
        orderId: dupOrder.rows[0].id,
      };
    }

    /* =====================================================
       5. LOCK PRODUCT / VARIANT STOCK
    ===================================================== */

    let productName = "";
    let productSlug = "";
    let productThumb = "";
    let productImages: string[] = [];
    let variantName = "";
    let variantValue = "";
    let isDigital = false;

    if (intent.variant_id) {
      const variantRes = await client.query<{
        stock: number;
        is_unlimited: boolean;
        sold: number;

        name: string;
        option_1: string | null;
        option_2: string | null;
        option_3: string | null;
        image: string;

        product_name: string;
        product_slug: string;
        product_thumbnail: string;
        product_images: string[];
        is_digital: boolean;
      }>(
        `
        SELECT
          pv.stock,
          pv.is_unlimited,
          pv.sold,
          pv.name,
          pv.option_1,
          pv.option_2,
          pv.option_3,
          pv.image,

          p.name as product_name,
          p.slug as product_slug,
          p.thumbnail as product_thumbnail,
          p.images as product_images,
          p.is_digital
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = $1
        FOR UPDATE
        `,
        [intent.variant_id]
      );

      if (!variantRes.rows.length) {
        throw new Error("VARIANT_NOT_FOUND");
      }

      const variant = variantRes.rows[0];

      if (!variant.is_unlimited && variant.stock < intent.quantity) {
        throw new Error("OUT_OF_STOCK");
      }

      if (!variant.is_unlimited) {
        await client.query(
          `
          UPDATE product_variants
          SET
            stock = stock - $2,
            sold = sold + $2,
            updated_at = now()
          WHERE id = $1
          `,
          [intent.variant_id, intent.quantity]
        );
      }

      await client.query(
        `
        UPDATE products
        SET
          sold = sold + $2,
          updated_at = now()
        WHERE id = $1
        `,
        [intent.product_id, intent.quantity]
      );

      productName = variant.product_name;
      productSlug = variant.product_slug;
      productThumb = variant.product_thumbnail;
      productImages = variant.product_images || [];
      variantName = variant.name || "";
      variantValue = [
        variant.option_1,
        variant.option_2,
        variant.option_3,
      ]
        .filter(Boolean)
        .join(" / ");
      isDigital = variant.is_digital;
    } else {
      const productRes = await client.query<{
        stock: number;
        is_unlimited: boolean;
        sold: number;
        name: string;
        slug: string;
        thumbnail: string;
        images: string[];
        is_digital: boolean;
      }>(
        `
        SELECT *
        FROM products
        WHERE id = $1
        FOR UPDATE
        `,
        [intent.product_id]
      );

      if (!productRes.rows.length) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      const product = productRes.rows[0];

      if (!product.is_unlimited && product.stock < intent.quantity) {
        throw new Error("OUT_OF_STOCK");
      }

      if (!product.is_unlimited) {
        await client.query(
          `
          UPDATE products
          SET
            stock = stock - $2,
            sold = sold + $2,
            updated_at = now()
          WHERE id = $1
          `,
          [intent.product_id, intent.quantity]
        );
      }

      productName = product.name;
      productSlug = product.slug;
      productThumb = product.thumbnail;
      productImages = product.images || [];
      isDigital = product.is_digital;
    }

    console.log("🟢 [DB FINALIZE] STOCK_OK");

    /* =====================================================
       6. CREATE ORDER
    ===================================================== */

    const orderInsert = await client.query<{ id: string }>(
      `
      INSERT INTO orders (
        buyer_id,
        seller_id,

        pi_payment_id,
        pi_txid,
        idempotency_key,

        payment_status,
        paid_at,

        items_total,
        subtotal,
        discount,
        shipping_fee,
        tax,
        total,
        currency,

        status,

        shipping_name,
        shipping_phone,
        shipping_address_line,
        shipping_ward,
        shipping_district,
        shipping_region,
        shipping_country,
        shipping_postal_code,
        shipping_zone,

        total_items,
        total_quantity
      )
      VALUES (
        $1,$2,
        $3,$4,$5,
        'paid', now(),
        $6,$7,$8,$9,0,$10,$11,
        'pending',
        $12,$13,$14,$15,$16,$17,$18,$19,$20,
        1,$21
      )
      RETURNING id
      `,
      [
        intent.buyer_id,
        intent.seller_id,

        piPaymentId,
        txid,
        piPaymentId,

        intent.subtotal,
        intent.subtotal,
        intent.discount,
        intent.shipping_fee,
        intent.total_amount,
        intent.currency,

        intent.shipping_snapshot?.name ?? "",
        intent.shipping_snapshot?.phone ?? "",
        intent.shipping_snapshot?.address_line ?? "",
        intent.shipping_snapshot?.ward ?? null,
        intent.shipping_snapshot?.district ?? null,
        intent.shipping_snapshot?.region ?? null,
        intent.country,
        intent.shipping_snapshot?.postal_code ?? null,
        intent.zone,

        intent.quantity,
      ]
    );

    const orderId = orderInsert.rows[0].id;

    console.log("🟢 [DB FINALIZE] ORDER_CREATED", orderId);

    /* =====================================================
       7. CREATE ORDER ITEM
    ===================================================== */

    await client.query(
      `
      INSERT INTO order_items (
        order_id,
        seller_id,
        product_id,
        variant_id,

        product_name,
        product_slug,
        thumbnail,
        images,

        variant_name,
        variant_value,
        is_digital,

        unit_price,
        quantity,
        total_price,
        currency,

        status,

        snapshot
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,
        $9,$10,$11,
        $12,$13,$14,$15,
        'pending',
        $16
      )
      `,
      [
        orderId,
        intent.seller_id,
        intent.product_id,
        intent.variant_id,

        productName,
        productSlug,
        productThumb,
        productImages,

        variantName,
        variantValue,
        isDigital,

        intent.unit_price,
        intent.quantity,
        safeNumber(intent.unit_price) * intent.quantity,
        intent.currency,

        JSON.stringify({
          payment_intent_id: paymentIntentId,
          pi_payment_id: piPaymentId,
          txid,
        }),
      ]
    );

    console.log("🟢 [DB FINALIZE] ORDER_ITEM_CREATED");

    /* =====================================================
       8. PAYMENT RECEIPT
    ===================================================== */

    await client.query(
      `
      INSERT INTO payment_receipts (
        payment_intent_id,
        pi_payment_id,
        txid,
        verified_amount,
        receiver_wallet,
        verification_status,
        pi_payload,
        rpc_payload
      )
      VALUES (
        $1,$2,$3,$4,$5,'verified',$6,$7
      )
      `,
      [
        paymentIntentId,
        piPaymentId,
        txid,
        verifiedAmount,
        receiverWallet,
        JSON.stringify(piPayload),
        JSON.stringify(rpcPayload),
      ]
    );

    console.log("🟢 [DB FINALIZE] RECEIPT_CREATED");

    /* =====================================================
       9. UPDATE PAYMENT INTENT
    ===================================================== */

    await client.query(
      `
      UPDATE payment_intents
      SET
        status = 'paid',
        txid = $2,
        paid_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [paymentIntentId, txid]
    );

    /* =====================================================
       10. UPSERT PI PAYMENTS (compat/debug)
    ===================================================== */

    await client.query(
  `
  INSERT INTO pi_payments (
    user_id,
    pi_payment_id,
    txid,
    amount,
    status,
    expected_amount,
    verified_amount,
    idempotency_key,
    country,
    zone,
    order_id,
    raw,
    completed_at,
    updated_at
  )
  VALUES (
    $1,$2,$3,$4,
    'completed',
    $5,$6,$7,$8,$9,$10,$11,
    now(),
    now()
  )
  ON CONFLICT (pi_payment_id)
  DO UPDATE SET
    txid = EXCLUDED.txid,
    status = 'completed',
    verified_amount = EXCLUDED.verified_amount,
    order_id = EXCLUDED.order_id,
    raw = EXCLUDED.raw,
    updated_at = now()
  `,
  [
    intent.buyer_id,
    piPaymentId,
    txid,
    verifiedAmount,
    expectedAmount,
    verifiedAmount,
    piPaymentId,
    intent.country,
    intent.zone,
    orderId,
    JSON.stringify({ pi: piPayload, rpc: rpcPayload }),
  ]
);

    console.log("🟢 [DB FINALIZE] PI_PAYMENT_LOGGED");

    return {
      ok: true,
      orderId,
    };
  });
}
