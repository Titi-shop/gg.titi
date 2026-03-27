import { getPiAccessToken, clearPiToken } from "@/lib/piAuth";

export async function apiAuthFetch(
  input: RequestInfo,
  init?: RequestInit
) {
  let token = localStorage.getItem("pi_token");

  if (!token) {
    token = await getPiAccessToken();
  }

  let res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  // 🔥 AUTO RETRY
  if (res.status === 401) {
    clearPiToken();

    const newToken = await getPiAccessToken(true);

    res = await fetch(input, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${newToken}`,
      },
    });
  }

  return res;
}
