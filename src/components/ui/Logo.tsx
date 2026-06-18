/**
 * The Spynder brand mark — the same gradient dice used as the app favicon
 * (see src/app/icon.svg), inlined so it scales crisply and can be reused in the
 * UI (e.g. the desktop SideNav) instead of the plain monochrome `dice` Icon.
 */
export function Logo({ size = 32, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Spynder"
      {...props}
    >
      <defs>
        {/* the three mode accents: music (blue) → movies (clay) → books (sage) */}
        <linearGradient id="spynder-logo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4f7fd6" />
          <stop offset="0.5" stopColor="#c89642" />
          <stop offset="1" stopColor="#5fb255" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#spynder-logo)" />
      <rect x="7" y="7" width="18" height="18" rx="5" fill="none" stroke="#ffffff" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" fill="#ffffff" />
      <circle cx="16" cy="16" r="2" fill="#ffffff" />
      <circle cx="20" cy="20" r="2" fill="#ffffff" />
    </svg>
  );
}
