import type {
  PaymentIdentity,
  SettlementState,
} from "./common.types";

import type {
  RpcAuditResult,
} from "./rpc.types";

/* =========================================================
   LEDGER GRAPH
========================================================= */

export type LedgerIdentity = {
  escrowId: string;
  ledgerId?: string;
  chainTxid?: string;
};

/* =========================================================
   FULL TRACE OBJECT
========================================================= */

export type PaymentTrace = {
  identity: PaymentIdentity;

  pi: {
    verified: boolean;
    payload?: unknown;
  };

  rpc: {
    verified: boolean;
    payload?: RpcAuditResult;
  };

  settlement: {
    state: SettlementState;
    escrowId?: string;
    orderId?: string;
  };
};
