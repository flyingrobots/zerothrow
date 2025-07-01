import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module"
      }
    },
    rules: {
      "no-throw-literal": "error"
    }
  },
  {
    files: ["*.config.{ts,js}", "eslint.config.js"],
    rules: {}
  }
];
