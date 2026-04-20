"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Grid,
  Bell,
  User,
  Search,
} from "lucide-react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useEffect, useState } from "react";

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const [hide, setHide] = useState(false);
  const [lastScroll, setLastScroll] = useState(0);

  /* ================= SCROLL HIDE ================= */
  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;

      if (current > lastScroll && current > 80) {
        setHide(true); // scroll xuống → ẩn
      } else {
        setHide(false); // scroll lên → hiện
      }

      setLastScroll(current);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScroll]);

  /* ================= NAV ITEMS ================= */
  const navItems = [
    { href: "/", label: t.home || "Home", icon: Home },
    { href: "/categories", label: t.categories || "Categories", icon: Grid },
    { href: "/search", label: t.search || "Search", icon: Search },
    {
      href: "/notifications",
      label: t.notifications || "Notifications",
      icon: Bell,
      badge: 3, // demo
    },
    { href: "/account", label: t.me || "Me", icon: User },
  ];

  return (
    <nav
  className={`
    fixed left-0 right-0 bottom-0 z-50
    transition-transform duration-300
    ${hide ? "translate-y-full" : "translate-y-0"}
  `}
  style={{
    paddingBottom: "env(safe-area-inset-bottom)",
    height: "60px",
    // ✅ thêm dòng này
    ["--bottom-nav-height" as any]: "60px",
  }}
>
      {/* GLASS BACKGROUND */}
      <div className="backdrop-blur-lg bg-white/80 border-t border-gray-200 shadow-lg">
        <div className="flex justify-around items-center h-[60px] relative">
          
          {/* ACTIVE SLIDE INDICATOR */}
          <ActiveIndicator pathname={pathname} />

          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href));

            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center flex-1 relative active:scale-90 transition"
              >
                {/* ICON */}
                <div className="relative">
                  <Icon
                    className={`
                      w-6 h-6 transition-all duration-300
                      ${active
                        ? "text-orange-500 scale-125"
                        : "text-gray-400"}
                    `}
                  />

                  {/* BADGE */}
                  {badge && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
                      {badge}
                    </span>
                  )}
                </div>

                {/* LABEL */}
                <span
                  className={`
                    text-[10px] mt-1 transition-all duration-200
                    ${active
                      ? "text-orange-500 font-medium opacity-100"
                      : "opacity-0 absolute"}
                  `}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ================= ACTIVE INDICATOR ================= */
function ActiveIndicator({ pathname }: { pathname: string }) {
  const routes = ["/", "/categories", "/search", "/notifications", "/account"];

  const index = routes.findIndex((r) =>
    pathname === r || (r !== "/" && pathname.startsWith(r))
  );

  return (
    <div
      className="absolute top-0 left-0 w-1/5 flex justify-center transition-all duration-300"
      style={{
        transform: `translateX(${index * 100}%)`,
      }}
    >
      <div className="w-8 h-1 bg-orange-500 rounded-full mt-1 animate-pulse" />
    </div>
  );
}
