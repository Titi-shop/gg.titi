// =====================================================
// app/account/wallet/wallet.constants.ts
// =====================================================
import type {
  JournalEntryType,
} from "@/lib/db/wallet/wallet.types";
/* =====================================================
   LABELS
===================================================== */
export const ENTRY_LABELS:
  Record<
    JournalEntryType,
    string
  > = {
  ESCROW_HOLD:
    "Escrow Hold",
  BUYER_REFUND:
    "Buyer Refund",
  SELLER_CREDIT:
    "Seller Credit",
  SELLER_ESCROW_RELEASE:
    "Escrow Released",
  SELLER_WITHDRAW:
    "Withdraw",
  SYSTEM_COMPENSATION:
    "System Compensation",
};
/* =====================================================
   SWR
===================================================== */
export const WALLET_SWR_CONFIG = {
  revalidateOnFocus:
    false,
  revalidateIfStale:
    false,
  revalidateOnReconnect:
    true,
  dedupingInterval:
    15000,
  keepPreviousData:
    true,
};
