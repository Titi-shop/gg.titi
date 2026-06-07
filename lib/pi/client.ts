
/* =========================================================
   PI PLATFORM CLIENT
   Single source of truth for all Pi API communication
========================================================= */

const PI_API = process.env.PI_API_URL;
const PI_KEY = process.env.PI_API_KEY;

if (!PI_API) {
  throw new Error("MISSING_PI_API_URL");
}

if (!PI_KEY) {
  throw new Error("MISSING_PI_API_KEY");
}

/* =========================================================
   TYPES
========================================================= */

export type PiUserMe = {
  uid: string;
  username?: string;
};

export type PiPaymentStatus = {
  developer_approved?: boolean;
  transaction_verified?: boolean;
  developer_completed?: boolean;
  cancelled?: boolean;
  user_cancelled?: boolean;
};

export type PiPaymentTransaction = {
  txid?: string;
  verified?: boolean;
  _link?: string;
};

export type PiPaymentData = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  from_address: string;
  to_address: string;
  status?: PiPaymentStatus;
  metadata?: Record<string, unknown>;
  transaction?: PiPaymentTransaction;
};

/* =========================================================
   INTERNAL REQUEST
========================================================= */

async function piRequest<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const res = await fetch(`${PI_API}${path}`, {
    ...init,
    cache: "no-store",
  });

  const text = await res.text();

  let json: unknown = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("PI_INVALID_JSON");
  }

  if (!res.ok) {
    console.error("🔥 [PI CLIENT] HTTP_FAIL", {
      path,
      status: res.status,
      body: json,
    });

    throw new Error(`PI_HTTP_${res.status}`);
  }

  return json as T;
}

/* =========================================================
   VERIFY PI USER TOKEN
========================================================= */

export async function piGetMe(bearerToken: string): Promise<PiUserMe> {
  const token = bearerToken.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("MISSING_PI_BEARER");
  }

  const data = await piRequest<PiUserMe>("/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!data?.uid) {
    throw new Error("INVALID_PI_USER");
  }

  console.log("🟢 [PI CLIENT] ME_OK", data.uid);

  return data;
}

/* =========================================================
   FETCH PAYMENT
========================================================= */

export async function piGetPayment(
  piPaymentId: string
): Promise<PiPaymentData> {
  const id = String(piPaymentId || "").trim();

  if (!id) {
    throw new Error("MISSING_PI_PAYMENT_ID");
  }

  const data = await piRequest<PiPaymentData>(`/payments/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Key ${PI_KEY}`,
    },
  });

  if (!data?.identifier) {
    throw new Error("PI_PAYMENT_FETCH_FAILED");
  }

  console.log("🟢 [PI CLIENT] PAYMENT_OK", {
    paymentId: data.identifier,
    amount: data.amount,
  });

  return data;
}

/* =========================================================
   APPROVE PAYMENT
========================================================= */

export async function piApprovePayment(
  piPaymentId: string
): Promise<{ success: true }> {
  const id = String(piPaymentId || "").trim();

  if (!id) {
    throw new Error("MISSING_PI_PAYMENT_ID");
  }

  await piRequest<unknown>(`/payments/${id}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  console.log("🟢 [PI CLIENT] APPROVE_OK", id);

  return { success: true };
}

/* =========================================================
   COMPLETE PAYMENT
========================================================= */

export async function piCompletePayment(
  piPaymentId: string,
  txid: string
): Promise<{ success: true }> {
  const id = String(piPaymentId || "").trim();
  const tx = String(txid || "").trim();

  if (!id) {
    throw new Error("MISSING_PI_PAYMENT_ID");
  }

  if (!tx) {
    throw new Error("MISSING_TXID");
  }

  const res = await fetch(`${PI_API}/payments/${id}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Key ${PI_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ txid: tx }),
  });

  const text = await res.text();

  if (!res.ok) {
    if (text.includes("already_completed")) {
      console.log("[PI CLIENT] COMPLETE_ALREADY_DONE", id);
      return { success: true };
    }

    console.error("[PI CLIENT] COMPLETE_FAIL", {
      status: res.status,
    });

    throw new Error("PI_COMPLETE_FAILED");
  }

  console.log("[PI CLIENT] COMPLETE_OK", id);

  return { success: true };
}
