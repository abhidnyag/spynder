interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group (e.g. "Mode", "Type"). */
  label?: string;
}

/** Pill segmented control used for the Music/Movies switch and movie type. */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-xl border border-line p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition ${
              active ? "bg-accent text-white" : "text-sub"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
