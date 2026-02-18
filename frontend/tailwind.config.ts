import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b0b0b",
        card: "#f8f8f6",
        line: "#232323",
        accent: "#9e7a34",
        bg: "#efefec",
      },
      fontFamily: {
        cairo: ["Cairo", "Segoe UI", "sans-serif"],
        ruqaa: ["Aref Ruqaa", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
