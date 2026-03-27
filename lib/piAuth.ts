/* =========================================================
   Pi Auth Utility
   - Client: get accessToken từ Pi Browser
   - Server: verify accessToken với Pi API
   Architecture:
   NETWORK-FIRST + AUTH-CENTRIC
========================================================= */

const PI_API_URL = process.env.PI_API_URL ?? "https://api.minepi.com/v2";

let cachedToken: string | null = null;
let authPromise: Promise<string> | null = null;

/* =========================================================
   PI TYPES
========================================================= */

export type PiUser = {
  pi_uid: string;
  username: string;
};

type PiAuthResult = {
  accessToken: string;
  user?: {
    uid: string;
    username: string;
  };
};

type PiBrowser = {
  authenticate(
    scopes: string[],
    onIncompletePaymentFound: (payment: unknown) => void
  ): Promise<PiAuthResult>;
};

declare global {
  interface Window {
    Pi?: PiBrowser;
  }
}

/* =========================================================
   CLIENT: GET PI ACCESS TOKEN
========================================================= */

export async function getPiAccessToken(
  forceRefresh = false
): Promise<string> {

  if (!forceRefresh && cachedToken) {
    return cachedToken;
  }

  if (authPromise) {
    return authPromise;
  }

  if (typeof window === "undefined") {
    throw new Error("PI_BROWSER_REQUIRED");
  }

  if (!window.Pi) {
    throw new Error("PI_SDK_NOT_AVAILABLE");
  }

  const scopes = ["username", "payments"];

  authPromise = (async () => {
    try {

      const auth = await window.Pi.authenticate(
        scopes,
        () => {}
      );

      if (!auth || !auth.accessToken) {
        throw new Error("PI_AUTH_FAILED");
      }

      cachedToken = auth.accessToken;

      return cachedToken;

    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

/* =========================================================
   SERVER: VERIFY PI TOKEN
========================================================= */

export async function verifyPiToken(
  token: string
): Promise<PiUser> {

export async function verifyPiToken(
  token: string
): Promise<PiUser> {

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const res = await fetch(
    `${PI_API_URL}/me`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error("PI_TOKEN_INVALID");
  }

  const data = (await res.json()) as {
    uid?: string;
    username?: string;
  };

  if (!data.uid || !data.username) {
    throw new Error("PI_USER_INVALID");
  }

  return {
    pi_uid: data.uid,
    username: data.username,
  };
}


/* =========================================================
   SERVER: GET PI USER FROM REQUEST TOKEN
========================================================= */

export async function getPiUserFromToken(
  req: Request
): Promise<PiUser | null> {

  const auth = req.headers.get("authorization");

  if (!auth || !auth.startsWith("Bearer ")) {
    return null;
  }

  const token = auth.replace("Bearer ", "").trim();

  try {
    return await verifyPiToken(token);
  } catch {
    return null;
  }
}
/* =========================================================
   CLEAR TOKEN (LOGOUT)
========================================================= */

export function clearPiToken(): void {
  cachedToken = null;
}
