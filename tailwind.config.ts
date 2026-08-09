import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EDEFE9", // pale sage-gray paper, not the default cream
        ink: "#1C2B39", // deep slate-navy, primary text
        brass: "#B8863B", // key-fob brass, primary accent
        teal: "#1F5C52", // shared-space green, secondary accent
        rust: "#A6472A", // alerts / destructive
        line: "#CFCABC", // hairline borders
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        tag: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
