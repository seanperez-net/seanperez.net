/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */

const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4: the CSS entry the plugin reads the theme from, and the functions whose
  // arguments are class lists (tailwind-variants `tv`, and our `cn`).
  tailwindStylesheet: "./src/dev.css",
  tailwindFunctions: ["tv", "cn"],
};

export default config;
