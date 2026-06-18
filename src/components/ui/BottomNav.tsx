"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

// Shared by the mobile BottomNav and the desktop SideNav so the primary nav stays in one place.
export const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Discover", icon: "dice" },
  { href: "/favorites", label: "Saved", icon: "heart" },
  { href: "/history", label: "History", icon: "clock" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    // Mobile/tablet only — desktop (lg+) uses the SideNav in the app shell instead.
    <nav aria-label="Primary" className="sticky bottom-0 z-10 mt-auto flex items-center justify-around border-t border-line bg-bg/90 py-2.5 backdrop-blur lg:hidden">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 px-4 text-[10px] transition active:scale-90 ${active ? "text-ink" : "text-faint"}`}
          >
            <Icon name={icon} size={20} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
