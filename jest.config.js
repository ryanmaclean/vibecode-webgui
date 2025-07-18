const nextJest = require('next/jest')

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({ dir: './' })

// Custom Jest configuration
const customJestConfig = {
  // Test environment
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/tests/__mocks__/@/$1',
    '^lucide-react$': '<rootDir>/tests/__mocks__/lucide-react.tsx',
  },

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.test.{js,jsx,ts,tsx}',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'server/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/layout.tsx',
    '!src/app/**/loading.tsx',
    '!src/app/**/not-found.tsx',
    '!src/app/**/error.tsx',
    '!**/node_modules/**',
    '!**/.next/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Test timeout
  testTimeout: 10000,

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@testing-library|@playwright))',
  ],

  // Transform configuration - use babel.config.js
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest'
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.{js,ts,tsx}'],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.{js,ts}'],
      testEnvironment: 'node',
    },
    {
      displayName: 'validation',
      testMatch: ['<rootDir>/tests/validation/**/*.test.{js,ts}'],
      testEnvironment: 'node',
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/tests/performance/**/*.test.{js,ts}'],
      testEnvironment: 'node',
    },
    {
      displayName: 'chaos',
      testMatch: ['<rootDir>/tests/chaos/**/*.test.{js,ts}'],
      testEnvironment: 'node',
    },
    {
      displayName: 'k8s',
      testMatch: ['<rootDir>/tests/k8s/**/*.test.{js,ts}'],
      testEnvironment: 'node',
    },
    {
      displayName: 'docker',
      testMatch: ['<rootDir>/tests/docker/**/*.test.{js,ts}'],
      testEnvironment: 'node',
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/tests/security/**/*.test.{js,ts}'],
      testEnvironment: 'node',
    },
    {
      displayName: 'monitoring',
      testMatch: ['<rootDir>/tests/monitoring/**/*.test.{js,ts}'],
      testEnvironment: 'node',
    },
    {
      displayName: 'complete',
      testMatch: ['<rootDir>/tests/complete/**/*.test.{js,ts}'],
      testEnvironment: 'node',
    },
    {
      displayName: 'accessibility',
      testMatch: ['<rootDir>/tests/accessibility/**/*.test.{js,ts,tsx}'],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'ai-workflow',
      testMatch: ['<rootDir>/tests/integration/ai-project-generation.test.ts', '<rootDir>/tests/integration/workspace-creation.test.ts'],
      testEnvironment: 'node',
    },
    {
      displayName: 'ai-components',
      testMatch: ['<rootDir>/tests/unit/ai-project-generator.test.tsx'],
      testEnvironment: 'jsdom',
    },
  ],
}

// Export Jest configuration with Next.js settings
module.exports = createJestConfig(customJestConfig)
