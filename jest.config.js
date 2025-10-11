/** @type {import('jest').Config} */
const includeDocs = process.env.JEST_INCLUDE_DOCS === '1';
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/tests/setupTests.ts',
    '<rootDir>/tests/jest.setup.js',
    '<rootDir>/tests/accessibility/jest-axe-setup.js'
  ],
  setupFiles: ['<rootDir>/tests/jest.polyfills.js'],
  modulePaths: ['<rootDir>'],
  
  // Increase timeout for integration tests
  testTimeout: 30000,
  
  moduleNameMapper: {
    '^lucide-react$': '<rootDir>/__mocks__/lucide-react.js',
    '^@/components/ui$': '<rootDir>/src/components/ui',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/samples/(.*)$': '<rootDir>/src/samples/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/cssModule.js',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
  },
  
  // Transform settings
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-typescript', { allowNamespaces: true }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ],
      plugins: [
        ['@babel/plugin-proposal-decorators', { legacy: true }],
        ['@babel/plugin-proposal-class-properties', { loose: true }],
        '@babel/plugin-transform-runtime'
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
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/comprehensive/', 
    '<rootDir>/docs/e2e/', 
    '<rootDir>/code-server/', 
    '<rootDir>/packages/vibecode-cli/src/__tests__/', 
    '/__mocks__/', 
    ...(includeDocs ? [] : ['<rootDir>/tests/docs/']),
  ],
  
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],

  // Fix haste map collision
  haste: {
    enableSymlinks: false,
  },
  
  // Clear mock calls and instances between tests
  clearMocks: true,
  resetMocks: true,
  
  // Module Directories
  moduleDirectories: ['node_modules', 'src'],
  
  // Watch Plugins
  watchPlugins: [
    // Removed jest-watch-typeahead as it's not installed
  ],
  
  // Reporters
  reporters: [
    'default',
<<<<<<< HEAD
    // Write JUnit to a hidden, ignored folder to avoid accidental commits
    ['jest-junit', { outputDirectory: '.test-results', outputName: 'junit.xml' }],
=======
    // Removed jest-junit as it might not be installed
>>>>>>> fix/consolidated-dependency-updates
  ],
  
  // Coverage
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
