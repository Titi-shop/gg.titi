"use client";

import useSWR from "swr";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

interface Banner {
  id: number | string;
  image: string;
  title?: string;
  link?: string;
}

const fetcher = async (url: string): Promise<Banner[]> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Failed to fetch banners");
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

export default function BannerCarousel() {
  const { data: banners = [] } = useSWR(
    "/api/banners",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000,
      keepPreviousData: true,
    }
  );

  if (banners.length === 0) return null;

  return (
    <div className="relative w-screen -mx-5 overflow-hidden">
      <Swiper
        modules={[Pagination, Autoplay]}
        pagination={{ clickable: true }}
        autoplay={{
          delay: 3500,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        loop={banners.length > 1}
        className="h-48 md:h-60 w-screen"
      >
        {banners.map((b) => {
          const imageSrc = b.image.startsWith("/")
            ? b.image
            : `/${b.image}`;

          return (
            <SwiperSlide key={b.id}>
              <a
                href={b.link || "#"}
                className="relative block h-full"
              >
                <img
                  src={imageSrc}
                  alt={b.title || "banner"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

                {b.title && (
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="inline-block rounded-xl bg-black/40 px-3 py-1 text-xs text-white backdrop-blur-md">
                      {b.title}
                    </div>
                  </div>
                )}
              </a>
            </SwiperSlide>
          );
        })}
      </Swiper>

      <style jsx global>{`
        .swiper-pagination-bullet {
          background: rgba(255, 255, 255, 0.5);
          opacity: 1;
          width: 6px;
          height: 6px;
          transition: all 0.25s ease;
        }

        .swiper-pagination-bullet-active {
          background: #f97316;
          width: 18px;
          border-radius: 999px;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 ring-1 ring-orange-400/20" />
    </div>
  );
}
