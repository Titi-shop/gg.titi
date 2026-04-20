/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* 🔥 THEME SYSTEM */
        primary: "var(--color-primary)",
        "primary-dark": "var(--color-primary-dark)",
      },
    },
  },
  plugins: [],
};
