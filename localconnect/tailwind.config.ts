import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#5B4FE8", light: "#EEEDFE", mid: "#AFA9EC", dark: "#3C3489" },
        green: { DEFAULT: "#1D9E75", light: "#E1F5EE", dark: "#085041" },
        red: { DEFAULT: "#D85A30", light: "#FAECE7" },
        yellow: { DEFAULT: "#BA7517", light: "#FAEEDA" },
        pink: { DEFAULT: "#D4537E", light: "#FBEAF0" },
        bg: "#F4F3FF",
        surface: "#ffffff",
        ink: "#1A1834",
        muted: "#8884A0",
        hairline: "rgba(91,79,232,0.12)",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Sora", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
