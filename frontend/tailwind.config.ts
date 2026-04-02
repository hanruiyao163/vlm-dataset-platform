import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(228 16% 86%)",
        input: "hsl(228 14% 88%)",
        ring: "hsl(245 48% 52%)",
        background: "hsl(228 24% 95%)",
        foreground: "hsl(230 25% 13%)",
        primary: {
          DEFAULT: "hsl(245 48% 48%)",
          foreground: "hsl(0 0% 100%)",
        },
        secondary: {
          DEFAULT: "hsl(230 18% 93%)",
          foreground: "hsl(230 15% 22%)",
        },
        muted: {
          DEFAULT: "hsl(228 14% 90%)",
          foreground: "hsl(228 8% 46%)",
        },
        accent: {
          DEFAULT: "hsl(168 35% 92%)",
          foreground: "hsl(168 40% 26%)",
        },
        card: {
          DEFAULT: "hsl(240 20% 99%)",
          foreground: "hsl(230 25% 13%)",
        },
        destructive: {
          DEFAULT: "hsl(0 72% 51%)",
          foreground: "hsl(0 0% 100%)",
        },
      },
      borderRadius: {
        lg: "1.15rem",
        md: "0.9rem",
        sm: "0.65rem",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(60, 60, 110, 0.04), 0 6px 24px rgba(60, 60, 110, 0.08)",
        float: "0 8px 32px rgba(60, 60, 110, 0.14), 0 2px 8px rgba(60, 60, 110, 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
