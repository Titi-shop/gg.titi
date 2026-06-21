// =====================================================
// app/account/wallet/components/WalletWithdrawModal.tsx
// =====================================================

"use client";

import {
  Loader2,
  Wallet,
} from "lucide-react";

import {
  useState,
} from "react";

import {
  useTranslationClient as useTranslation,
} from "@/app/lib/i18n/client";

import {
  createWithdraw,
} from "../wallet.withdraw";

/* =====================================================
   TYPES
===================================================== */

type Props = {
  open: boolean;

  onClose: () => void;

  onSuccess: () => Promise<void>;
};

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletWithdrawModal({
  open,
  onClose,
  onSuccess,
}: Props) {

  const { t } =
    useTranslation();

  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    withdrawWallet,
    setWithdrawWallet,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* ===================================================
     HIDE
  =================================================== */

  if (!open) {
    return null;
  }

  /* ===================================================
     GET ERROR MESSAGE
  =================================================== */

  function getErrorMessage(
    errorCode?: string
  ) {

    switch (
      errorCode
    ) {

      case
        "INVALID_AMOUNT":

        return (
          t
            .wallet_invalid_amount ??
          "Invalid amount"
        );

      case
        "INVALID_WALLET":

        return (
          t
            .wallet_invalid_wallet ??
          "Invalid wallet address"
        );

      case
        "INSUFFICIENT_BALANCE":

        return (
          t
            .wallet_insufficient_balance ??
          "Insufficient balance"
        );

      case
        "WITHDRAW_DISABLED":

        return (
          t
            .wallet_withdraw_disabled ??
          "Withdraw is disabled"
        );

      case
        "INVALID_ADDRESS":

        return (
          t
            .wallet_invalid_address ??
          "Invalid wallet address"
        );

      case
        "NETWORK_ERROR":

        return (
          t
            .wallet_network_error ??
          "Network error"
        );

      default:

        return (
          t
            .wallet_withdraw_failed ??
          "Withdraw failed"
        );
    }
  }

  /* ===================================================
     SUBMIT
  =================================================== */

  async function handleSubmit() {

    try {

      setLoading(true);

      setError("");

      const parsedAmount =
        Number(amount);

      if (
        Number.isNaN(
          parsedAmount
        ) ||
        parsedAmount <= 0
      ) {

        setError(
          t
            .wallet_invalid_amount ??
          "Invalid amount"
        );

        return;
      }

      if (
        !withdrawWallet
          .trim()
      ) {

        setError(
          t
            .wallet_address_required ??
          "Wallet address required"
        );

        return;
      }

      const result =
        await createWithdraw({
          amount:
            parsedAmount,

          withdrawWallet:
            withdrawWallet
              .trim(),
        });

      if (
        !result.success
      ) {

        setError(
          getErrorMessage(
            result.error
          )
        );

        return;
      }

      setAmount("");

      setWithdrawWallet("");

      await onSuccess();

      onClose();

    } catch {

      setError(
        t
          .wallet_withdraw_failed ??
        "Withdraw failed"
      );

    } finally {

      setLoading(false);
    }
  }

  /* ===================================================
     UI
  =================================================== */

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-end
        bg-black/60
        backdrop-blur-sm
      "
    >

      {/* BACKDROP */}

      <button
        type="button"
        onClick={onClose}
        className="
          absolute inset-0
        "
      />

      {/* SHEET */}

      <div
        className="
          relative z-10
          w-full
          rounded-t-[2rem]
          bg-[var(--card-bg)]
          border-t
          border-[var(--nav-border)]
          p-5
          pb-[calc(env(safe-area-inset-bottom)+90px)]
          shadow-2xl
        "
      >

        {/* HANDLE */}

        <div
          className="
            mx-auto mb-6
            h-1.5 w-14
            rounded-full
            bg-[var(--nav-border)]
          "
        />

        {/* HEADER */}

        <div className="flex items-center gap-4">

          <div
            className="
              flex h-14 w-14
              items-center justify-center
              rounded-2xl
              bg-primary/10
              text-primary
            "
          >
            <Wallet size={24} />
          </div>

          <div className="flex-1">

            <h2
              className="
                text-xl font-bold
                text-[var(--foreground)]
              "
            >
              {t.wallet_withdraw ??
                "Withdraw"}
            </h2>

            <p
              className="
                mt-1 text-sm
                text-[var(--text-muted)]
              "
            >
              {t
                .wallet_withdraw_description ??
                "Withdraw PI to another wallet"}
            </p>

          </div>

        </div>

        {/* ERROR */}

        {error && (

          <div
            className="
              mt-5
              rounded-2xl
              border
              border-red-500/20
              bg-red-500/10
              px-4 py-3
              text-sm
              font-medium
              text-red-500
            "
          >
            {error}
          </div>
        )}

        {/* WALLET */}

        <div className="mt-6">

          <p
            className="
              mb-2
              text-sm
              font-medium
              text-[var(--foreground)]
            "
          >
            {t
              .wallet_address ??
              "Wallet Address"}
          </p>

          <input
            type="text"
            value={
              withdrawWallet
            }
            onChange={(e) => {
              setWithdrawWallet(
                e.target.value
              );
            }}
            placeholder={
              t
                .wallet_address_placeholder ??
              "Pi Wallet Address"
            }
            className="
              w-full
              rounded-2xl
              border
              border-[var(--nav-border)]
              bg-[var(--background)]
              px-4 py-3.5
              text-sm
              text-[var(--foreground)]
              outline-none
              transition-all
              placeholder:text-[var(--text-muted)]
              focus:border-[var(--color-primary)]
              focus:ring-2
              focus:ring-[var(--color-primary)]/10
            "
          />

        </div>

        {/* AMOUNT */}

        <div className="mt-5">

          <p
            className="
              mb-2
              text-sm
              font-medium
              text-[var(--foreground)]
            "
          >
            {t
              .wallet_amount ??
              "Amount"}
          </p>

          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(
                e.target.value
              );
            }}
            placeholder="0.00"
            className="
              w-full
              rounded-2xl
              border
              border-[var(--nav-border)]
              bg-[var(--background)]
              px-4 py-3.5
              text-sm
              text-[var(--foreground)]
              outline-none
              transition-all
              placeholder:text-[var(--text-muted)]
              focus:border-[var(--color-primary)]
              focus:ring-2
              focus:ring-[var(--color-primary)]/10
            "
          />

        </div>

        {/* ACTIONS */}

        <div className="mt-6 flex gap-3">

          {/* CANCEL */}

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="
              flex-1
              rounded-2xl
              border
              border-[var(--nav-border)]
              bg-[var(--card-secondary)]
              py-3.5
              text-sm
              font-semibold
              text-[var(--foreground)]
              transition-all
              active:scale-95
              disabled:opacity-60
            "
          >
            {t
              .common_cancel ??
              "Cancel"}
          </button>

          {/* SUBMIT */}

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void handleSubmit();
            }}
            className="
              flex flex-1
              items-center
              justify-center
              gap-2
              rounded-2xl
              bg-primary
              py-3.5
              text-sm
              font-semibold
              text-white
              transition-all
              active:scale-95
              disabled:opacity-60
            "
          >

            {loading && (
              <Loader2
                size={16}
                className="animate-spin"
              />
            )}

            {loading
              ? (
                t
                  .common_processing ??
                "Processing..."
              )
              : (
                t
                  .wallet_withdraw ??
                "Withdraw"
              )}

          </button>

        </div>

      </div>

    </div>
  );
}
