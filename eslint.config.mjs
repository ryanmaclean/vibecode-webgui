import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "*.config.js",
      "*.config.mjs"
    ]
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
        crypto: 'readonly'
      }
    },
    rules: {
      // General JavaScript rules
      "prefer-const": "error",
      "no-var": "error",
      "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
      "no-debugger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }]
    }
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
        crypto: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin
    },
    rules: {
      // Disable base rules that are covered by TypeScript equivalents
      "no-unused-vars": "off",
      
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      
      // General rules
      "prefer-const": "error",
      "no-var": "error",
      "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
      "no-debugger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error"
    }
  },
  {
    files: ["scripts/**/*.{js,ts}", "**/*.config.{js,mjs,ts}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off" // Allow console in scripts and config files
    }
  },
  {
    files: ["**/*.test.{js,ts,tsx}", "**/*.spec.{js,ts,tsx}", "**/__tests__/**/*.{js,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off" // Allow console in tests
    }
  }
];