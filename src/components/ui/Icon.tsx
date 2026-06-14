import type { SVGProps } from "react";

export type IconName =
  | "dice"
  | "shuffle"
  | "popcorn"
  | "note"
  | "play"
  | "pause"
  | "volume"
  | "mute"
  | "heart"
  | "heartFilled"
  | "open"
  | "skip"
  | "star"
  | "clock"
  | "user"
  | "sliders"
  | "close"
  | "chevron";

// Minimal line icons (stroke = currentColor) carried over from the SVG mockups.
const PATHS: Record<IconName, React.ReactNode> = {
  dice: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  shuffle: (
    <>
      <path d="M2 18h2.5c1.3 0 2.5-.6 3.3-1.7l6.4-8.6c.8-1.1 2-1.7 3.3-1.7H22" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 6h2.5c1.3 0 2.5.6 3.3 1.7l.9 1.2" />
      <path d="M22 18h-4.9c-1.3 0-2.5-.6-3.3-1.7l-.9-1.2" />
      <path d="m18 14 4 4-4 4" />
    </>
  ),
  popcorn: (
    <>
      <path d="M5 8h14l-2 13H7L5 8Z" />
      <path d="M8 8v13M12 8v13M16 8v13" />
    </>
  ),
  note: (
    <>
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </>
  ),
  play: <path d="M7 5l12 7-12 7V5Z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" stroke="none" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" stroke="none" />
      <path d="M16 9.5l4 5M20 9.5l-4 5" />
    </>
  ),
  heart: <path d="M12 20s-7-4.6-9.2-9C1.3 8 3 4.5 6.5 4.5 9 4.5 12 7 12 7s3-2.5 5.5-2.5C21 4.5 22.7 8 21.2 11 19 15.4 12 20 12 20Z" />,
  heartFilled: (
    <path
      d="M12 20s-7-4.6-9.2-9C1.3 8 3 4.5 6.5 4.5 9 4.5 12 7 12 7s3-2.5 5.5-2.5C21 4.5 22.7 8 21.2 11 19 15.4 12 20 12 20Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  open: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
    </>
  ),
  skip: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6 18.4 18.4" />
    </>
  ),
  star: <path d="M12 3.5l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.9 6.9 18.9 8 13.3 3.8 9.4l5.7-.7L12 3.5Z" fill="currentColor" stroke="none" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="14" cy="7" r="2.4" fill="var(--bg)" />
      <circle cx="9" cy="17" r="2.4" fill="var(--bg)" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="M9 6l6 6-6 6" />,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 22, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
