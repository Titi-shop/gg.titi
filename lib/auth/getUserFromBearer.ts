import { headers } from "next/headers";
import { getUserIdByPiUid } from "@/lib/db/users";

type AuthUser = {
  userId: string; // UUID ONLY
};

// 🔥 In-memory cache (token → userId)
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

    // ✅ 1. CHECK CACHE TRƯỚC
    const cached = tokenCache.get(accessToken);
    if (cached && cached.exp > Date.now()) {
      return { userId: cached.userId };
    }

    // ✅ 2. GỌI PI API
    const response = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data?.uid) return null;

    const pi_uid = String(data.uid);

    // ✅ 3. CONVERT → UUID
    const userId = await getUserIdByPiUid(pi_uid);
    if (!userId) return null;

    // ✅ 4. CACHE LẠI (60s)
    tokenCache.set(accessToken, {
      userId,
      exp: Date.now() + 60_000,
    });

    return { userId };

  } catch (err) {
    console.error("AUTH_ERROR getUserFromBearer:", err);
    return null;
  }
}
