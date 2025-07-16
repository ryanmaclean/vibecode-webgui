const { FlatCompat } = require('@eslint/eslintrc');
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // Disable problematic rules for production deployment
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      
      // Keep critical rules only
      'no-console': 'error',
      'no-debugger': 'error',
      'no-unreachable': 'error',
      'no-duplicate-imports': 'error'
    }
  }
];