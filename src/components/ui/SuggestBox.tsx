interface SuggestBoxProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Fired when the user presses Enter (Shift+Enter still inserts a newline). */
  onSubmit?: () => void;
}

/** Free-text "describe your mood" input used in the Customize screens. */
export function SuggestBox({ label, placeholder, value, onChange, onSubmit }: SuggestBoxProps) {
  return (
    <label className="block rounded-2xl border border-line bg-surface p-4">
      <span className="text-xs text-sub">{label}</span>
      <textarea
        rows={2}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
        className="mt-2 w-full resize-none border-b border-line bg-transparent pb-2 text-sm text-ink outline-none placeholder:text-faint"
      />
      <span className="mt-2 block text-[11px] text-faint">Press Enter to spin · Shift+Enter for a new line</span>
    </label>
  );
}
