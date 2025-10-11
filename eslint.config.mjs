import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow unused parameters prefixed with underscore
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      // Allow any type for now (can be gradually improved)
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow require imports where needed
      "@typescript-eslint/no-require-imports": "warn",
      // Allow React hooks dependencies to be handled manually
      "react-hooks/exhaustive-deps": "warn",
      // Allow unused imports temporarily (can be cleaned up later)
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }],
      // Prefer const assertions for better type inference
      "prefer-const": "error",
      // Enforce explicit return types for functions (improves maintainability)
      "@typescript-eslint/explicit-function-return-type": "off",
      // Allow console.log in development
      "no-console": process.env.NODE_ENV === "production" ? "error" : "warn"
    }
  },
  {
    files: ["scripts/vector-db-migrations/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
}, {
  files: ["scripts/vector-db-migrations/**/*.js"],
  rules: {
    "@typescript-eslint/no-require-imports": "off"
  }
}];

export default eslintConfig;
