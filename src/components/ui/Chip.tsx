interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  /** Static chips (e.g. result metadata) render as non-interactive. */
  readOnly?: boolean;
}

export function Chip({ label, selected = false, onClick, readOnly = false }: ChipProps) {
  const base = "rounded-full px-3.5 py-2 text-[13px] transition";
  if (readOnly) {
    return <span className={`${base} border border-line text-sub`}>{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${base} active:scale-95 ${
        selected ? "bg-accent font-semibold text-white" : "border border-line text-sub hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
