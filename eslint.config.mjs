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
      // Enforce TypeScript best practices - upgraded to errors
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }],
      // Gradually restrict any types - upgraded to error for new code
      "@typescript-eslint/no-explicit-any": "error",
      // Enforce explicit return types for maintainability
      "@typescript-eslint/explicit-function-return-type": ["error", {
        "allowExpressions": true,
        "allowTypedFunctionExpressions": true,
        "allowHigherOrderFunctions": true,
        "allowDirectConstAssertionInArrowFunctions": true
      }],
      // Require explicit return types for exported functions
      "@typescript-eslint/explicit-module-boundary-types": "error",
      // Enforce consistent interface naming
      "@typescript-eslint/naming-convention": [
        "error",
        {
          "selector": "interface",
          "format": ["PascalCase"],
          "custom": {
            "regex": "^I[A-Z]",
            "match": false
          }
        },
        {
          "selector": "typeAlias",
          "format": ["PascalCase"]
        },
        {
          "selector": "enum",
          "format": ["PascalCase"]
        }
      ],
      // Enforce consistent error handling patterns
      "@typescript-eslint/prefer-promise-reject-errors": "error",
      "@typescript-eslint/no-throw-literal": "error",
      // Require imports where needed - allow for compatibility
      "@typescript-eslint/no-require-imports": "warn",
      // Strict React hooks dependencies
      "react-hooks/exhaustive-deps": "error",
      // Enforce const for immutable bindings
      "prefer-const": "error",
      // Disallow console statements - use structured logger instead
      "no-console": "error",
      // Enforce consistent async/await patterns
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/require-await": "error",
      // Prevent common JavaScript pitfalls
      "eqeqeq": ["error", "always"],
      "no-var": "error",
      "prefer-arrow-callback": "error"
    }
  },
  {
    files: ["scripts/vector-db-migrations/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off"
    }
  },
  {
    files: ["scripts/**/*.{js,ts}", "**/*.config.{js,ts,mjs}", "src/lib/logger.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/explicit-function-return-type": "off"
    }
  }
];

export default eslintConfig;
