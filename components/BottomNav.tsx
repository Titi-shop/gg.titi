"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid2X2, Search, Bell, User } from "lucide-react";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useEffect, useState } from "react";

export default function BottomNav() {
const pathname = usePathname();
const { t } = useTranslation();

const [hidden, setHidden] = useState(false);
const [lastScroll, setLastScroll] = useState(0);

useEffect(() => {
const onScroll = () => {
const current = window.scrollY;
setHidden(current > lastScroll && current > 80);
setLastScroll(current);
};

window.addEventListener("scroll", onScroll);  
return () => window.removeEventListener("scroll", onScroll);

}, [lastScroll]);

const navItems = [
{ href: "/", label: t.home || "Home", icon: Home },
{ href: "/categories", label: t.categories || "Categories", icon: Grid2X2 },
{ href: "/search", label: t.search || "Search", icon: Search, center: true },
{ href: "/notifications", label: t.notifications || "Notifications", icon: Bell, badge: 2 },
{ href: "/account", label: t.me || "Me", icon: User },
];

return (
<>
<div className="h-[76px]" />

<nav  
    className={`  
      fixed bottom-0 left-0 right-0 z-50  
      transition-transform duration-300  
      ${hidden ? "translate-y-full" : "translate-y-0"}  
    `}  
    style={{  
      backgroundColor: "var(--nav-bg)",  
      color: "var(--nav-text)",  
      borderTop: "1px solid var(--nav-border)",  
      paddingBottom: "env(safe-area-inset-bottom)",  
    }}  
  >  
    <div className="mx-auto max-w-md">  
      <div className="flex h-[64px] items-center justify-around px-2">  

        {navItems.map(({ href, label, icon: Icon, badge, center }) => {  
          const active =  
            pathname === href ||  
            (href !== "/" && pathname.startsWith(href));  

          const color = active  
            ? "var(--nav-active)"  
            : "var(--nav-muted)";  

          if (center) {  
            return (  
              <Link key={href} href={href} className="relative -mt-7 flex flex-col items-center">  
                <div  
                  style={{  
                    backgroundColor: active  
                      ? "var(--nav-active)"  
                      : "var(--nav-muted)",  
                    color: "#fff",  
                  }}  
                  className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white shadow-lg"  
                >  
                  <Icon size={22} />  
                </div>  

                <span className="mt-1 text-[10px]" style={{ color: "var(--nav-muted)" }}>  
                  {label}  
                </span>  
              </Link>  
            );  
          }  

          return (  
            <Link  
              key={href}  
              href={href}  
              className="relative flex flex-1 flex-col items-center justify-center"  
            >  
              <Icon size={22} style={{ color }} />  

              {badge && (  
                <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">  
                  {badge}  
                </span>  
              )}  

              <span className="mt-1 text-[10px]" style={{ color }}>  
                {label}  
              </span>  
            </Link>  
          );  
        })}  

      </div>  
    </div>  
  </nav>  
</>

);
}
