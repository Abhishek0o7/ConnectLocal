import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#7C5CFC", light: "rgba(124,92,252,0.16)", mid: "#A78BFA", dark: "#C9B8FF" },
        green: { DEFAULT: "#33E6A0", light: "rgba(51,230,160,0.14)", dark: "#33E6A0" },
        red: { DEFAULT: "#FF5C7A", light: "rgba(255,92,122,0.14)" },
        yellow: { DEFAULT: "#FFC24B", light: "rgba(255,194,75,0.14)" },
        pink: { DEFAULT: "#E84393", light: "rgba(232,67,147,0.14)" },
        coral: { DEFAULT: "#FF7A59", light: "rgba(255,122,89,0.14)" },
        bg: "#0B0A14",
        surface: "#17152A",
        surface2: "#1E1B38",
        ink: "#F5F3FF",
        muted: "#9B96B8",
        hairline: "rgba(255,255,255,0.08)",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        display: ["Unbounded", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
      },
      backgroundImage: {
        aurora: "linear-gradient(135deg, #7C5CFC 0%, #E84393 55%, #FF7A59 100%)",
        "aurora-soft": "linear-gradient(135deg, rgba(124,92,252,0.25) 0%, rgba(232,67,147,0.25) 55%, rgba(255,122,89,0.25) 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
