// =====================================================
// lib/pi/pi.a2u.ts
// =====================================================
import {
  verifyA2UWithdrawal,
} from "@/lib/payments/a2u.rpc.verify";

import {
  markWithdrawalCompleted,
  getWalletWithdrawalById,
  markWithdrawalProcessing,
  markWithdrawalFailed,
} from "@/lib/db/wallet/wallet.withdraw";
import {
  getVerifiedRpcByWithdrawalId,
} from "@/lib/db/payments.rpc.a2u";
import {
  getUserById,
} from "@/lib/db/users";
import * as StellarSdk
  from "@stellar/stellar-sdk";
const PI_API =
  process.env.PI_API_URL;

const PI_KEY =
  process.env.PI_API_KEY;

function vlog(
  step: string,
  data?: unknown
) {
  console.log(
    `[PI_A2U][${step}]`,
    data ?? ""
  );
}

if (!PI_API) {
  throw new Error(
    "MISSING_PI_API_URL"
  );
}

if (!PI_KEY) {
  throw new Error(
    "MISSING_PI_API_KEY"
  );
}
const PI_SEED =
  process.env
    .PI_WALLET_PRIVATE_SEED;
if (!PI_SEED) {
  throw new Error(
    "MISSING_PI_WALLET_PRIVATE_SEED"
  );
}
vlog(
  "ENV_CHECK",
  {
    hasApiUrl:
      !!PI_API,
    hasApiKey:
      !!PI_KEY,
    hasWalletSeed:
      !!PI_SEED,
    apiUrl:
      PI_API,
  }
);
/* =====================================================
   TYPES
===================================================== */

export type CreateA2UPaymentInput =
  {
    uid: string;
    amount: number;
    memo: string;
    metadata: Record<
      string,
      unknown
    >;
  };

export type A2UPayment =
  {
    identifier: string;
    user_uid: string;
    amount: number;
    memo: string;
    network?: string;
    metadata?: Record<
      string,
      unknown
    >;

    from_address?: string;
    to_address?: string;

    status?: {
      developer_approved?: boolean;
      transaction_verified?: boolean;
      developer_completed?: boolean;
      cancelled?: boolean;
      user_cancelled?: boolean;
    };

    transaction?: {
      txid?: string;
      verified?: boolean;
      _link?: string;
    };
  };
export type A2USubmitResult = {
  txid: string;
  ledger: number | null;
  memo: string | null;
  fee: string | null;
  fromAddress?: string;
  toAddress?: string;
  network?: string;
};
/* =====================================================
   INTERNAL REQUEST
===================================================== */

async function piRequest<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  vlog(
    "REQUEST_START",
    {
      path,
      method:
        init.method,
    }
  );

  const res = await fetch(
    `${PI_API}${path}`,
    {
      ...init,
      cache:
        "no-store",
    }
  );

  const text =
    await res.text();

  let json:
    | unknown
    | null =
    null;

  try {
    json = text
      ? JSON.parse(
          text
        )
      : null;
  } catch {
    throw new Error(
      "PI_INVALID_JSON"
    );
  }

  vlog(
    "REQUEST_RESPONSE",
    {
      status:
        res.status,
    }
  );

  if (!res.ok) {
    console.error(
      "[PI_A2U][HTTP_FAIL]",
      {
        path,
        status:
          res.status,
        body: json,
      }
    );

    throw new Error(
      `PI_HTTP_${res.status}`
    );
  }

  return json as T;
}

/* =====================================================
   CREATE PAYMENT
===================================================== */

export async function createA2UPayment(
  input: CreateA2UPaymentInput
): Promise<string> {
  vlog(
    "CREATE_START",
    input
  );

  const data =
    await piRequest<A2UPayment>(
      "/v2/payments",
      {
        method: "POST",

        headers: {
          Authorization:
            `Key ${PI_KEY}`,
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            {
              payment:
                {
                  uid:
                    input.uid,
                  amount:
                    input.amount,
                  memo:
                    input.memo,
                  metadata:
                    input.metadata,
                },
            }
          ),
      }
    );

  if (
    !data?.identifier
  ) {
    throw new Error(
      "A2U_CREATE_FAILED"
    );
  }

  vlog(
    "CREATE_SUCCESS",
    {
      paymentId:
        data.identifier,
    }
  );

  return data.identifier;
}

/* =====================================================
   GET PAYMENT
===================================================== */

export async function getA2UPayment(
  paymentId: string
): Promise<A2UPayment> {
  vlog(
    "GET_START",
    paymentId
  );

  const data =
    await piRequest<A2UPayment>(
      `/v2/payments/${paymentId}`,
      {
        method: "GET",

        headers: {
          Authorization:
            `Key ${PI_KEY}`,
        },
      }
    );

  vlog(
    "GET_SUCCESS",
    {
      paymentId:
        data.identifier,
    }
  );

  return data;
}

/* =====================================================
   COMPLETE PAYMENT
===================================================== */

export async function completeA2UPayment(
  paymentId: string,
  txid: string
): Promise<void> {
  vlog(
    "COMPLETE_START",
    {
      paymentId,
      txid,
    }
  );

  await piRequest(
    `/v2/payments/${paymentId}/complete`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Key ${PI_KEY}`,
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(
          {
            txid,
          }
        ),
    }
  );

  vlog(
    "COMPLETE_SUCCESS",
    {
      paymentId,
    }
  );
}
/* =====================================================
   SUBMIT PAYMENT
===================================================== */

export async function submitA2UPayment(
  withdrawalId: string,
  paymentId: string
): Promise<A2USubmitResult> {

  vlog(
    "SUBMIT_START",
    { paymentId }
  );

  const payment =
    await getA2UPayment(
      paymentId
    );

  vlog(
    "SUBMIT_PAYMENT",
    payment
  );

  if (
  payment.transaction?.txid
) {
  vlog(
    "SUBMIT_ALREADY_EXISTS",
    {
      txid:
        payment.transaction.txid,
    }
  );

  return {
  txid:
    payment.transaction.txid,
  ledger: null,
  memo:
    payment.memo ?? null,
  fee: null,
  fromAddress:
    payment.from_address,
  toAddress:
    payment.to_address,
  network:
    payment.network ??
    "Pi Testnet",
};
}

  const keypair =
    StellarSdk.Keypair.fromSecret(
      PI_SEED
    );

  vlog(
    "WALLET_PUBLIC",
    keypair.publicKey()
  );

  const server =
    new StellarSdk.Horizon.Server(
      "https://api.testnet.minepi.com"
    );

  const account =
    await server.loadAccount(
      keypair.publicKey()
    );

  vlog(
    "ACCOUNT_LOADED",
    {
      accountId:
        account.accountId(),
    }
  );

  const fee =
    await server.fetchBaseFee();

  vlog(
    "BASE_FEE",
    fee
  );

  const tx =
    new StellarSdk.TransactionBuilder(
      account,
      {
        fee:
          fee.toString(),
        networkPassphrase:
          "Pi Testnet",
      }
    )
      .addOperation(
        StellarSdk.Operation.payment(
          {
            destination:
              payment.to_address!,
            asset:
              StellarSdk.Asset.native(),
            amount:
              String(
                payment.amount
              ),
          }
        )
      )
      .addMemo(
        StellarSdk.Memo.text(
          payment.identifier
        )
      )
      .setTimeout(
        180
      )
      .build();

  tx.sign(
    keypair
  );

  vlog(
    "TX_SIGNED"
  );

  const submitResult =
    await server.submitTransaction(
      tx
    );

  vlog(
    "TX_SUBMITTED",
    submitResult
  );

const txid =
  String(
    submitResult.id
  );
await verifyA2UWithdrawal(withdrawalId, txid);

const verifiedLog =
  await getVerifiedRpcByWithdrawalId(withdrawalId);

if (!verifiedLog) {
  throw new Error("RPC_LOG_NOT_FOUND");
}

await markWithdrawalCompleted(withdrawalId);

const completed =
  await getWalletWithdrawalById(withdrawalId);

if (!completed?.blockchain_txid) {
  throw new Error("WITHDRAWAL_COMPLETE_FAILED");
}

return {
  txid: completed.blockchain_txid,
  ledger: completed.blockchain_ledger,
  memo: completed.blockchain_memo,
  fromAddress: completed.blockchain_from_address,
  toAddress: completed.blockchain_to_address,
  network: completed.blockchain_network,
  fee: null,
};
}
/* =====================================================
   CANCEL PAYMENT
===================================================== */

export async function cancelA2UPayment(
  paymentId: string
): Promise<void> {
  vlog(
    "CANCEL_START",
    {
      paymentId,
    }
  );

  await piRequest(
    `/v2/payments/${paymentId}/cancel`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Key ${PI_KEY}`,
      },
    }
  );

  vlog(
    "CANCEL_SUCCESS",
    {
      paymentId,
    }
  );
}
/* =====================================================
   DEBUG PAYMENT
===================================================== */

export async function debugA2UPayment(
  paymentId: string
): Promise<A2UPayment> {

  vlog(
    "DEBUG_PAYMENT_START",
    paymentId
  );

  const payment =
    await getA2UPayment(
      paymentId
    );

  vlog(
    "DEBUG_PAYMENT_RESULT",
    JSON.stringify(
      payment,
      null,
      2
    )
  );

  return payment;
}
export async function payWithdrawal(
  withdrawalId: string
) {
  let processingStarted =
    false;

  try {
    const withdrawal =
      await getWalletWithdrawalById(
        withdrawalId
      );

    if (!withdrawal) {
      throw new Error(
        "WITHDRAWAL_NOT_FOUND"
      );
    }

    if (
      withdrawal.status ===
      "PROCESSING"
    ) {
      throw new Error(
        "WITHDRAWAL_ALREADY_PROCESSING"
      );
    }

    if (
      withdrawal.status ===
      "COMPLETED"
    ) {
      throw new Error(
        "WITHDRAWAL_ALREADY_COMPLETED"
      );
    }

    if (
      ![
        "APPROVED",
        "FAILED",
      ].includes(
        withdrawal.status
      )
    ) {
      throw new Error(
        "INVALID_STATUS"
      );
    }

    const user =
      await getUserById(
        withdrawal.user_id
      );

    if (!user?.pi_uid) {
      throw new Error(
        "USER_PI_UID_MISSING"
      );
    }

    const piPaymentId =
      await createA2UPayment({
        uid: user.pi_uid,
        amount: Number(
          withdrawal.amount
        ),
        memo:
          `Withdraw ${withdrawal.id}`,
        metadata: {
          withdrawal_id:
            withdrawal.id,
        },
      });

    await markWithdrawalProcessing(
      withdrawal.id,
      piPaymentId,
      `Withdraw ${withdrawal.id}`,
      user.pi_uid
    );

    processingStarted =
      true;

    const tx =
      await submitA2UPayment(
        withdrawal.id,
        piPaymentId
      );

    await completeA2UPayment(
      piPaymentId,
      tx.txid
    );

    return {
      withdrawalId:
        withdrawal.id,
      piPaymentId,
      txid: tx.txid,
    };
  }
  catch (error) {
  const originalError = error;

  if (processingStarted) {
    try {
      await markWithdrawalFailed(
        withdrawalId,
        originalError instanceof Error
          ? originalError.message
          : String(originalError)
      );
    } catch (rollbackError) {
      console.error(
        "[ROLLBACK_FAILED]",
        rollbackError
      );
    }
  }

  throw originalError;
}
}
