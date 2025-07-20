/**
 * Jest Configuration for Testing Without Docker/KIND Dependencies
 * Optimized for running tests that focus on real API integrations
 * without requiring containerized services
 */

const baseConfig = require('./jest.config.js')

module.exports = {
  ...baseConfig,
  
  // Test environment optimized for API testing
  testEnvironment: 'node',
  
  // Longer timeouts for real API calls
  testTimeout: 60000,
  
  // Test patterns that don't require Docker/KIND
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/k8s/',           // Skip Kubernetes tests
    '<rootDir>/tests/docker/',        // Skip Docker tests
    '<rootDir>/tests/chaos/',         // Skip chaos engineering tests
    '<rootDir>/tests/monitoring/alert-validation.test.ts', // Skip tests that require external services
    '<rootDir>/tests/performance/system-metrics-validation.test.ts' // Skip system metrics tests
  ],
  
  // Environment variables for real API testing
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/tests/setup/no-docker-setup.js'
  ],
  
  // Global setup for real API tests
  globalSetup: '<rootDir>/tests/setup/global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.js',
  
  // Collect coverage from actual implementation files
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/test-utils.{ts,tsx}',
    // Focus on key areas for coverage
    'src/lib/vector-store.ts',
    'src/lib/datadog-llm.ts',
    'src/app/api/ai/**/*.ts',
    'src/components/ai/**/*.tsx'
  ],
  
  // Coverage thresholds for real functionality
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // Higher thresholds for critical AI/RAG functionality
    'src/lib/vector-store.ts': {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85
    },
    'src/app/api/ai/chat/stream/route.ts': {
      branches: 75,
      functions: 85,
      lines: 80,
      statements: 80
    }
  },
  
  // Reporters optimized for CI/development without Docker
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'no-docker-results.xml',
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ],
  
  // Module name mapping for easier imports
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Transform configuration for TypeScript
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
      ],
      plugins: ['@babel/plugin-syntax-import-attributes']
    }]
  },
  
  // Clear mocks between tests for isolation
  clearMocks: true,
  restoreMocks: true,
  
  // Enhanced error reporting
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  
  // Test suites to run specifically for no-docker testing
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.{ts,tsx}',
    '<rootDir>/tests/integration/real-*.test.{ts,tsx}',
    '<rootDir>/tests/integration/vector-search-*.test.{ts,tsx}',
    '<rootDir>/tests/integration/ai-chat-*.test.{ts,tsx}',
    '<rootDir>/tests/security/**/*.test.{ts,tsx}',
    '<rootDir>/tests/integration/collaboration-*.test.{ts,tsx}'
  ]
}