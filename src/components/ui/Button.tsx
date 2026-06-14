import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost";

// Each variant gets a distinct pressed look so taps register clearly.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white active:brightness-110",
  outline: "border border-accent text-accent active:bg-accent active:text-white",
  ghost: "border border-line text-ink active:bg-surface-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition-[transform,background-color,filter] duration-100 active:scale-[0.96] disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
