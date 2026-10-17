import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f6f5f2",
        surface: "#ffffff",
        sunken: "#efeee9",
        line: "#e4e2dc",
        ink: "#1d1d1b",
        muted: "#5d5c57",
        faint: "#97958e",
        accent: { DEFAULT: "#256abf", soft: "#e3eefb", deep: "#1c5cab" },
        danger: { DEFAULT: "#c2410c", soft: "#fdeee6" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,20,15,0.05), 0 1px 1px rgba(20,20,15,0.03)",
        pop: "0 10px 30px rgba(20,20,15,0.14)",
      },
    },
  },
  plugins: [],
};
export default config;
