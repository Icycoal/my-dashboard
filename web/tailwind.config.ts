import type { Config } from "tailwindcss";

// Design tokens: the whole app references `gray` (ink surfaces) and `blue`
// (iris accent), so the palette is remapped here instead of per-component.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gray: {
          50: "#f7f8fb",
          100: "#eef0f5",
          200: "#dde1ea",
          300: "#c2c8d6",
          400: "#97a0b5",
          500: "#69718a",
          600: "#323a4d",
          700: "#232938",
          750: "#1d2230",
          800: "#181c28",
          900: "#11141d",
          950: "#0a0c12",
        },
        blue: {
          50: "#f0f1ff",
          100: "#e3e5ff",
          200: "#c9cdff",
          300: "#a7adff",
          400: "#858cff",
          500: "#666eff",
          600: "#5158f0",
          700: "#4247d1",
          800: "#363aa8",
          900: "#2f3387",
          950: "#1c1e52",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        md: "0.625rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        DEFAULT:
          "inset 0 1px 0 0 rgba(255,255,255,0.03), 0 8px 24px -12px rgba(0,0,0,0.5)",
        glow: "0 0 24px -6px rgba(102,110,255,0.45)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "fade-in": "fade-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
