import nextConfig from "eslint-config-next/core-web-vitals";

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
];
