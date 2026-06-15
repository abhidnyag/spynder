"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

interface ScreenHeaderProps {
  title: string;
  /** Optional right-aligned text action (e.g. "Reset", "Clear"). */
  action?: { label: string; onClick: () => void };
  /** Show a back chevron that pops the history stack. */
  back?: boolean;
  /** Show a close (X) button that pops the history stack. */
  close?: boolean;
}

export function ScreenHeader({ title, action, back, close }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <header className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {back && (
          <button type="button" onClick={() => router.back()} aria-label="Back" className="text-sub">
            <Icon name="chevron" size={20} className="rotate-180" />
          </button>
        )}
        <h1 className="text-base font-bold">{title}</h1>
      </div>
      {action && (
        <button type="button" onClick={action.onClick} className="text-[13px] text-sub">
          {action.label}
        </button>
      )}
      {close && (
        <button type="button" onClick={() => router.back()} aria-label="Close" className="text-sub">
          <Icon name="close" size={18} />
        </button>
      )}
    </header>
  );
}
