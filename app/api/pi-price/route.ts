import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 10;

/* =========================================================
   TYPES
========================================================= */

interface OkxTicker {
  last?: string;
  open24h?: string;
  vol24h?: string;
  high24h?: string;
  low24h?: string;
  ts?: string;
}

interface OkxResponse {
  code?: string;
  data?: OkxTicker[];
}

interface CachedPrice {
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  updatedAt: string;
  source: string;
  ts: number;
}

/* =========================================================
   MEMORY CACHE
========================================================= */

let cache: CachedPrice | null = null;

const CACHE_TTL = 8000;

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function buildResponse(data: CachedPrice) {
  return NextResponse.json(
    {
      symbol: "PI/USDT",

      price_usd: data.price,

      change_24h: data.change24h,

      high_24h: data.high24h,

      low_24h: data.low24h,

      volume_24h: data.volume24h,

      updated_at: data.updatedAt,

      source: data.source,
    },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=8, stale-while-revalidate=20",
      },
    }
  );
}

/* =========================================================
   ROUTE
========================================================= */

export async function GET() {
  const now = Date.now();

  /* =====================================================
     HOT CACHE
  ===================================================== */

  if (cache && now - cache.ts < CACHE_TTL) {
    return buildResponse({
      ...cache,
      source: "CACHE",
    });
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 4500);

  try {
    /* =====================================================
       OKX API
    ===================================================== */

    const res = await fetch(
      "https://www.okx.com/api/v5/market/ticker?instId=PI-USDT",
      {
        method: "GET",

        signal: controller.signal,

        next: {
          revalidate: 10,
        },

        headers: {
          Accept: "application/json",
        },
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OKX_HTTP_${res.status}`);
    }

    const json: OkxResponse = await res.json();

    if (!json.data?.length) {
      throw new Error("EMPTY_OKX_DATA");
    }

    const ticker = json.data[0];

    const price = safeNumber(ticker.last);

    const open24h = safeNumber(ticker.open24h);

    const high24h = safeNumber(ticker.high24h);

    const low24h = safeNumber(ticker.low24h);

    const volume24h = safeNumber(ticker.vol24h);

    if (!price || price <= 0) {
      throw new Error("INVALID_PRICE");
    }

    /* =====================================================
       CHANGE %
    ===================================================== */

    let change24h = 0;

    if (open24h > 0) {
      change24h =
        ((price - open24h) / open24h) * 100;
    }

    /* =====================================================
       CACHE UPDATE
    ===================================================== */

    const payload: CachedPrice = {
      price,

      change24h,

      high24h,

      low24h,

      volume24h,

      updatedAt: new Date().toISOString(),

      source: "OKX",

      ts: now,
    };

    cache = payload;

    return buildResponse(payload);
  } catch (error) {
    clearTimeout(timeout);

    console.error("PI_PRICE_API_ERROR", error);

    /* =====================================================
       FALLBACK CACHE
    ===================================================== */

    if (cache) {
      return buildResponse({
        ...cache,
        source: "FALLBACK_CACHE",
      });
    }

    /* =====================================================
       ERROR
    ===================================================== */

    return NextResponse.json(
      {
        error: "PI_PRICE_UNAVAILABLE",
      },
      {
        status: 503,
      }
    );
  }
}
