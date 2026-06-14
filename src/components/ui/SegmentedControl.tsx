interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Pill segmented control used for the Music/Movies switch and movie type. */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-1 rounded-xl border border-line p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
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
