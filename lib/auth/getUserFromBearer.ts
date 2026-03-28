import { headers } from "next/headers";
import { getUserIdByPiUid } from "@/lib/db/users";

type AuthUser = {
  userId: string; // ✅ UUID ONLY
};

export async function getUserFromBearer(): Promise<AuthUser | null> {
  try {
    const authHeader = headers().get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) return null;

    const response = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (!data?.uid) return null;

    const pi_uid = String(data.uid);

    // 🔥 CONVERT NGAY TẠI ĐÂY
    const userId = await getUserIdByPiUid(pi_uid);

    if (!userId) return null;

    return { userId };

  } catch {
    return null;
  }
}
