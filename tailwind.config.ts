import type { Config } from "tailwindcss";

/**
 * Colors are driven by CSS variables (see globals.scss) so the accent can
 * switch between Music and Movies modes via a single [data-mode] attribute.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        ink: "var(--ink)",
        sub: "var(--sub)",
        faint: "var(--faint)",
        accent: "var(--accent)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      maxWidth: {
        app: "460px",
      },
    },
  },
  plugins: [],
};

export default config;
