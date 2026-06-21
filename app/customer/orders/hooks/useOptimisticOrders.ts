"use client";

import { useEffect, useMemo, useState } from "react";

import type { Order } from "@/types/orders";

export function useOptimisticOrders(
  orders: Order[]
) {
  const [
    optimisticOrder,
    setOptimisticOrder,
  ] = useState<Order | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw =
      localStorage.getItem(
        "optimistic_order"
      );

    if (!raw) {
      return;
    }

    try {
      setOptimisticOrder(
        JSON.parse(raw) as Order
      );
    } catch {
      localStorage.removeItem(
        "optimistic_order"
      );
    }
  }, []);

  const mergedOrders = useMemo(() => {
    if (!optimisticOrder) {
      return orders;
    }

    const exists = orders.some(
      order =>
        order.id ===
        optimisticOrder.id
    );

    if (exists) {
      return orders;
    }

    return [
      optimisticOrder,
      ...orders,
    ];
  }, [orders, optimisticOrder]);

  useEffect(() => {
    if (!optimisticOrder) {
      return;
    }

    const exists = orders.some(
      order =>
        order.id ===
        optimisticOrder.id
    );

    if (!exists) {
      return;
    }

    localStorage.removeItem(
      "optimistic_order"
    );

    setOptimisticOrder(null);
  }, [orders, optimisticOrder]);

  return mergedOrders;
}
