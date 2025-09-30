import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [{
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".backup/**",
    "docs/.astro/**",
    "docs/dist/**",
    "docs/node_modules/**",
    "_tools/**",
    "scripts/integrate-error-tracking.ts",
    "scripts/test-multimodal.js",
    ".archive/**",
    "code-server/**",
    "web-dashboard/**",
    "docker/**",
    "docs/e2e/**",
    "examples/**",
    "extensions/**",
    "packages/**"
  ]
}, ...compat.extends("next/core-web-vitals", "next/typescript"), {
  rules: {
    // Allow unused parameters prefixed with underscore
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    // Allow any type for now (can be gradually improved)
    "@typescript-eslint/no-explicit-any": "warn",
    // Allow require imports where needed
    "@typescript-eslint/no-require-imports": "warn",
    // Allow React hooks dependencies to be handled manually
    "react-hooks/exhaustive-deps": "warn"
  }
}, {
  files: ["scripts/vector-db-migrations/**/*.js"],
  rules: {
    "@typescript-eslint/no-require-imports": "off"
  }
}, {
  files: ["code-server/**"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-unused-vars": "off"
  }
}, {
  files: ["web-dashboard/**"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "import/no-anonymous-default-export": "off"
  }
}, {
  files: ["__mocks__/**"],
  rules: {
    "@typescript-eslint/no-require-imports": "off"
  }
}, {
  files: ["tests/**/*.{ts,tsx,js,jsx}"],
  rules: {
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "import/no-anonymous-default-export": "off"
  }
}, {
  files: ["**/*.cjs", "**/.eslintrc.*"],
  rules: {
    "@typescript-eslint/no-require-imports": "off"
  }
}];

export default eslintConfig;
