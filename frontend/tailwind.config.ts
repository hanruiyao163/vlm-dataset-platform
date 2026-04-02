import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(228 18% 88%)",
        input: "hsl(228 18% 88%)",
        ring: "hsl(245 58% 51%)",
        background: "hsl(228 28% 95.5%)",
        foreground: "hsl(230 25% 13%)",
        primary: {
          DEFAULT: "hsl(245 58% 51%)",
          foreground: "hsl(0 0% 100%)",
        },
        secondary: {
          DEFAULT: "hsl(230 22% 92%)",
          foreground: "hsl(230 18% 20%)",
        },
        muted: {
          DEFAULT: "hsl(228 18% 89%)",
          foreground: "hsl(228 10% 48%)",
        },
        accent: {
          DEFAULT: "hsl(168 42% 92%)",
          foreground: "hsl(168 45% 25%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
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
        soft: "0 2px 8px rgba(80, 80, 130, 0.06), 0 8px 28px rgba(80, 80, 130, 0.09)",
        float: "0 8px 32px rgba(80, 80, 130, 0.14), 0 2px 10px rgba(80, 80, 130, 0.07)",
      },
    },
  },
  plugins: [],
} satisfies Config;
