// =====================================================
// app/account/wallet/wallet.api.ts
// =====================================================
import {
  apiAuthFetch,
} from "@/lib/api/apiAuthFetch";
import type {
  JournalDirection,
  JournalEntryType,
} from "@/lib/db/wallet/wallet.types";
import {
  toSafeNumber,
} from "./wallet.utils";
/* =====================================================
   TYPES
===================================================== */
export type WalletTransaction =
  {
    id: string;
    direction:
      JournalDirection;
    amount: number;
    entry_type:
      JournalEntryType;
    created_at: string;
  };
export type WalletResponse =
  {
    balance: number;
    transactions:
      WalletTransaction[];
  };
/* =====================================================
   FETCH WALLET
===================================================== */
export async function fetchWallet():
  Promise<WalletResponse> {
  const response =
    await apiAuthFetch(
      "/api/wallet",
      {
        cache:
          "no-store",
      }
    );
  if (!response.ok) {

  return {
    balance: 0,
    transactions: [],
  };
}
  const json:
    unknown =
      await response.json();
  if (
    typeof json !==
      "object" ||
    json === null
  ) {
    throw new Error(
      "INVALID_WALLET_RESPONSE"
    );
  }
  const data =
    json as Record<
      string,
      unknown
    >;
  const transactions =
    Array.isArray(
      data.transactions
    )
      ? data.transactions
          .map(
            (
              item
            ) => {
              if (
                typeof item !==
                  "object" ||
                item === null
              ) {
                return null;
              }
              const tx =
                item as Record<
                  string,
                  unknown
                >;
              return {
                id:
                  String(
                    tx.id ??
                      ""
                  ),
                direction:
                  tx.direction ===
                  "DEBIT"
                    ? "DEBIT"
                    : "CREDIT",
                amount:
                  toSafeNumber(
                    tx.amount
                  ),
                entry_type:
                  String(
                    tx.entry_type
                  ) as JournalEntryType,
                created_at:
                  String(
                    tx.created_at ??
                      ""
                  ),
              };
            }
          )
          .filter(
            (
              item
            ): item is WalletTransaction =>
              item !==
              null
          )
      : [];
  return {
    balance:
      toSafeNumber(
        data.balance
      ),
    transactions,
  };
}
