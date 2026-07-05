import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Quiet neutral system — pastels come from the data, everything else stays disciplined.
        canvas: "#F7F8FA",     // app background (white-ish, per requirement #8)
        surface: "#FFFFFF",    // cards / panels
        line: "#E7E9EE",       // hairline borders
        ink: "#1F2933",        // primary text
        muted: "#6B7280",      // secondary text
        faint: "#9AA1AC",      // tertiary / disabled
        accent: "#2E3440",     // interactive (buttons, active states)
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        pop: "0 10px 30px rgba(16,24,40,0.12)",
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
