import { NextResponse } from "next/server";

import { requireSeller } from "@/lib/auth/guard";
import { getSellerProducts } from "@/lib/db/products";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =====================================================
   TYPES
===================================================== */

type SellerProductResponse = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;
  thumbnail: string |null;
  images: string[];
  stock: number;
  sold: number;
  rating_avg: number;
  is_active: boolean;
  min_price?: number;
  min_sale_price?: number | null;

  /* SHOP */

  shop_name: string | null;
  shop_banner: string | null;
  avatar_url: string | null;
  shop_description: string | null;
  total_sales: number;
};

/* =====================================================
   LOGGER
===================================================== */

function log(
  step: string,
  data?: unknown
) {
  console.log(
    `🧪 [API][SELLER_PRODUCTS] ${step}`,
    data ?? ""
  );
}

function logError(
  step: string,
  error: unknown
) {
  console.error(
    `💥 [API][SELLER_PRODUCTS] ${step}`,
    error
  );
}

/* =====================================================
   GET
===================================================== */

export async function GET() {
  try {
    log("REQUEST_START");

    /* ================= AUTH ================= */

    const auth =
      await requireSeller();

    log("AUTH_RESULT", {
      ok: auth.ok,
      userId:
        auth.ok
          ? auth.userId
          : null,
    });

    if (!auth.ok) {
      log(
        "AUTH_FAILED_RETURN"
      );

      return auth.response;
    }

    /* ================= LOAD PRODUCTS ================= */

    const productsRaw =
      await getSellerProducts(
        auth.userId
      );

    log(
      "DB_PRODUCTS_LOADED",
      {
        count:
          productsRaw.length,
      }
    );

    if (
      productsRaw.length > 0
    ) {
      log(
        "FIRST_PRODUCT_SAMPLE",
        productsRaw[0]
      );
    }

    /* ================= MAP RESPONSE ================= */

    const products: SellerProductResponse[] =
      productsRaw.map(
        (p, index) => {
          const row =
            p as Record<
              string,
              unknown
            >;

          log(
            `MAP_PRODUCT_${index}`,
            {
              id: row.id,
              name: row.name,
              thumbnail:
                row.thumbnail,
              shop_name:
                row.shop_name,
              avatar_url:
                row.avatar_url,
              shop_banner:
                row.shop_banner,
            }
          );

          return {
            id: String(
              row.id ?? ""
            ),

            name: String(
              row.name ?? ""
            ),

            price: Number(
              row.price ?? 0
            ),

            sale_price:
              typeof row.sale_price ===
              "number"
                ? row.sale_price
                : null,

            sale_start:
              typeof row.sale_start ===
              "string"
                ? row.sale_start
                : null,

            sale_end:
              typeof row.sale_end ===
              "string"
                ? row.sale_end
                : null,

            thumbnail:
              typeof row.thumbnail ===
              "string"
                ? row.thumbnail
                : null,

            images:
              Array.isArray(
                row.images
              )
                ? row.images.filter(
                    (
                      v
                    ): v is string =>
                      typeof v ===
                      "string"
                  )
                : [],

            stock: Number(
              row.stock ?? 0
            ),

            sold: Number(
              row.sold ?? 0
            ),

            rating_avg:
              Number(
                row.rating_avg ??
                  0
              ),

            is_active:
              Boolean(
                row.is_active
              ),

            min_price:
              typeof row.min_price ===
              "number"
                ? row.min_price
                : undefined,

            min_sale_price:
              typeof row.min_sale_price ===
              "number"
                ? row.min_sale_price
                : null,

            /* ================= SHOP ================= */

            shop_name:
              typeof row.shop_name ===
              "string"
                ? row.shop_name
                : null,

            shop_banner:
              typeof row.shop_banner ===
              "string"
                ? row.shop_banner
                : null,

            avatar_url:
              typeof row.avatar_url ===
              "string"
                ? row.avatar_url
                : null,

             shop_description:
  typeof row.shop_description ===
  "string"
    ? row.shop_description
    : null,
             
            total_sales:
              Number(
                row.total_sales ??
                  0
              ),
          };
        }
      );

    log(
      "RESPONSE_READY",
      {
        count:
          products.length,
      }
    );

    return NextResponse.json(
      {
        ok: true,

        count:
          products.length,

        products,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    logError(
      "GET_ERROR",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        products: [],

        error:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",
      },
      {
        status: 200,
      }
    );
  }
              }
