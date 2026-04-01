import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(28 22% 80%)",
        input: "hsl(28 22% 80%)",
        ring: "hsl(17 78% 46%)",
        background: "hsl(38 45% 97%)",
        foreground: "hsl(216 30% 14%)",
        primary: {
          DEFAULT: "hsl(17 78% 46%)",
          foreground: "hsl(36 60% 98%)",
        },
        secondary: {
          DEFAULT: "hsl(35 52% 90%)",
          foreground: "hsl(216 30% 18%)",
        },
        muted: {
          DEFAULT: "hsl(35 30% 93%)",
          foreground: "hsl(218 16% 38%)",
        },
        accent: {
          DEFAULT: "hsl(156 30% 86%)",
          foreground: "hsl(160 30% 18%)",
        },
        card: {
          DEFAULT: "hsl(42 42% 99%)",
          foreground: "hsl(216 30% 14%)",
        },
      },
      borderRadius: {
        lg: "1.15rem",
        md: "0.9rem",
        sm: "0.65rem",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(52, 39, 24, 0.12)",
        float: "0 24px 70px rgba(36, 24, 12, 0.16)",
      },
    },
  },
  plugins: [],
} satisfies Config;
