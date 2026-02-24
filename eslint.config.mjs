import nextConfig from "eslint-config-next/core-web-vitals";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
  ...nextConfig,
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
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-unused-vars": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**/*.ts", "**/__tests__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
];
