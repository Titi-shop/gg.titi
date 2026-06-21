// =====================================================
// app/account/wallet/wallet.hooks.ts
// =====================================================

"use client";

import {
  useMemo,
  useState,
} from "react";

import useSWR from "swr";

import {
  WALLET_SWR_CONFIG,
} from "./wallet.constants";

import {
  fetchWallet,
} from "./wallet.api";

import {
  useAuth,
} from "@/context/AuthContext";

/* =====================================================
   HOOK
===================================================== */

export function useWallet() {

  const {
    loading:
      authLoading,
  } = useAuth();

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  /* ===================================================
     SWR
  =================================================== */
const {
  data,
  error,
  isLoading,
  mutate,
} = useSWR(
  authLoading
    ? null
    : "wallet",

  fetchWallet,

  {
    ...WALLET_SWR_CONFIG,

    shouldRetryOnError:
      true,

    errorRetryCount:
      3,

    errorRetryInterval:
      2000,
  }
);
  
  /* ===================================================
     DATA
  =================================================== */

  const balance =
    useMemo(() => {

      return Number(
        data?.balance ?? 0
      );

    }, [data]);

  const transactions =
    useMemo(() => {

      return (
        data?.transactions ??
        []
      );

    }, [data]);

  /* ===================================================
     STATS
  =================================================== */

  const totalIn =
    useMemo(() => {

      return transactions
        .filter(
          (
            item
          ) =>
            item.direction ===
            "CREDIT"
        )
        .reduce(
          (
            acc,
            item
          ) =>
            acc +
            item.amount,

          0
        );

    }, [transactions]);

  const totalOut =
    useMemo(() => {

      return transactions
        .filter(
          (
            item
          ) =>
            item.direction ===
            "DEBIT"
        )
        .reduce(
          (
            acc,
            item
          ) =>
            acc +
            item.amount,

          0
        );

    }, [transactions]);

  /* ===================================================
     REFRESH
  =================================================== */

  async function refresh() {

    if (
      refreshing
    ) {
      return;
    }

    try {

      setRefreshing(
        true
      );

      await mutate();

    } finally {

      setRefreshing(
        false
      );
    }
  }

  /* ===================================================
     RETURN
  =================================================== */

  return {

    loading:
  authLoading ||
  (isLoading && !data),

    error,

    refreshing,

    balance,

    transactions,

    totalIn,

    totalOut,

    refresh,
  };
}
