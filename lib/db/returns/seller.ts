import { query, withTransaction } from "@/lib/db";

/* =====================================================
   TYPES (V7 STRICT)
===================================================== */

type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refunded"
  | "rejected";

type TimelineItem = {
  key: string;
  label: string;
  time: string;
};

type ReturnItem = {
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
};

type SellerReturnDetail = {
  id: string;
  return_number: string;
  status: ReturnStatus;
  reason: string;
  description: string | null;
  evidence_images: string[];
  timeline: TimelineItem[];
  items: ReturnItem[];
};

/* =====================================================
   HELPERS
===================================================== */

function isValidUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

/* =====================================================
   GET RETURNS LIST
===================================================== */

export async function getReturnsBySeller(
  sellerId: string,
  status?: ReturnStatus | null
) {
  if (!isValidUuid(sellerId)) {
    throw new Error("INVALID_SELLER_ID");
  }

  const { rows } = await query(
    `
    SELECT
      r.id,
      r.return_number,
      r.status,
      r.created_at,

      ri.product_name,
      ri.thumbnail,
      ri.quantity

    FROM returns r

    JOIN return_items ri
      ON ri.return_id = r.id

    WHERE r.seller_id = $1
      AND r.deleted_at IS NULL
      AND (
        $2::text IS NULL
        OR r.status = $2
      )

    ORDER BY r.created_at DESC
    `,
    [
      sellerId,
      status ?? null,
    ]
  );

  return rows;
}

/* =====================================================
   RETURN DETAIL (SELLER)
===================================================== */

export async function getReturnByIdForSeller(
  returnId: string,
  sellerId: string
): Promise<SellerReturnDetail | null> {

  if (
    !isValidUuid(returnId) ||
    !isValidUuid(sellerId)
  ) {
    throw new Error("INVALID_INPUT");
  }

  const { rows: returnRows } =
    await query(
      `
      SELECT
        id,
        return_number,
        status,
        reason,
        description,
        evidence_images,

        created_at,
        approved_at,
        rejected_at,
        shipped_back_at,
        received_at,
        refunded_at

      FROM returns

      WHERE id = $1
        AND seller_id = $2
        AND deleted_at IS NULL

      LIMIT 1
      `,
      [returnId, sellerId]
    );

  const ret = returnRows[0];

  if (!ret) {
    return null;
  }

  const { rows: itemRows } =
    await query(
      `
      SELECT
        product_name,
        thumbnail,
        quantity,
        unit_price
      FROM return_items
      WHERE return_id = $1
      `,
      [returnId]
    );

  const evidenceImages: string[] =
    Array.isArray(ret.evidence_images)
      ? ret.evidence_images.filter(
          (
            value: unknown
          ): value is string =>
            typeof value ===
              "string" &&
            value.startsWith(
              "http"
            )
        )
      : [];

  const timelineRaw: (
    | TimelineItem
    | false
  )[] = [
    {
      key: "created",
      label:
        "Request created",
      time: ret.created_at,
    },

    ret.approved_at && {
      key: "approved",
      label:
        "Seller approved",
      time: ret.approved_at,
    },

    ret.rejected_at && {
      key: "rejected",
      label: "Rejected",
      time: ret.rejected_at,
    },

    ret.shipped_back_at && {
      key: "shipping_back",
      label:
        "Buyer shipped back",
      time: ret.shipped_back_at,
    },

    ret.received_at && {
      key: "received",
      label:
        "Seller received",
      time: ret.received_at,
    },

    ret.refunded_at && {
      key: "refunded",
      label:
        "Refund completed",
      time: ret.refunded_at,
    },
  ];

  const timeline =
    timelineRaw.filter(
      (
        item
      ): item is TimelineItem =>
        Boolean(item)
    );

  return {
    id: ret.id,
    return_number:
      ret.return_number,
    status: ret.status,
    reason: ret.reason,
    description:
      ret.description ?? null,
    evidence_images:
      evidenceImages,

    timeline,

    items: itemRows.map(
      (item) => ({
        product_name:
          item.product_name,
        thumbnail:
          item.thumbnail,
        quantity: Number(
          item.quantity
        ),
        unit_price: Number(
          item.unit_price
        ),
      })
    ),
  };
}

/* =====================================================
   APPROVE RETURN
===================================================== */

export async function approveReturnBySeller(
  returnId: string,
  sellerId: string
): Promise<boolean> {

  if (
    !isValidUuid(returnId) ||
    !isValidUuid(sellerId)
  ) {
    throw new Error("INVALID_INPUT");
  }

  try {
    return await withTransaction(
      async (client) => {

        const {
          rows: addrRows,
        } =
          await client.query<{
            id: string;
          }>(
            `
            SELECT id

            FROM seller_addresses

            WHERE seller_id = $1
              AND is_active = true

            ORDER BY
              CASE
                WHEN type = 'return'
                  THEN 1

                WHEN type = 'pickup'
                  THEN 2

                ELSE 3
              END

            LIMIT 1
            `,
            [sellerId]
          );

        const returnAddressId =
          addrRows[0]?.id;

        if (
          !returnAddressId
        ) {
          throw new Error(
            "RETURN_ADDRESS_REQUIRED"
          );
        }

        const res =
          await client.query(
            `
            UPDATE returns

            SET
              status = 'approved',
              return_address_id = $1,
              approved_at = NOW(),
              updated_at = NOW()

            WHERE id = $2
              AND seller_id = $3
              AND status = 'pending'
              AND deleted_at IS NULL
            `,
            [
              returnAddressId,
              returnId,
              sellerId,
            ]
          );

        return (
          res.rowCount > 0
        );
      }
    );

  } catch (error) {
    console.error(
      "[RETURN][APPROVE]",
      {
        message:
          error instanceof
          Error
            ? error.message
            : "UNKNOWN",
      }
    );

    throw error;
  }
}

/* =====================================================
   REJECT RETURN
===================================================== */

export async function rejectReturnBySeller(
  returnId: string,
  sellerId: string
): Promise<boolean> {

  if (
    !isValidUuid(returnId) ||
    !isValidUuid(sellerId)
  ) {
    throw new Error("INVALID_INPUT");
  }

  try {
    return await withTransaction(
      async (client) => {

        const res =
          await client.query(
            `
            UPDATE returns

            SET
              status = 'rejected',
              rejected_at = NOW(),
              updated_at = NOW()

            WHERE id = $1
              AND seller_id = $2
              AND status = 'pending'
              AND deleted_at IS NULL
            `,
            [
              returnId,
              sellerId,
            ]
          );

        return (
          res.rowCount > 0
        );
      }
    );

  } catch (error) {
    console.error(
      "[RETURN][REJECT]",
      {
        message:
          error instanceof
          Error
            ? error.message
            : "UNKNOWN",
      }
    );

    throw error;
  }
}

/* =====================================================
   MARK RETURN RECEIVED
===================================================== */

export async function markReturnReceivedBySeller(
  returnId: string,
  sellerId: string
): Promise<boolean> {

  if (
    !isValidUuid(returnId) ||
    !isValidUuid(sellerId)
  ) {
    throw new Error("INVALID_INPUT");
  }

  try {
    return await withTransaction(
      async (client) => {

        const {
          rows,
        } =
          await client.query<{
            refund_amount: string;
            order_id: string;
          }>(
            `
            SELECT
              refund_amount,
              order_id

            FROM returns

            WHERE id = $1
              AND seller_id = $2
              AND status = 'shipping_back'
              AND deleted_at IS NULL

            FOR UPDATE
            `,
            [
              returnId,
              sellerId,
            ]
          );

        const ret = rows[0];

        if (!ret) {
          return false;
        }

        const amount =
          Number(
            ret.refund_amount ??
              0
          );

        if (
          !Number.isFinite(
            amount
          ) ||
          amount <= 0
        ) {
          throw new Error(
            "INVALID_AMOUNT"
          );
        }

        const {
          rows:
            orderRows,
        } =
          await client.query<{
            buyer_id: string;
          }>(
            `
            SELECT buyer_id

            FROM orders

            WHERE id = $1

            LIMIT 1
            `,
            [ret.order_id]
          );

        const buyerId =
          orderRows[0]
            ?.buyer_id;

        if (!buyerId) {
          throw new Error(
            "BUYER_NOT_FOUND"
          );
        }

        await client.query(
          `
          INSERT INTO wallets (
            user_id,
            balance
          )
          VALUES ($1, 0)

          ON CONFLICT (
            user_id
          )
          DO NOTHING
          `,
          [buyerId]
        );

        await client.query(
          `
          UPDATE wallets

          SET
            balance =
              balance + $1,
            updated_at = NOW()

          WHERE user_id = $2
          `,
          [
            amount,
            buyerId,
          ]
        );

        await client.query(
          `
          INSERT INTO wallet_journal (
            owner_id,
            owner_type,
            entry_type,
            direction,
            amount,
            currency,
            note,
            ref_id,
            ref_table
          )
          VALUES (
            $1,
            'BUYER',
            'BUYER_REFUND',
            'CREDIT',
            $2,
            'PI',
            'Return refund',
            $3,
            'returns'
          )
          `,
          [
            buyerId,
            amount,
            returnId,
          ]
        );

        const updateRes =
          await client.query(
            `
            UPDATE returns

            SET
              status = 'refunded',
              refunded_at = NOW(),
              received_at = NOW(),
              updated_at = NOW()

            WHERE id = $1
            `,
            [returnId]
          );

        return (
          updateRes.rowCount >
          0
        );
      }
    );

  } catch (error) {
    console.error(
      "[RETURN][RECEIVED]",
      {
        message:
          error instanceof
          Error
            ? error.message
            : "UNKNOWN",
      }
    );

    throw error;
  }
}
