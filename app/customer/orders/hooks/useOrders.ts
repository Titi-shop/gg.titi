"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";

import { getPiAccessToken } from "@/lib/piAuth";

import type {
  Order,
  OrdersResponse,
} from "@/types/orders";

function normalizeOrder(
  order: Order
): Order {
  return {
    ...order,
  };
}

async function safeJson<T>(
  res: Response
): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchOrders(): Promise<Order[]> {
  const token =
    await getPiAccessToken();

  if (!token) {
    return [];
  }

  const res = await fetch(
    "/api/orders",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return [];
  }

  const data =
    await safeJson<unknown>(res);

  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
  return data as Order[];
  }
  const typed =
    data as OrdersResponse;

  return (
    typed.orders?.map(
      normalizeOrder
    ) ?? []
  );
}

export function useOrders(
  user: unknown
) {
  const {
    data = [],
    mutate,
    isLoading,
  } = useSWR<Order[]>(
    user
      ? "/api/orders"
      : null,
    fetchOrders,
    {
      revalidateOnFocus: false,
      revalidateIfStale: true,
      revalidateOnReconnect: true,
      dedupingInterval: 3000,
    }
  );

  useEffect(() => {
    void mutate();
  }, [user, mutate]);

  const totalPi = useMemo(
    () =>
      data.reduce(
        (sum, order) =>
          sum +
          Number(order.total ?? 0),
        0
      ),
    [data]
  );

  return {
    orders: data,
    totalPi,
    mutate,
    isLoading,
  };
    }
