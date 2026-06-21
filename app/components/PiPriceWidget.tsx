"use client";

import {
  Activity,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import PiTradingChart from "./PiTradingChart";
interface PiPriceResponse {
  symbol: string;
  price_usd: number;
  change_24h: number | null;
  updated_at?: string;
}

export default function PiPriceWidget() {
  const { t } = useTranslation();

  const [price, setPrice] = useState(0);
  const [change, setChange] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [flash, setFlash] = useState<
    "up" | "down" | null
  >(null);

  const prevPriceRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const fetchPrice = async () => {
      try {
        const res = await fetch("/api/pi-price", {
          cache: "no-store",
        });

        if (!res.ok) {
          setConnected(false);
          return;
        }

        const data: PiPriceResponse =
          await res.json();

        if (!mounted) return;

        const nextPrice = Number(
          data.price_usd ?? 0
        );

        const nextChange = Number(
          data.change_24h ?? 0
        );

        const oldPrice =
          prevPriceRef.current;

        if (oldPrice > 0) {
          if (nextPrice > oldPrice) {
            setFlash("up");
          } else if (
            nextPrice < oldPrice
          ) {
            setFlash("down");
          }

          setTimeout(
            () => setFlash(null),
            450
          );
        }

        prevPriceRef.current =
          nextPrice;

        setPrice(nextPrice);
        setChange(nextChange);
        setConnected(true);

        setHistory((prev) =>
          [...prev, nextPrice].slice(-80)
        );
      } catch (error) {
        console.error(
          "PI_PRICE_WIDGET_ERROR",
          error
        );
        setConnected(false);
      }
    };

    fetchPrice();

    const interval = setInterval(
      fetchPrice,
      2500
    );

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const isUp = change >= 0;

  const graphColor = isUp
    ? "#34d399"
    : "#f87171";

  const textColor = isUp
    ? "text-emerald-400"
    : "text-red-400";

  const chartPath = useMemo(() => {
    if (history.length < 2) return "";

    const width = 600;
    const height = 70;

    const max = Math.max(...history);
    const min = Math.min(...history);

    return history
      .map((value, index) => {
        const x =
          (index /
            (history.length - 1)) *
          width;

        const y =
          height -
          ((value - min) /
            (max - min || 1)) *
            height;

        return `${
          index === 0 ? "M" : "L"
        } ${x} ${y}`;
      })
      .join(" ");
  }, [history]);

  return (
  <div className="pi-widget relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1120] shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:22px_22px]" />

      <div
        className={`absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl ${
          isUp
            ? "bg-emerald-500/20"
            : "bg-red-500/20"
        }`}
      />

      <div className="relative z-10 p-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl">
                <Activity
                  size={18}
                  className="text-orange-400"
                />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
                  {t.live_market ??
                    "Live Market"}
                </p>

                <h2 className="text-2xl font-black text-white">
                  PI / USDT
                </h2>
              </div>
            </div>

            <div className="mt-3 flex items-end gap-3">
              <div
                className={`text-2xl font-black tracking-tight transition-all duration-300 ${textColor} ${
                  flash === "up"
                    ? "scale-105"
                    : ""
                } ${
                  flash === "down"
                    ? "scale-95"
                    : ""
                }`}
              >
                $
                {price.toLocaleString(
                  undefined,
                  {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  }
                )}
              </div>

              <span className="mb-1 text-xs text-white/40">
                USD
              </span>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-2xl px-2.5 py-1.5 text-xs font-bold ${
              isUp
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {isUp ? (
              <TrendingUp size={16} />
            ) : (
              <TrendingDown size={16} />
            )}

            {change.toFixed(2)}%
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              connected
                ? "animate-pulse bg-emerald-400"
                : "bg-red-400"
            }`}
          />

          <span className="text-xs text-white/50">
            {connected
              ? t.realtime_connected ??
                "Realtime Connected"
              : t.disconnected ??
                "Disconnected"}
          </span>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-xl border border-white/5 bg-black/20 p-2 backdrop-blur-xl">
          <PiTradingChart
         data={history}
      color={graphColor}
      />
        </div>

        <div className="mt-3 border-t border-white/5 py-2">
          <div className="flex gap-4 overflow-hidden whitespace-nowrap text-[11px] font-semibold text-white/70">
            <span>
              {t.pi_network_live_market ??
                "PI NETWORK LIVE MARKET"}
            </span>

            <span className="text-orange-300">
              {t.realtime_price ??
                "REALTIME PRICE"}
            </span>

            <span className="text-emerald-400">
              ▲ ${price.toFixed(4)}
            </span>

            <span>
              {t.change_24h ??
                "24H CHANGE"}
            </span>

            <span
              className={
                isUp
                  ? "text-emerald-400"
                  : "text-red-400"
              }
            >
              {change.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
                            }
