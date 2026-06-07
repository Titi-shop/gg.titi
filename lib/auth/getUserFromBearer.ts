import { headers } from "next/headers";
import { getUserIdByPiUid } from "@/lib/db/users";

type AuthUser = {
  userId: string;
};

type PiApiUser = {
  uid: string;
  username: string;
  wallet_address?: string | null;
};

function isPiApiUser(data: unknown): data is PiApiUser {
  if (typeof data !== "object" || data === null) return false;

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.uid === "string" &&
    typeof obj.username === "string" &&
    ("wallet_address" in obj
      ? typeof obj.wallet_address === "string" || obj.wallet_address === null
      : true)
  );
}

// 🔥 cache token → userId
const tokenCache = new Map<
  string,
  { userId: string; exp: number }
>();

export async function getUserFromBearer(): Promise<AuthUser | null> {
  try {
    const authHeader = headers().get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) return null;

    // ✅ cache trước
    const cached = tokenCache.get(accessToken);
    if (cached && cached.exp > Date.now()) {
      return { userId: cached.userId };
    }

    // ✅ gọi Pi API
    const res = await fetch("https://api.minepi.com/v2/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("Pi token invalid:", res.status);
      return null;
    }

    const raw: unknown = await res.json();

    if (!isPiApiUser(raw)) {
      console.warn("Invalid Pi API response:", raw);
      return null;
    }

    const pi_uid = raw.uid;

    // ✅ convert → UUID
    const userId = await getUserIdByPiUid(pi_uid);
    if (!userId) return null;

    // ✅ cache 60s
    tokenCache.set(accessToken, {
      userId,
      exp: Date.now() + 60_000,
    });

    if (tokenCache.size > 1000) {
      tokenCache.clear();
    }

    return { userId };

  } catch (err) {
    console.error("AUTH_ERROR getUserFromBearer:", err);
    return null;
  }
}
