/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // v4 -> v3 compat: tokens the migrated frontend_friend JSX relies on.
      borderRadius: { '4xl': '2rem' },
      spacing: { '15': '3.75rem', '25': '6.25rem', '30': '7.5rem', '50': '12.5rem' },
    },
  },
  plugins: [],
};
