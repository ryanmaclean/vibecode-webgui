import nextConfig from "eslint-config-next/core-web-vitals";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
  // TODO: Re-enable Next.js config when scopeManager compatibility is resolved
  // The ...nextConfig spread causes "scopeManager.addGlobals is not a function" error with ESLint 10.0.2
  // Issue: eslint-config-next@16.1.6 + ESLint@10.0.2 incompatibility
  // ...nextConfig,
  {
    ignores: [
      "*.js",
      "*.cjs",
      "*.mjs",
      "src/components/__mocks__/",
      "src/instrument.cjs",
      "src/lib/ai/*.js",
      "node_modules/**",
      "dist/**",
      ".next/**",
      "build/**",
      "docs/**",
      "daemon/**",
      "platforms/**",
      "extensions/**",
      "config/**",
      "release-archive/**",
      "src-tauri/**",
      "go/**",
      "bin/**",
      ".claude/**",
      ".auto-claude/**",
    ],
  },
  {
    settings: {
      react: { version: "19.2" },
    },
    rules: {
      "no-console": "off",
      "no-debugger": "off",
      "no-unreachable": "off",
      "no-duplicate-imports": "off",
      "@next/next/no-img-element": "off",
      "import/no-anonymous-default-export": "off",
      "jsx-a11y/alt-text": "off",
      "react-hooks/exhaustive-deps": "off",
      // eslint-plugin-react 7.x not yet compatible with ESLint 10 API
      "react/display-name": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
    },
    rules: {
      // Strict type safety rules
      "@typescript-eslint/no-explicit-any": "error",

      // Prevent common errors
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",

      // Code quality
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",

      // Disable base ESLint rules that are handled by TypeScript
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
  {
    // Test files get relaxed rules for type safety
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/__tests__/**/*.ts",
      "**/__tests__/**/*.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "no-console": "off",
    },
  },
];
