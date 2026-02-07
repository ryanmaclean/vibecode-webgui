/** @type {import('jest').Config} */
const includeDocs = process.env.JEST_INCLUDE_DOCS === '1';
const config = {
  rootDir: './',
  testEnvironment: 'jsdom',
  globalSetup: '<rootDir>/tests/jest.globalSetup.js',
  setupFilesAfterEnv: [
    '<rootDir>/tests/setupTests.ts',
    '<rootDir>/tests/jest.setup.js',
    '<rootDir>/tests/accessibility/jest-axe-setup.js'
  ],
  setupFiles: ['<rootDir>/tests/jest.polyfills.js'],
  modulePaths: ['<rootDir>'],

  // Performance optimization: Enable parallelization
  maxWorkers: process.env.CI ? 2 : '50%',

  // Performance optimization: Run slow tests first for better parallelization
  testSequencer: '<rootDir>/tests/jest-sequencer.js',

  // Increase timeout for integration tests
  testTimeout: 30000,

  moduleNameMapper: {
    '^y-leveldb$': '<rootDir>/tests/__mocks__/y-leveldb.js',
    '^y-websocket/bin/utils$': '<rootDir>/tests/__mocks__/y-websocket/bin/utils.js',
    '^lucide-react$': '<rootDir>/__mocks__/lucide-react.js',
    '^@/design-system/(.*)$': '<rootDir>/src/design-system/$1',
    '^@/components/ui$': '<rootDir>/src/components/ui',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/samples/(.*)$': '<rootDir>/src/samples/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/middleware$': '<rootDir>/src/middleware.ts',
    '^@/middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@/providers/(.*)$': '<rootDir>/src/providers/$1',
    '^@/instrument$': '<rootDir>/src/instrument.ts',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/cssModule.js',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
  },

  // Transform settings (simplified to avoid missing dependencies)
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-typescript', { allowNamespaces: true }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },

  transformIgnorePatterns: [
    '/node_modules/(?!(.*\\.mjs$|@codemirror|@lezer|@codemirror/))',
  ],

  // Test environment options
  testEnvironmentOptions: {
    customExportConditions: [''],
  },

  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/index.{js,jsx,ts,tsx}',
  ],

  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],

  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/', // Playwright tests - run with 'npm run test:e2e'
    '<rootDir>/tests/comprehensive/', // Playwright tests - run with 'npm run test:e2e'
    '<rootDir>/docs/e2e/', // Playwright tests - run with 'npm run test:e2e'
    '<rootDir>/azure/', // Azure SwiftUI apps - Playwright tests excluded from Jest runs
    '\\.spec\\.[jt]sx?$', // Exclude all Playwright-style .spec.ts files from Jest
    '<rootDir>/archive/', // Archived code and tests - excluded from Jest runs
    '<rootDir>/code-server/',
    '<rootDir>/openvscode-server/',
    '/openvscode-server/',
    '/extensions/', // VSCode extension tests - have their own test runner
    '<rootDir>/packages/vibecode-cli/src/__tests__/', // CLI tests - run with 'cd packages/vibecode-cli && npm test'
    '/dist/', // Exclude built test files from discovery
    '/__mocks__/',
    '<rootDir>/config/alternatives/',
    '<rootDir>/examples/',
    '<rootDir>/services/ai-gateway/', // AI Gateway has its own jest config - run with 'cd services/ai-gateway && npm test'
    ...(includeDocs ? [] : ['<rootDir>/tests/docs/']),
  ],

  // Prevent haste-map collisions from duplicate directories
  modulePathIgnorePatterns: [
    '<rootDir>/archive/', // Archived code - excluded from Jest module resolution
    '<rootDir>/docs/archive/old-builds/',
    '<rootDir>/vibecode-optimized/',
    '<rootDir>/vibecode-v1.4a-package/',
    '<rootDir>/src/extensions/', // Extensions have their own package.json files
  ],

  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],

  // Fix haste map collision
  haste: {
    enableSymlinks: false,
  },

  // Clear mock calls and instances between tests
  clearMocks: true,

  // Reset module registry between each test to prevent state pollution
  resetModules: false,

  // Restore all mocks between tests
  restoreMocks: false,

  // Reset mock state between tests
  resetMocks: false,

  // Module Directories
  moduleDirectories: ['node_modules', 'src'],

  // Reporters
  reporters: [
    'default',
    ...(process.env.CI ? [
      ['jest-junit', {
        outputDirectory: './test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      }],
    ] : []),
  ],

  // Coverage
  coverageDirectory: 'coverage',
  coverageReporters: [
    'json',
    'json-summary',
    'lcov',
    'text',
    'text-summary',
    'clover',
    'html',
    ...(process.env.CI ? ['cobertura'] : []),
  ],
  coverageThreshold: {
    global: {
      branches: 19,   // Current: 19.35% - increased from 18% (AGENT 101)
      functions: 22,  // Current: 22.13% - increased from 20% (AGENT 101)
      lines: 25,      // Current: 25.07% - increased from 24% (AGENT 114) - 25% MILESTONE ACHIEVED
      statements: 23, // Current: 23.94% - increased from 22% (AGENT 101)
    },
  },

  // Coverage path ignore patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/coverage/',
    '/dist/',
    '/build/',
    '/__mocks__/',
    '/__tests__/',
    '/tests/',
    '.config.js',
    '.config.ts',
  ],
};

module.exports = config;
