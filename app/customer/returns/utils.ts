import {
  BadgeCheck,
  Clock3,
  PackageCheck,
  RefreshCcw,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";

import type { ReturnStatus } from "./types";

const BASE_STORAGE =
  process.env.NEXT_PUBLIC_SUPABASE_URL +
  "/storage/v1/object/public/";

export function getImage(
  src?: string | null
) {
  if (!src) return "/placeholder.png";

  if (src.startsWith("http")) {
    return src;
  }

  return BASE_STORAGE + "products/" + src;
}

export function getStatusConfig(
  status: ReturnStatus,
  t: Record<string, string>
) {
  switch (status) {
    case "pending":
      return {
        icon: Clock3,
        text:
          t.return_pending ??
          "Pending Review",
        className:
          "border-yellow-500/20 bg-yellow-500/10 text-yellow-500",
      };

    case "approved":
      return {
        icon: BadgeCheck,
        text:
          t.return_approved ??
          "Approved",
        className:
          "border-blue-500/20 bg-blue-500/10 text-blue-500",
      };

    case "shipping_back":
      return {
        icon: Truck,
        text:
          t.return_shipping_back ??
          "Shipping Back",
        className:
          "border-indigo-500/20 bg-indigo-500/10 text-indigo-500",
      };

    case "received":
      return {
        icon: PackageCheck,
        text:
          t.return_received ??
          "Received",
        className:
          "border-purple-500/20 bg-purple-500/10 text-purple-500",
      };

    case "refund_pending":
      return {
        icon: RefreshCcw,
        text:
          t.return_refund_pending ??
          "Refund Pending",
        className:
          "border-orange-500/20 bg-orange-500/10 text-orange-500",
      };

    case "refunded":
      return {
        icon: Wallet,
        text:
          t.return_refunded ??
          "Refunded",
        className:
          "border-green-500/20 bg-green-500/10 text-green-500",
      };

    case "rejected":
      return {
        icon: XCircle,
        text:
          t.return_rejected ??
          "Rejected",
        className:
          "border-red-500/20 bg-red-500/10 text-red-500",
      };

    case "cancelled":
      return {
        icon: XCircle,
        text:
          t.cancelled ??
          "Cancelled",
        className:
          "border-gray-500/20 bg-gray-500/10 text-gray-500",
      };

    default:
      return {
        icon: Clock3,
        text: status,
        className:
          "border-[var(--border)] bg-[var(--card-secondary)] text-[var(--text-muted)]",
      };
  }
}
