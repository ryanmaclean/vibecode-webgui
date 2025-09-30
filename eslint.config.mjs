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
    "scripts/**",
    "server/**",
    "services/**",
    "tests/**",
    "src/__mocks__/**",
    "src/app/__tests__/**",
    "src/app/ai-advanced-features-demo/**",
    "src/app/ai-code-review-demo/**",
    "src/app/api/ai/**",
    "src/samples/**",
    "src/types/azure-search-documents.ts",
    "src/types/collaboration-shims.d.ts",
    "src/middleware/security-middleware.ts",
    ".archive/**",
    "code-server/**",
    "web-dashboard/**",
    "docker/**",
    "docs/e2e/**",
    "examples/**",
    "extensions/**",
    "src/extensions/**/out/**",
    "src/components/__mocks__/**",
    "packages/**"
  ]
}, ...compat.extends("next/core-web-vitals", "next/typescript"), {
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-require-imports": "error",
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
  files: ["scripts/**/*.js"],
  rules: {
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "no-unused-vars": "off"
  }
}, {
  files: ["**/*.cjs", "**/.eslintrc.*"],
  rules: {
    "@typescript-eslint/no-require-imports": "off"
  }
}, {
  files: [
    "src/instrument.ts",
    "src/lib/monitoring/**/*.ts",
    "src/lib/server-monitoring.ts",
    "src/lib/datadog-llm.ts",
    "src/lib/automation/error-tracking-node.ts",
    "src/extensions/vibecode-ai-assistant/src/code-generator.ts"
  ],
  rules: {
    "@typescript-eslint/no-require-imports": "off"
  }
}];

export default eslintConfig;
