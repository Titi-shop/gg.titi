"use client";

import Image from "next/image";

import {
  Plus,
  Upload,
  Pencil,
  Trash2,
  Star,
  Package2,
  ShoppingCart,
} from "lucide-react";

import {
  useState,
  useEffect,
  useCallback,
} from "react";

import { useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useAuth } from "@/context/AuthContext";
import { apiAuthFetch } from "@/lib/api/apiAuthFetch";
import { formatPi } from "@/lib/pi";
import { isNowInRange } from "@/lib/utils/time";

import type {
  SellerProduct,
} from "@/types/Product";

/* =====================================================
   DEFAULTS
===================================================== */

const DEFAULT_AVATAR =
  "/avatars/default-avatar.png";

const DEFAULT_BANNER =
  "/banners/30FD1BCC-E31C-4702-9E63-8BF08C5E311C.png";

/* =====================================================
   TYPES
===================================================== */

interface Message {
  text: string;

  type:
    | "success"
    | "error"
    | "";
}

interface ShopProfile {
  shop_name: string | null;
  shop_banner: string | null;
  avatar_url: string | null;
  shop_description:
    | string
    | null;

  rating: number | null;

  total_reviews:
    | number
    | null;

  total_sales:
    | number
    | null;
}

/* =====================================================
   HELPERS
===================================================== */

function getDisplayPrice(
  p: SellerProduct
) {
  const basePrice =
    typeof p.min_price ===
      "number" &&
    p.min_price > 0
      ? p.min_price
      : p.price;

  const baseSale =
    typeof p.min_sale_price ===
      "number" &&
    p.min_sale_price > 0
      ? p.min_sale_price
      : p.sale_price;

  const isSale =
    isNowInRange(
      p.sale_start,
      p.sale_end
    );

  return {
    price: basePrice,

    sale_price:
      isSale &&
      baseSale
        ? baseSale
        : null,
  };
}

/* =====================================================
   PAGE
===================================================== */

export default function SellerStockPage() {
  const router =
    useRouter();

  const { t } =
    useTranslation();

  const {
    loading:
      authLoading,
  } = useAuth();

  /* =====================================================
     STATES
  ===================================================== */

  const [
    products,
    setProducts,
  ] = useState<
    SellerProduct[]
  >([]);

  const [
    pageLoading,
    setPageLoading,
  ] = useState(true);

  const [
    avatarCache,
    setAvatarCache,
  ] = useState<
    string | null
  >(null);

  const [
    message,
    setMessage,
  ] = useState<Message>({
    text: "",
    type: "",
  });

  const [shop, setShop] =
    useState<ShopProfile>({
      shop_name: null,
      shop_banner: null,
      avatar_url: null,
      shop_description:
        null,
      rating: null,
      total_reviews:
        null,
      total_sales: null,
    });
const [
  deleteTarget,
  setDeleteTarget,
] = useState<SellerProduct | null>(
  null
);

const [
  deleting,
  setDeleting,
] = useState(false);
  /* =====================================================
     CACHE AVATAR
  ===================================================== */

  useEffect(() => {
    const cached =
      localStorage.getItem(
        "avatar"
      );

    if (cached) {
      setAvatarCache(
        cached
      );
    }
  }, []);

  useEffect(() => {
    if (
      shop.avatar_url
    ) {
      setAvatarCache(
        shop.avatar_url
      );

      localStorage.setItem(
        "avatar",
        shop.avatar_url
      );
    }
  }, [shop.avatar_url]);

  /* =====================================================
     COMPUTED
  ===================================================== */

  const avatar =
    avatarCache ||
    shop.avatar_url ||
    DEFAULT_AVATAR;

  const banner =
    shop.shop_banner ||
    DEFAULT_BANNER;

  /* =====================================================
     LOAD PRODUCTS
  ===================================================== */

  const loadProducts =
    useCallback(
      async () => {
        try {
          const res =
            await apiAuthFetch(
              "/api/seller/products",
              {
                cache:
                  "no-store",
              }
            );

          if (!res.ok) {
            setMessage({
              text:
                t.load_products_error,

              type:
                "error",
            });

            return;
          }

          const raw: unknown =
            await res.json();

          const payload =
            raw as {
              products?: unknown[];
            };

          const list =
            Array.isArray(
              payload.products
            )
              ? payload.products
              : [];

          /* ================= SHOP ================= */

          const first =
            list[0] as
              | Record<
                  string,
                  unknown
                >
              | undefined;

          if (first) {
            setShop({
              shop_name:
                typeof first.shop_name ===
                "string"
                  ? first.shop_name
                  : null,

              shop_banner:
                typeof first.shop_banner ===
                "string"
                  ? first.shop_banner
                  : null,

              avatar_url:
                typeof first.avatar_url ===
                "string"
                  ? first.avatar_url
                  : null,

              shop_description:
                typeof first.shop_description ===
                "string"
                  ? first.shop_description
                  : null,

              rating:
                typeof first.rating_avg ===
                "number"
                  ? first.rating_avg
                  : 0,

              total_reviews: 0,

              total_sales:
                typeof first.total_sales ===
                "number"
                  ? first.total_sales
                  : 0,
            });
          }

          /* ================= PRODUCTS ================= */

          const mapped: SellerProduct[] =
            list.map(
              (
                item: unknown
              ) => {
                const p =
                  item as Record<
                    string,
                    unknown
                  >;

                return {
                  id: String(
                    p.id ??
                      ""
                  ),

                  name: String(
                    p.name ??
                      "Unnamed"
                  ),

                  price:
                    Number(
                      p.price ??
                        0
                    ),

                  sale_price:
                    typeof p.sale_price ===
                    "number"
                      ? p.sale_price
                      : null,

                  sale_start:
                    typeof p.sale_start ===
                    "string"
                      ? p.sale_start
                      : null,

                  sale_end:
                    typeof p.sale_end ===
                    "string"
                      ? p.sale_end
                      : null,

                  min_price:
                    typeof p.min_price ===
                    "number"
                      ? p.min_price
                      : undefined,

                  min_sale_price:
                    typeof p.min_sale_price ===
                    "number"
                      ? p.min_sale_price
                      : null,

                  thumbnail:
                    typeof p.thumbnail ===
                    "string"
                      ? p.thumbnail
                      : "",

                  stock:
                    Number(
                      p.stock ??
                        0
                    ),

                  sold:
                    Number(
                      p.sold ??
                        0
                    ),

                  rating_avg:
                    Number(
                      p.rating_avg ??
                        0
                    ),

                  is_active:
                    Boolean(
                      p.is_active
                    ),
                };
              }
            );

          setProducts(
            mapped
          );
        } catch {
          setMessage({
            text:
              t.load_products_error,

            type:
              "error",
          });
        } finally {
          setPageLoading(
            false
          );
        }
      },
      [t]
    );

  /* =====================================================
     EFFECT
  ===================================================== */

  useEffect(() => {
    if (
      !authLoading
    ) {
      loadProducts();
    }
  }, [
    authLoading,
    loadProducts,
  ]);

  /* =====================================================
     BANNER UPLOAD
  ===================================================== */

  const handleBannerUpload =
    async (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        e.target.files?.[0];

      if (!file)
        return;

      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        const res =
          await apiAuthFetch(
            "/api/uploadShopBanner",
            {
              method:
                "POST",

              body:
                formData,
            }
          );

        if (!res.ok) {
          throw new Error(
            "UPLOAD_FAILED"
          );
        }

        const data =
          await res.json();

        setShop(
          (prev) => ({
            ...prev,

            shop_banner:
              data.banner,
          })
        );

        setMessage({
          text:
            "Banner updated",

          type:
            "success",
        });
      } catch {
        setMessage({
          text:
            "Upload failed",

          type:
            "error",
        });
      }
    };

  /* =====================================================
     DELETE PRODUCT
  ===================================================== */
const handleDelete =
  async () => {
    if (!deleteTarget)
      return;

    try {
      setDeleting(true);

      const res =
        await apiAuthFetch(
          `/api/products?id=${encodeURIComponent(
            deleteTarget.id
          )}`,
          {
            method:
              "DELETE",
          }
        );

      if (res.ok) {
        setProducts(
          (prev) =>
            prev.filter(
              (p) =>
                p.id !==
                deleteTarget.id
            )
        );

        setMessage({
          text:
            t.delete_success,

          type:
            "success",
        });

        setDeleteTarget(
          null
        );
      } else {
        setMessage({
          text:
            t.delete_failed,

          type:
            "error",
        });
      }
    } catch {
      setMessage({
        text:
          t.delete_failed,

        type:
          "error",
      });
    } finally {
      setDeleting(false);
    }
    };

  /* =====================================================
     LOADING
  ===================================================== */

  if (
    pageLoading
  ) {
    return (
      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
        "
        style={{
          backgroundColor:
            "var(--background)",

          color:
            "var(--muted-foreground)",
        }}
      >
        Loading...
      </main>
    );
  }


  /* =====================================================
     UI
  ===================================================== */

  return (
    <main
      className="
        min-h-screen
        pb-28
      "
      style={{
        backgroundColor:
          "var(--background)",
      }}
    >
      <div
        className="
          mx-auto
          max-w-2xl
          p-4
        "
      >
        {/* HEADER */}

        <section
          className="
            overflow-hidden
            rounded-3xl
            border
            shadow-sm
          "
          style={{
            backgroundColor:
              "var(--card-bg)",

            borderColor:
              "var(--border-color)",
          }}
        >
          {/* BANNER */}

          <div className="relative h-44 w-full">
            <Image
              src={banner}
              alt="Shop banner"
              fill
              priority
              unoptimized
             className="object-cover object-center"
            />

            <div className="absolute inset-0 bg-black/5" />
            {/* CHANGE BANNER */}

            <label
              className="
                absolute
                left-4
                top-4
                flex
                cursor-pointer
                items-center
                gap-2
                rounded-full
                border
                px-4
                py-2
                text-xs
                font-medium
                text-white
                backdrop-blur-md
              "
              style={{
                borderColor:
                  "rgba(255,255,255,0.3)",

                backgroundColor:
                  "rgba(0,0,0,0.35)",
              }}
            >
              <Upload size={14} />

              {t.change_banner}

              <input
                type="file"
                hidden
                accept="image/*"
                onChange={
                  handleBannerUpload
                }
              />
            </label>

            {/* ADD PRODUCT */}

            <button
              onClick={() =>
                router.push(
                  "/seller/post"
                )
              }
              className="
                absolute
                right-4
                top-4
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                text-white
                shadow-lg
                transition-all
                active:scale-95
              "
              style={{
                background:
                  "linear-gradient(135deg,#f97316,#ea580c)",
              }}
            >
              <Plus size={22} />
            </button>
          </div>

          {/* PROFILE */}

          <div className="px-5 pb-6">
            {/* AVATAR */}

            <div className="relative z-20 flex justify-center -mt-14">
              <div
           className="
    h-28
    w-28
    overflow-hidden
    rounded-full
    border-4
    shadow-2xl
            bg-white
             "
                style={{
                  borderColor:
                    "var(--card-bg)",

                  backgroundColor:
                    "var(--soft-bg)",
                }}
              >
                <Image
                  src={avatar}
                  alt="Avatar"
                  width={112}
                  height={112}
                  priority
                  unoptimized
                  className="
                    h-full
                    w-full
                    object-cover
                  "
                />
              </div>
            </div>

            {/* SHOP NAME */}

            <div className="mt-4 text-center">
              <h1
                className="
                  text-2xl
                  font-bold
                "
                style={{
                  color:
                    "var(--foreground)",
                }}
              >
                {shop.shop_name ||
                  t.my_store}
              </h1>

              <p
                className="
                  mt-1
                  text-sm
                "
                style={{
                  color:
                    "var(--muted-foreground)",
                }}
              >
                {shop.shop_description || t.manage_products_sales}
              </p>
            </div>

            {/* STATS */}

            <div
              className="
                mt-6
                grid
                grid-cols-3
                gap-3
              "
            >
              <div
                className="
                  rounded-2xl
                  border
                  p-4
                  text-center
                "
                style={{
                  backgroundColor:
                    "var(--soft-bg)",

                  borderColor:
                    "var(--border-color)",
                }}
              >
                <Star
                  size={18}
                  className="mx-auto mb-2 text-yellow-500"
                />

                <p
                  className="
                    text-lg
                    font-bold
                  "
                  style={{
                    color:
                      "var(--foreground)",
                  }}
                >
                  {shop.rating ??
                    0}
                </p>

                <p
                  className="
                    text-xs
                  "
                  style={{
                    color:
                      "var(--muted-foreground)",
                  }}
                >
                  {t.rating}
                </p>
              </div>

              <div
                className="
                  rounded-2xl
                  border
                  p-4
                  text-center
                "
                style={{
                  backgroundColor:
                    "var(--soft-bg)",

                  borderColor:
                    "var(--border-color)",
                }}
              >
                <Package2
                  size={18}
                  className="mx-auto mb-2 text-orange-500"
                />

                <p
                  className="
                    text-lg
                    font-bold
                  "
                  style={{
                    color:
                      "var(--foreground)",
                  }}
                >
                  {
                    products.length
                  }
                </p>

                <p
                  className="
                    text-xs
                  "
                  style={{
                    color:
                      "var(--muted-foreground)",
                  }}
                >
                  {t.products}
                </p>
              </div>

              <div
                className="
                  rounded-2xl
                  border
                  p-4
                  text-center
                "
                style={{
                  backgroundColor:
                    "var(--soft-bg)",

                  borderColor:
                    "var(--border-color)",
                }}
              >
                <ShoppingCart
                  size={18}
                  className="mx-auto mb-2 text-green-500"
                />

                <p
                  className="
                    text-lg
                    font-bold
                  "
                  style={{
                    color:
                      "var(--foreground)",
                  }}
                >
                  {shop.sales ??
                    0}
                </p>

                <p
                  className="
                    text-xs
                  "
                  style={{
                    color:
                      "var(--muted-foreground)",
                  }}
                >
                  {t.sales}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* MESSAGE */}

        {message.text && (
          <div
            className={`
              mt-4
              rounded-2xl
              border
              px-4
              py-3
              text-sm
              font-medium
              ${
                message.type ===
                "success"
                  ? "border-green-500/30 bg-green-500/10 text-green-500"
                  : "border-red-500/30 bg-red-500/10 text-red-500"
              }
            `}
          >
            {message.text}
          </div>
        )}

        {/* EMPTY */}

        {products.length ===
          0 && (
          <div
            className="
              mt-6
              rounded-3xl
              border
              p-10
              text-center
            "
            style={{
              backgroundColor:
                "var(--card-bg)",

              borderColor:
                "var(--border-color)",
            }}
          >
            <p
              style={{
                color:
                  "var(--muted-foreground)",
              }}
            >
              {t.no_products}
            </p>
          </div>
        )}

        {/* PRODUCTS */}

        <section className="mt-6 space-y-5">
          {products.map(
            (
              product
            ) => {
              const display =
                getDisplayPrice(
                  product
                );

              const now =
                new Date();

              const start =
                product.sale_start
                  ? new Date(
                      product.sale_start
                    )
                  : null;

              const end =
                product.sale_end
                  ? new Date(
                      product.sale_end
                    )
                  : null;

              const isSale =
                isNowInRange(
                  product.sale_start,
                  product.sale_end
                );

              const upcoming =
                product.sale_price !==
                  null &&
                start !==
                  null &&
                now <
                  start;

              const ended =
                product.sale_price !==
                  null &&
                end !==
                  null &&
                now >
                  end;

              return (
                <div
                  key={
                    product.id
                  }
                  className="
                    overflow-hidden
                    rounded-3xl
                    border
                    shadow-sm
                  "
                  style={{
                    backgroundColor:
                      "var(--card-bg)",

                    borderColor:
                      "var(--border-color)",
                  }}
                >
                  {/* CARD */}

                  <div
                    onClick={() =>
                      router.push(
                        `/product/${product.id}`
                      )
                    }
                    className="
                      flex
                      cursor-pointer
                      gap-4
                      p-4
                    "
                  >
                    {/* IMAGE */}

                    <div
                      className="
                        relative
                        h-28
                        w-28
                        overflow-hidden
                        rounded-2xl
                        border
                        flex-shrink-0
                      "
                      style={{
                        borderColor:
                          "var(--border-color)",

                        backgroundColor:
                          "var(--soft-bg)",
                      }}
                    >
                      {isSale && (
                        <span
                          className="
                            absolute
                            left-2
                            top-2
                            z-10
                            rounded-full
                            bg-red-500
                            px-2
                            py-1
                            text-[10px]
                            font-bold
                            text-white
                          "
                        >
                          SALE
                        </span>
                      )}

                      {upcoming && (
                        <span
                          className="
                            absolute
                            left-2
                            top-2
                            z-10
                            rounded-full
                            bg-blue-500
                            px-2
                            py-1
                            text-[10px]
                            font-bold
                            text-white
                          "
                        >
                          UPCOMING
                        </span>
                      )}

                      {ended && (
                        <span
                          className="
                            absolute
                            left-2
                            top-2
                            z-10
                            rounded-full
                            bg-gray-500
                            px-2
                            py-1
                            text-[10px]
                            font-bold
                            text-white
                          "
                        >
                          ENDED
                        </span>
                      )}

                      {product.thumbnail ? (
                        <Image
                          src={
                            product.thumbnail
                          }
                          alt={
                            product.name
                          }
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                      ) : (
                        <div
                          className="
                            flex
                            h-full
                            items-center
                            justify-center
                            text-sm
                          "
                          style={{
                            color:
                              "var(--muted-foreground)",
                          }}
                        >
                          {
                            t.no_image
                          }
                        </div>
                      )}
                    </div>

                    {/* CONTENT */}

                    <div className="min-w-0 flex-1">
                      <h3
                        className="
                          line-clamp-2
                          text-sm
                          font-semibold
                        "
                        style={{
                          color:
                            "var(--foreground)",
                        }}
                      >
                        {
                          product.name
                        }
                      </h3>

                      {/* PRICE */}

                      <div className="mt-2">
                        {display.sale_price ? (
                          <>
                            <p
                              className="
                                text-xs
                                line-through
                              "
                              style={{
                                color:
                                  "var(--muted-foreground)",
                              }}
                            >
                              {formatPi(
                                display.price
                              )}
                            </p>

                            <p
                              className="
                                text-lg
                                font-bold
                              "
                              style={{
                                color:
                                  "#ef4444",
                              }}
                            >
                              {formatPi(
                                display.sale_price
                              )}
                            </p>
                          </>
                        ) : (
                          <p
                            className="
                              text-lg
                              font-bold
                            "
                            style={{
                              color:
                                "#f97316",
                            }}
                          >
                            {formatPi(
                              display.price
                            )}
                          </p>
                        )}
                      </div>

                
{/* INFO */}

<div
  className="
    mt-3
    flex
    flex-wrap
    gap-2
  "
>
  <span
    className="
      rounded-full
      px-3
      py-1
      text-[11px]
      font-medium
    "
    style={{
      backgroundColor:
        "var(--soft-bg)",

      color:
        "var(--foreground)",
    }}
  >
    {t.stock}:{" "}
    {product.stock}
  </span>

  <span
    className="
      rounded-full
      px-3
      py-1
      text-[11px]
      font-medium
    "
    style={{
      backgroundColor:
        "var(--soft-bg)",

      color:
        "var(--foreground)",
    }}
  >
    {t.sold}:{" "}
    {product.sold}
  </span>
</div>
                    </div>
                  </div>

                  {/* ACTIONS */}

                  <div
                    className="
                      flex
                      border-t
                    "
                    style={{
                      borderColor:
                        "var(--border-color)",
                    }}
                  >
                    <button
                      onClick={() =>
                        router.push(
                          `/seller/edit/${product.id}`
                        )
                      }
                      className="
                        flex
                        flex-1
                        items-center
                        justify-center
                        gap-2
                        py-3
                        text-sm
                        font-medium
                        transition-all
                        active:scale-[0.98]
                      "
                      style={{
                        color:
                          "var(--foreground)",
                      }}
                    >
                      <Pencil
                        size={16}
                      />

                      {t.edit}
                    </button>

                    <div
                      className="w-px"
                      style={{
                        backgroundColor:
                          "var(--border-color)",
                      }}
                    />

                    <button
                      onClick={() =>
                  setDeleteTarget(product)
                    }
                      className="
                        flex
                        flex-1
                        items-center
                        justify-center
                        gap-2
                        py-3
                        text-sm
                        font-medium
                        text-red-500
                        transition-all
                        active:scale-[0.98]
                      "
                    >
                      <Trash2
                        size={16}
                      />

                      {t.delete}
                    </button>
                  </div>
                </div>
              );
            }
          )}
        </section>
      </div>
      {/* DELETE MODAL */}

      {deleteTarget && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-end
            bg-black/50
            backdrop-blur-sm
          "
        >
          <div
            className="
  w-full
  rounded-t-3xl
  p-5
  mb-20
"
            style={{
              backgroundColor:
                "var(--card-bg)",
            }}
          >
            <div
              className="
                mx-auto
                mb-4
                h-1.5
                w-14
                rounded-full
                bg-gray-300
              "
            />

            <h2
              className="
                text-lg
                font-bold
              "
              style={{
                color:
                  "var(--foreground)",
              }}
            >
              {t.delete_product}
            </h2>

            <p
              className="
                mt-2
                text-sm
              "
              style={{
                color:
                  "var(--muted-foreground)",
              }}
            >
              {t.confirm_delete_product}
            </p>

            <p
              className="
                mt-2
                line-clamp-2
                text-sm
                font-semibold
              "
              style={{
                color:
                  "var(--foreground)",
              }}
            >
              {deleteTarget.name}
            </p>

            <div
              className="
                mt-6
                flex
                gap-3
              "
            >
              {/* CANCEL */}

              <button
                onClick={() =>
                  setDeleteTarget(
                    null
                  )
                }
                className="
  flex-1
  rounded-2xl
  py-3
  text-sm
  font-medium
  bg-[var(--card-secondary)]
  text-[var(--foreground)]
  active:scale-95
"
                style={{
                  backgroundColor:
                    "var(--soft-bg)",

                  color:
                    "var(--foreground)",
                }}
              >
                {t.cancel}
              </button>

              {/* DELETE */}

              <button
                onClick={
                  handleDelete
                }
                disabled={
                  deleting
                }
                className="
  flex-1
  rounded-2xl
  py-3
  text-sm
  font-medium
  text-white
  bg-[var(--color-primary)]
  hover:bg-[var(--color-primary-dark)]
  disabled:opacity-50
  active:scale-95
"
              >
                {deleting
               ? t.deleting
               : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
