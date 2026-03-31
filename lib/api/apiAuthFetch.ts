import { getPiAccessToken, clearPiToken } from "@/lib/piAuth";

export async function apiAuthFetch(
  input: RequestInfo,
  init?: RequestInit
) {
  let token = localStorage.getItem("pi_token");

  // 🔥 LUÔN đảm bảo token hợp lệ
  if (!token) {
    token = await getPiAccessToken();
  }

  const doFetch = async (tk: string) =>
    fetch(input, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${tk}`,
      },
    });

  let res = await doFetch(token);

  // 🔥 AUTO RETRY (SAFE)
  if (res.status === 401) {
    clearPiToken();

    const newToken = await getPiAccessToken(true);

    // 🔥 QUAN TRỌNG: update localStorage
    localStorage.setItem("pi_token", newToken);

    res = await doFetch(newToken);
  }

  return res;
}
