// =====================================================
// lib/db/wallet/wallet.types.ts
// =====================================================

export type WalletRow = {
  balance: string;
  available_balance?: string;
  pending_balance?: string;
  frozen_balance?: string;
};

export type OrderRow = {
  total_amount: string;
  status: string;
};

export type JournalDirection =
  | "CREDIT"
  | "DEBIT";

export type JournalEntryType =
  | "ESCROW_HOLD"
  | "BUYER_REFUND"
  | "BUYER_PARTIAL_REFUND"
  | "SELLER_CREDIT"
  | "SELLER_ESCROW_RELEASE"
  | "SELLER_WITHDRAW"
  | "SELLER_WITHDRAW_REVERT"
  | "ESCROW_RELEASE"
  | "ESCROW_REVERT"
  | "DISPUTE_LOCK"
  | "DISPUTE_RELEASE"
  | "DISPUTE_REFUND"
  | "ADMIN_ADJUST"
  | "ADMIN_REVERSE"
  | "SYSTEM_COMPENSATION";

export type WalletOwnerType =
  | "BUYER"
  | "SELLER"
  | "SYSTEM"
  | "ADMIN";

export type WalletClient = {
  query: <T>(
    sql: string,
    params?: unknown[]
  ) => Promise<{
    rows: T[];
    rowCount?: number | null;
  }>;
};

export type EnsureWalletInput = {
  client?: WalletClient;
  userId: string;
};

export type CreditWalletInput = {
  client?: WalletClient;
  userId: string;
  amount: number;
};

export type DebitWalletInput = {
  client?: WalletClient;
  userId: string;
  amount: number;
};

export type WalletJournalInput = {
  client?: WalletClient;

  ownerId: string;

  ownerType:
    WalletOwnerType;

  refId?: string | null;

  refTable?: string | null;

  entryType:
    JournalEntryType;

  direction:
    JournalDirection;

  amount: number;

  note?: string;

  metadata?: Record<
    string,
    unknown
  >;

  eventHash?: string | null;

  createdBy?: string | null;
};

export type PayWithWalletInput = {
  userId: string;
  orderId: string;
};
export type WalletTransaction = {
  id: string;

  direction:
    JournalDirection;

  amount: number;

  entry_type:
    JournalEntryType;

  created_at: string;
};

export type WalletApiResponse = {
  balance: number;
  transactions:
    WalletTransaction[];
};

export type WalletWithdrawalStatus =
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "CANCELLED";

export type CreateWalletWithdrawalInput = {
  client?: WalletClient;

  userId: string;

  amount: number;

  withdrawWallet: string;
};

export type WalletWithdrawalRow = {
  id: string;

  user_id: string;

  amount: string;

  currency: string;

  withdraw_wallet: string;

  txid?: string | null;

  status:
    WalletWithdrawalStatus;

  requested_at: string;

  completed_at?: string | null;

  fail_reason?: string | null;
};
