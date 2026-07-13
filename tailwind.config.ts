import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        purple: "var(--purple)",
        "purple-mid": "var(--purple-mid)",
        lime: "var(--lime)",
        white: "var(--white)",
        muted: "var(--muted)",
        "muted-2": "var(--muted-2)",
        border: "var(--border)",
        hairline: "var(--hairline)",
        cat: {
          business: "var(--cat-business)",
          technology: "var(--cat-technology)",
          culture: "var(--cat-culture)",
          sports: "var(--cat-sports)",
          agro: "var(--cat-agro)",
        },
      },
      fontFamily: {
        // Space Grotesk — UI, labels, kickers (Linear / Apple Pro cadence)
        sans: ["var(--font-space-grotesk)", "sans-serif"],
        // Fraunces — editorial serif for display and pull quotes
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        // Inter — body text
        body: ["var(--font-inter)", "sans-serif"],
      },
      fontSize: {
        kicker: ["0.72rem", { lineHeight: "1", letterSpacing: "0.2em" }],
        standfirst: ["1.2rem", { lineHeight: "1.6", letterSpacing: "-0.005em" }],
        title: ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        headline: [
          "clamp(1.9rem, 3.2vw, 2.9rem)",
          { lineHeight: "1.08", letterSpacing: "-0.015em" },
        ],
        display: [
          "clamp(2.75rem, 5vw, 4.75rem)",
          { lineHeight: "1.02", letterSpacing: "-0.02em" },
        ],
      },
      maxWidth: {
        prose: "68ch",
      },
      boxShadow: {
        // Softer, neutral elevation — calm, not glassy
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 44px -28px rgba(0,0,0,0.75)",
        elevated:
          "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 30px 70px -24px rgba(0,0,0,0.85)",
        // Retained for compatibility; softened
        lime: "0 0 0 1px color-mix(in srgb, var(--lime) 30%, transparent), 0 10px 30px -12px color-mix(in srgb, var(--lime) 25%, transparent)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "blur-in": {
          "0%": { opacity: "0", filter: "blur(8px)" },
          "100%": { opacity: "1", filter: "blur(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shine: {
          "0%": { "background-position": "0% 0%" },
          "50%": { "background-position": "100% 100%" },
          to: { "background-position": "0% 0%" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "blur-in": "blur-in 0.5s ease-out both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        shine: "shine var(--duration) infinite linear",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
