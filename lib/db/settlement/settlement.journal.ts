// =====================================================
// lib/db/settlement/settlement.journal.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import {
  randomUUID,
} from "crypto";

/* =====================================================
   TYPES
===================================================== */

type DbClient = {
  query: <T>(
    sql: string,
    params?: unknown[]
  ) => Promise<{
    rows: T[];
    rowCount?: number;
  }>;
};

/* =====================================================
   CREATE JOURNAL ONCE
===================================================== */

export async function createSettlementJournalOnce(
params: {
  ownerId: string;
  ownerType: string;
  refId: string;
  refTable: string;
  entryType: string;
  direction: string;
  amount: number;
  note?: string;

  metadata?: Record<
    string,
    unknown
  >;

  eventHash?: string;

  createdBy?: string;
},

  client?: DbClient
): Promise<void> {

  const db =
    client ?? { query };

  console.log(
    "[SETTLEMENT][JOURNAL] START",
    {
      ownerId:
        params.ownerId,

      refId:
        params.refId,

      entryType:
        params.entryType,

      amount:
        params.amount,
    }
  );

  /* ===================================================
     CHECK EXISTED
  =================================================== */

  const existed =
    await db.query<{
      id: string;
    }>(
      `
      SELECT id

      FROM wallet_journal

      WHERE owner_id = $1
        AND ref_id = $2
        AND entry_type = $3

      LIMIT 1
      `,
      [
        params.ownerId,
        params.refId,
        params.entryType,
      ]
    );

  if (existed.rows.length) {

    console.log(
      "[SETTLEMENT][JOURNAL] EXISTS_SKIP",
      {
        ownerId:
          params.ownerId,

        refId:
          params.refId,

        entryType:
          params.entryType,
      }
    );

    return;
  }

  console.log(
    "[SETTLEMENT][JOURNAL] INSERT_START",
    {
      ownerId:
        params.ownerId,

      refId:
        params.refId,

      entryType:
        params.entryType,
    }
  );

  /* ===================================================
     INSERT JOURNAL
  =================================================== */
try {

  await db.query(
    `
    INSERT INTO wallet_journal (

      id,
      owner_id,
      owner_type,
      ref_id,
      ref_table,
      entry_type,
      direction,
      amount,
      currency,
      note,
      metadata,
      event_hash,
      created_by,
      created_at

    )
    VALUES (

      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      'PI',
      $9,
      $10,
      $11,
      $12,
      NOW()
    )
    `,
    [
      randomUUID(),
      params.ownerId,
      params.ownerType,
      params.refId,
      params.refTable,
      params.entryType,
      params.direction,
      params.amount,
      params.note ?? null,

      JSON.stringify(
        params.metadata ?? {}
      ),
      params.eventHash ?? null,
      params.createdBy ?? null,
    ]
  );

  console.log(
    "[SETTLEMENT][JOURNAL] DONE",
    {
      ownerId: params.ownerId,
      refId: params.refId,
      entryType: params.entryType,
    }
  );

} catch (error) {
  console.error(
    "[SETTLEMENT][JOURNAL][INSERT_FAILED]",
    {
      ownerId: params.ownerId,
      refId: params.refId,
      entryType: params.entryType,
      eventHash: params.eventHash,
      metadata:
        params.metadata,
      error:
        error instanceof Error
          ? {
              message:
                error.message,
              stack:
                error.stack,
            }
          : error,
    }
  );
  throw error;
}
}
