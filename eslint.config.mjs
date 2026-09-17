import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

// Cut by environment rather than by directory: src/ now holds both browser code
// (assets/js) and Node code (_data), so a single src/** block would hand Node
// files the browser globals and flag their require/module.exports.
export default defineConfig([
  {
    files: ["src/assets/js/**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      "src/_data/**/*.{js,mjs,cjs}",
      "config/**/*.{js,mjs,cjs}",
      ".eleventy.js",
    ],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["test/**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },
]);
