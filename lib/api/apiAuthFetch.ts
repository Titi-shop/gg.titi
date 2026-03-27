import { getPiAccessToken } from "@/lib/piAuth";

export async function apiAuthFetch(
  input: RequestInfo,
  init?: RequestInit
) {
  const token = await getPiAccessToken();

  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
