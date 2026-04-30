import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        /* Dim dashboard shell — easy on the eyes vs stark white */
        c2: {
          bg: "#12151c",
          surface: "#1a1f2e",
          elevated: "#232b3d",
          border: "#354057",
          text: "#e8ecf4",
          muted: "#94a3b8",
          accent: "#3b82f6",
          accentMuted: "#60a5fa",
          success: "#22c55e",
          warning: "#eab308",
          danger: "#ef4444",
          sidebar: "#171c29",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        glow: "0 1px 2px rgb(0 0 0 / 0.15)",
        card: "0 1px 3px rgb(0 0 0 / 0.22), 0 1px 2px rgb(0 0 0 / 0.18)",
      },
      backgroundImage: {
        "gradient-primary":
          "linear-gradient(135deg, #2563eb 0%, #3b82f6 55%, #60a5fa 100%)",
        "gradient-card":
          "linear-gradient(145deg, rgba(26,31,46,1) 0%, rgba(22,27,41,1) 100%)",
        "gradient-violet":
          "linear-gradient(135deg, #2563eb 0%, #3b82f6 45%, #60a5fa 100%)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "JetBrains Mono", "monospace"],
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
