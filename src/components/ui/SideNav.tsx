"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { NAV_ITEMS } from "./BottomNav";

/**
 * Desktop (lg+) primary navigation: a persistent left sidebar that replaces the mobile
 * BottomNav, giving the app a desktop-app shell on wide screens. Hidden below lg, where
 * the BottomNav is shown instead. Shares NAV_ITEMS with the BottomNav.
 */
export function SideNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface/75 px-3 py-5 backdrop-blur lg:flex"
    >
      <div className="mb-4 flex items-center gap-2 px-3">
        <Logo size={32} className="rounded-lg" />
        <span className="text-lg font-bold">Spynder</span>
      </div>
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-surface-2 text-ink" : "text-sub hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon name={icon} size={20} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
