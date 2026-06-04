/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#05080c",
        surface: "#0e1218",
        panel:   "#0a0d12",
        card:    "#11161d",
        border:  "#1e293b", // slate-800
        accent:  "#00E5FF",
        "accent-dim": "#0077FF",
        text:    "#e2e8f0", // slate-200
        muted:   "#64748b", // slate-500
        danger:  "#FF0055",
        warn:    "#FF0055",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
