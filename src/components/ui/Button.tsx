import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white",
  outline: "border border-accent text-accent",
  ghost: "border border-line text-ink",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
