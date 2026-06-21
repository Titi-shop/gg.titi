// =====================================================
// lib/db/wallet/wallet.ensure.ts
// =====================================================

import {
  query,
} from "@/lib/db";

import type {
  WalletClient,
} from "./wallet.types";

function getDb(
  client?: WalletClient
) {
  return client ?? { query };
}

export async function ensureWallet(
  userId: string,
  client?: WalletClient
): Promise<void> {

  const db =
    getDb(client);

  await db.query(
    `
    INSERT INTO wallets (

      user_id,

      balance,
      available_balance,
      pending_balance,
      frozen_balance,

      wallet_version,

      created_at,
      updated_at

    )
    VALUES (

      $1,

      0,
      0,
      0,
      0,

      1,

      NOW(),
      NOW()
    )

    ON CONFLICT (user_id)
    DO NOTHING
    `,
    [userId]
  );
}
