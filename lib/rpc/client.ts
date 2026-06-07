const PI_RPC_URL =
  process.env.PI_RPC_URL?.trim() ||
  "https://rpc.testnet.minepi.com";

import type {
  ParsedRpcTransaction,
} from "@/lib/payments/types/rpc.types";

import type {
  RpcEnvelope,
  JsonObj,
} from "@/lib/rpc/rpc.internal.types";
/* =========================================================
   LOG
========================================================= */

function log(tag: string, data?: unknown) {
  console.log(`[RPC CLIENT V6] ${tag}`, data ?? "");
}

function err(tag: string, data?: unknown) {
  console.error(`[RPC CLIENT V6] ${tag}`, data ?? "");
}

/* =========================================================
   HELPERS
========================================================= */

function asObj(value: unknown): JsonObj {
  return typeof value === "object" && value !== null
    ? (value as JsonObj)
    : {};
}

function asArr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === "string"
    ? value.trim()
    : null;
}

function num(value: unknown): number | null {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

function deepFindString(
  node: unknown,
  keys: string[]
): string | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = deepFindString(item, keys);

      if (found) {
        return found;
      }
    }

    return null;
  }

  const obj = node as JsonObj;

  for (const key of keys) {
    const value = obj[key];

    if (typeof value === "string") {
      const cleaned = value.trim();

      if (cleaned) {
        return cleaned;
      }
    }
  }

  for (const value of Object.values(obj)) {
    const found = deepFindString(value, keys);

    if (found) {
      return found;
    }
  }

  return null;
}

function deepFindNumber(
  node: unknown,
  keys: string[]
): number | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = deepFindNumber(item, keys);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  const obj = node as JsonObj;

  for (const key of keys) {
    const parsed = num(obj[key]);

    if (parsed !== null) {
      return parsed;
    }
  }

  for (const value of Object.values(obj)) {
    const found = deepFindNumber(value, keys);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

function normalizeAmount(amount: number | null): number | null {
  if (amount === null) return null;

  // detect stroop format
  if (amount > 1_000_000) {
    return amount / 10_000_000;
  }

  return amount;
}

/* =========================================================
   RPC CALL
========================================================= */

async function rpcCall(
  method: string,
  params: Record<string, unknown>
): Promise<JsonObj> {
  log("RPC_CALL_START", {
    method,
    params,
  });

  let response: Response;

  try {
    response = await fetch(PI_RPC_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      cache: "no-store",

      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });
  } catch (e) {
    err("RPC_NETWORK_FAIL", e);

    throw new Error("RPC_UNREACHABLE");
  }

  const rawText = await response.text();

  let parsed: RpcEnvelope;

  try {
    parsed = JSON.parse(rawText) as RpcEnvelope;
  } catch {
    err("RPC_INVALID_JSON", rawText);

    throw new Error("RPC_INVALID_JSON");
  }

  if (!response.ok) {
    err("RPC_HTTP_FAIL", {
      status: response.status,
    });

    throw new Error(`RPC_HTTP_${response.status}`);
  }

  if (parsed.error) {
    err("RPC_METHOD_FAIL", parsed.error);

    throw new Error("RPC_ERROR");
  }

  if (!parsed.result) {
    err("RPC_EMPTY_RESULT");

    throw new Error("RPC_EMPTY_RESULT");
  }

  log("RPC_CALL_OK");

  return parsed.result;
}

/* =========================================================
   PARSE ENVELOPE
========================================================= */

function parseFromEnvelopeJson(
  result: JsonObj
): {
  amount: number | null;
  sender: string | null;
  receiver: string | null;
} {
  const sender =
    deepFindString(result, [
      "sourceAccount",
      "source_account",
      "from",
      "from_address",
      "account_id",
    ]) ?? null;

  const receiver =
    deepFindString(result, [
      "destination",
      "to",
      "to_address",
      "toAccount",
    ]) ?? null;

  const amount = normalizeAmount(
    deepFindNumber(result, [
      "amount",
      "sendAmount",
      "value",
      "i128",
    ])
  );

  return {
    amount,
    sender,
    receiver,
  };
}

/* =========================================================
   PARSE EVENTS
========================================================= */

function parseFromEvents(
  result: JsonObj
): {
  amount: number | null;
  sender: string | null;
  receiver: string | null;
} {
  const events = asObj(result.events);

  const txEvents = asArr(
    events.transactionEventsJson
  );

  const contractEvents = asArr(
    events.contractEventsJson
  );

  const sender =
    deepFindString(txEvents, [
      "from",
      "source",
      "address",
    ]) ??
    deepFindString(contractEvents, [
      "from",
      "source",
      "address",
    ]) ??
    null;

  const receiver =
    deepFindString(contractEvents, [
      "destination",
      "to",
      "address",
    ]) ?? null;

  const amount = normalizeAmount(
    deepFindNumber(contractEvents, [
      "amount",
      "value",
      "i128",
    ])
  );

  return {
    amount,
    sender,
    receiver,
  };
}

/* =========================================================
   MAIN
========================================================= */

export async function getRpcTransaction(
  txid: string
): Promise<ParsedRpcTransaction> {
  const clean = txid.trim();

  log("GET_TX_START", {
    txid: clean,
  });

  if (!clean) {
    throw new Error("RPC_TXID_REQUIRED");
  }

  try {
    const result = await rpcCall(
      "getTransaction",
      {
        hash: clean,
        xdrFormat: "json",
      }
    );

    const ledger = num(result.ledger);

    const status =
      str(result.status) ??
      str(result.txStatus) ??
      null;

    const confirmed =
      status === "SUCCESS" ||
      status === "FAILED" ||
      ledger !== null;

    /* =====================================================
       ENVELOPE
    ===================================================== */

    const envelopeJson = asObj(
      result.envelopeJson
    );

    const envelopeTx = asObj(
      envelopeJson.tx
    );

    const innerTx = asObj(
      envelopeTx.tx
    );

    const memoObj = asObj(
      innerTx.memo
    );

    /* =====================================================
       MEMO
    ===================================================== */

    const memo =
      str(memoObj.text) ??
      str(memoObj.id) ??
      str(memoObj.hash) ??
      null;

    /* =====================================================
       CREATED AT
    ===================================================== */

    const createdAt =
      str(result.createdAt) ??
      str(result.created_at) ??
      str(result.created) ??
      null;

    /* =====================================================
       PARSING
    ===================================================== */

    let amount: number | null = null;

    let sender: string | null = null;

    let receiver: string | null = null;

    let parseLayer = "NONE";

    /* ===== LAYER A ===== */

    const parsedEnvelope =
      parseFromEnvelopeJson(result);

    if (
      parsedEnvelope.amount !== null ||
      parsedEnvelope.sender ||
      parsedEnvelope.receiver
    ) {
      amount = parsedEnvelope.amount;

      sender = parsedEnvelope.sender;

      receiver = parsedEnvelope.receiver;

      parseLayer = "ENVELOPE_JSON";
    }

    /* ===== LAYER B ===== */

    if (
      amount === null &&
      !sender &&
      !receiver
    ) {
      const parsedEvents =
        parseFromEvents(result);

      if (
        parsedEvents.amount !== null ||
        parsedEvents.sender ||
        parsedEvents.receiver
      ) {
        amount = parsedEvents.amount;

        sender = parsedEvents.sender;

        receiver = parsedEvents.receiver;

        parseLayer = "EVENTS";
      }
    }

    log("PARSE_RESULT", {
      txid: clean,
      amount,
      sender,
      receiver,
      ledger,
      confirmed,
      memo,
      parseLayer,
    });

    return {
      hash:
        str(result.txHash) ?? clean,
      ledger,
      amount,
      sender,
      receiver,
      memo,
      createdAt,
      txStatus:
        status ??
        (confirmed
          ? "SUCCESS"
          : "UNKNOWN"),

      confirmed,
      rpcReachable: true,
      raw: result,
      debug: {
        amountFound:
          amount !== null,
        senderFound:
          !!sender,
        receiverFound:
          !!receiver,
        parseLayer,
        hasMeta:
          !!result.resultMetaJson ||
          !!result.resultMetaXdr,

        hasEvents:
          !!result.events,
      },
    };
  } catch (e) {
    err("GET_TX_FAIL", e);

    return {
      hash: clean,
      ledger: null,
      amount: null,
      sender: null,
      receiver: null,
      memo: null,
      createdAt: null,
      txStatus: null,
      confirmed: false,
      rpcReachable: false,
      raw: {},
      debug: {
        amountFound: false,
        senderFound: false,
        receiverFound: false,
        parseLayer: "FAIL",
        hasMeta: false,
        hasEvents: false,
      },
    };
  }
}
