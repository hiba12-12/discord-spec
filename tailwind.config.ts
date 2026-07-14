import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        discord: {
          "bg-primary": "#313338",
          "bg-secondary": "#2b2d31",
          "bg-tertiary": "#1e1f22",
          "bg-floating": "#111214",
          "text-normal": "#dbdee1",
          "text-muted": "#949ba4",
          "text-link": "#00a8fc",
          brand: "#5865f2",
          "brand-hover": "#4752c4",
          online: "#23a559",
          offline: "#80848e",
          danger: "#f23f42",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
