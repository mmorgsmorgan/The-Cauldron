/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ritual: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#c8f7c5",
          300: "#a8f0a0",
          400: "#86e67a",
          500: "#6bd65f",
          600: "#4ade80",
          700: "#22c55e",
          800: "#16a34a",
          900: "#15803d",
          950: "#0a5c2a",
        },
        mint: {
          DEFAULT: "#c8f7c5",
          light: "#ddfbdb",
          dark: "#a3e89e",
          muted: "rgba(200, 247, 197, 0.6)",
        },
        dark: {
          950: "#040f0a",
          900: "#061a10",
          800: "#0a2e1f",
          700: "#0e3d29",
          600: "#134d34",
          500: "#1a5e40",
          400: "#1e6e4a",
          300: "#2a7d56",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      animation: {
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(200, 247, 197, 0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(200, 247, 197, 0.3)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
