"use client";

export const dynamic = "force-dynamic";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import type { ReturnRecord } from "./types/returns";
import ReturnList from "./components/ReturnList";
import ReturnsSkeleton from "./components/ReturnsSkeleton";
export default function ReturnsPage() {
  const { user, loading: authLoading } =
    useAuth();

  const [returns, setReturns] =
    useState<ReturnRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    loadReturns();
  }, [authLoading, user]);

  async function loadReturns() {
  try {
    const res = await apiAuthFetch("/api/returns");

    if (!res.ok) {
      setReturns([]);
      return;
    }

    const data = await res.json();

    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
      ? data.items
      : [];

    // 🔥 FIX: chuẩn hóa order_id
    const normalized = list.map((item: any) => ({
      ...item,

      order_id:
        item.order_id ||
        item.orderId ||
        item.order?.id ||
        null,
    }));

    setReturns(normalized);
  } catch (error) {
    console.error("❌ LOAD RETURNS ERROR", error);
    setReturns([]);
  } finally {
    setLoading(false);
  }
  }

  const sortedReturns = useMemo(() => {
    return [...returns].sort((a, b) => {
      const da = a.created_at
        ? new Date(a.created_at).getTime()
        : 0;

      const db = b.created_at
        ? new Date(b.created_at).getTime()
        : 0;

      return db - da;
    });
  }, [returns]);

  if (loading || authLoading) {
    return <ReturnsSkeleton />;
  }

  return (
    <ReturnList
      returns={sortedReturns}
    />
  );
}
