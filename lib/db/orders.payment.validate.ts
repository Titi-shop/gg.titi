import { auditManualReview } from "@/lib/db/payments.audit";

import type { PoolClient } from "pg";

import type {
  RpcPayload,
  ShippingSnapshot,
  StrictPaymentValidationInput,
  ValidateFinalizePaymentInput,
  FinalizeValidationResult,
} from "./orders.payment.types";
function logValidation(
  event: string,
  payload: Record<string, unknown>
): void {
  console.log(
    `[PAYMENT][VALIDATE] ${event}`,
    payload
  );
}

function logValidationFail(
  event: string,
  payload: Record<string, unknown>
): void {
  console.error(
    `[PAYMENT][VALIDATE][FAIL] ${event}`,
    payload
  );
}
/* =========================================================
   HELPERS
========================================================= */

export function toNumber(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error("INVALID_NUMBER");
  }

  return parsed;
}

export function isSameAmount(
  left: number,
  right: number
): boolean {
  return Math.abs(left - right) < 0.0000001;
}

/* =========================================================
   SHIPPING SNAPSHOT
========================================================= */

type PricingSnapshotItem = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type PricingSnapshot = {
  subtotal: number;
  shipping_fee: number;
  total: number;
  items: PricingSnapshotItem[];
};

type ShippingSnapshotPayload = {
  buyer_shipping?: ShippingSnapshot;
  pricing_snapshot?: PricingSnapshot;
};

export function parseShippingSnapshot(
  rawSnapshot: unknown
): {
  shipping: ShippingSnapshot;
  pricing: PricingSnapshot;
} {
  const snapshot: ShippingSnapshotPayload =
    typeof rawSnapshot === "string"
      ? (JSON.parse(rawSnapshot) as ShippingSnapshotPayload)
      : (rawSnapshot as ShippingSnapshotPayload);

  const shipping =
    snapshot.buyer_shipping ??
    (snapshot as unknown as ShippingSnapshot);

  const pricing = snapshot.pricing_snapshot;

  if (!pricing) {
    throw new Error(
      "PRICING_SNAPSHOT_MISSING"
    );
  }

  return {
    shipping,
    pricing,
  };
}

/* =========================================================
   SHIPPING VALIDATION
========================================================= */

export async function validateShippingSnapshot(
  paymentIntentId: string,
  shipping: ShippingSnapshot,
  client: PoolClient
): Promise<void> {
  if (
    !shipping.name ||
    !shipping.phone ||
    !shipping.address_line
  ) {
    await auditManualReview(
      paymentIntentId,
      "INVALID_SHIPPING_SNAPSHOT",
      { shipping },
      client
    );

    throw new Error(
      "INVALID_SHIPPING_SNAPSHOT"
    );
  }
}

/* =========================================================
   RPC VALIDATION
========================================================= */

export async function validateRpcPayload(
  paymentIntentId: string,
  rpcPayload: RpcPayload,
  client: PoolClient
): Promise<void> {
  logValidation(
    "RPC_START",
    {
      paymentIntentId,
      confirmed:
        rpcPayload.confirmed,
      txStatus:
        rpcPayload.txStatus,
      ledger:
        rpcPayload.ledger,
      amount:
        rpcPayload.amount,
      receiver:
        rpcPayload.receiver,
      chainReference:
        rpcPayload.chainReference,
    }
  );

  if (!rpcPayload.confirmed) {
    logValidationFail(
      "RPC_NOT_CONFIRMED",
      {
        paymentIntentId,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "RPC_NOT_CONFIRMED",
      rpcPayload,
      client
    );

    throw new Error(
      "RPC_NOT_CONFIRMED"
    );
  }

  if (
    rpcPayload.txStatus !==
    "SUCCESS"
  ) {
    logValidationFail(
      "RPC_TX_FAILED",
      {
        paymentIntentId,
        txStatus:
          rpcPayload.txStatus,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "RPC_TX_FAILED",
      rpcPayload,
      client
    );

    throw new Error(
      "RPC_TX_FAILED"
    );
  }

  if (
    rpcPayload.reason &&
    rpcPayload.reason !== "NONE"
  ) {
    logValidationFail(
      "RPC_REASON_FAILED",
      {
        paymentIntentId,
        reason:
          rpcPayload.reason,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "RPC_REASON_FAILED",
      rpcPayload,
      client
    );

    throw new Error(
      "RPC_REASON_FAILED"
    );
  }

  if (!rpcPayload.ledger) {
    logValidationFail(
      "RPC_LEDGER_MISSING",
      {
        paymentIntentId,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "RPC_LEDGER_MISSING",
      rpcPayload,
      client
    );

    throw new Error(
      "RPC_LEDGER_MISSING"
    );
  }

  logValidation(
    "RPC_VALIDATED",
    {
      paymentIntentId,
      ledger:
        rpcPayload.ledger,
      txStatus:
        rpcPayload.txStatus,
    }
  );
}

/* =========================================================
   STRICT PAYMENT VALIDATION
========================================================= */

export async function validateStrictPayment(
  input: StrictPaymentValidationInput,
  client: PoolClient
): Promise<void> {
  const {
    paymentIntentId,
    expectedAmount,
    verifiedAmount,
    merchantWallet,
    receiverWallet,
    txid,
    rpcPayload,
  } = input;

  logValidation(
    "START",
    {
      paymentIntentId,
      expectedAmount,
      verifiedAmount,
      merchantWallet,
      receiverWallet,
      txid,
    }
  );

  if (
    !isSameAmount(
      expectedAmount,
      verifiedAmount
    )
  ) {
    logValidationFail(
      "AMOUNT_MISMATCH",
      {
        paymentIntentId,
        expectedAmount,
        verifiedAmount,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "AMOUNT_MISMATCH",
      {
        expectedAmount,
        verifiedAmount,
      },
      client
    );

    throw new Error(
      "AMOUNT_MISMATCH"
    );
  }

  logValidation(
    "AMOUNT_OK",
    {
      expectedAmount,
      verifiedAmount,
    }
  );

  if (
    merchantWallet
      .trim()
      .toLowerCase() !==
    receiverWallet
      .trim()
      .toLowerCase()
  ) {
    logValidationFail(
      "RECEIVER_MISMATCH",
      {
        paymentIntentId,
        expected:
          merchantWallet,
        got:
          receiverWallet,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "RECEIVER_MISMATCH",
      {
        expected:
          merchantWallet,
        got:
          receiverWallet,
      },
      client
    );

    throw new Error(
      "RECEIVER_MISMATCH"
    );
  }

  logValidation(
    "RECEIVER_OK",
    {
      receiverWallet,
    }
  );

  if (!txid) {
    logValidationFail(
      "TXID_MISSING",
      {
        paymentIntentId,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "TXID_MISSING",
      {},
      client
    );

    throw new Error(
      "TXID_MISSING"
    );
  }

  logValidation(
    "TXID_OK",
    {
      txid,
    }
  );

  if (
    rpcPayload.chainReference &&
    rpcPayload.chainReference !==
      txid
  ) {
    logValidationFail(
      "TXID_MISMATCH",
      {
        txid,
        chainReference:
          rpcPayload.chainReference,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "TXID_MISMATCH",
      {
        txid,
        chainReference:
          rpcPayload.chainReference,
      },
      client
    );

    throw new Error(
      "TXID_MISMATCH"
    );
  }

  logValidation(
    "CHAIN_REFERENCE_OK",
    {
      txid,
      chainReference:
        rpcPayload.chainReference,
    }
  );

  if (
    rpcPayload.amount != null &&
    !isSameAmount(
      expectedAmount,
      rpcPayload.amount
    )
  ) {
    logValidationFail(
      "RPC_AMOUNT_MISMATCH",
      {
        expectedAmount,
        rpcAmount:
          rpcPayload.amount,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "RPC_AMOUNT_MISMATCH",
      {
        expectedAmount,
        rpcAmount:
          rpcPayload.amount,
      },
      client
    );

    throw new Error(
      "RPC_AMOUNT_MISMATCH"
    );
  }

  if (
    rpcPayload.receiver &&
    rpcPayload.receiver
      .trim()
      .toLowerCase() !==
      merchantWallet
        .trim()
        .toLowerCase()
  ) {
    logValidationFail(
      "RPC_RECEIVER_MISMATCH",
      {
        expected:
          merchantWallet,
        rpcReceiver:
          rpcPayload.receiver,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "RPC_RECEIVER_MISMATCH",
      {
        expected:
          merchantWallet,
        rpcReceiver:
          rpcPayload.receiver,
      },
      client
    );

    throw new Error(
      "RPC_RECEIVER_MISMATCH"
    );
  }

  await validateRpcPayload(
    paymentIntentId,
    rpcPayload,
    client
  );

  logValidation(
    "PAYMENT_VALIDATED",
    {
      paymentIntentId,
      txid,
    }
  );
}
/* =========================================================
   FINALIZE VALIDATION
========================================================= */

export async function validateFinalizePayment(
  input: ValidateFinalizePaymentInput
): Promise<FinalizeValidationResult> {
  const {
    client,
    paymentIntentId,
    verifiedAmount,
    receiverWallet,
    txid,
    rpcPayload,
    intent,
  } = input;

  logValidation(
    "FINALIZE_START",
    {
      paymentIntentId,
      txid,
      verifiedAmount,
    }
  );

  const {
    shipping,
    pricing,
  } = parseShippingSnapshot(
    intent.shipping_snapshot
  );

  await validateShippingSnapshot(
    paymentIntentId,
    shipping,
    client
  );

  const expectedAmount =
    toNumber(
      intent.total_amount
    );

  const pricingTotal =
    Number(
      pricing.total
    );

  if (
    !isSameAmount(
      pricingTotal,
      expectedAmount
    )
  ) {
    logValidationFail(
      "PRICING_TOTAL_MISMATCH",
      {
        paymentIntentId,
        pricingTotal,
        expectedAmount,
      }
    );

    await auditManualReview(
      paymentIntentId,
      "PRICING_TOTAL_MISMATCH",
      {
        pricingTotal,
        expectedAmount,
      },
      client
    );

    throw new Error(
      "PRICING_TOTAL_MISMATCH"
    );
  }

  await validateStrictPayment(
    {
      paymentIntentId,

      expectedAmount,
      verifiedAmount,

      merchantWallet:
        intent.merchant_wallet,

      receiverWallet,

      txid,

      rpcPayload,
    },
    client
  );

  logValidation(
    "FINALIZE_OK",
    {
      paymentIntentId,
      expectedAmount,
      verifiedAmount,
    }
  );

  return {
    shipping,
    pricing,
    expectedAmount,
  };
}
