/**
 * Jest configuration for accessibility testing
 * Specialized configuration for WCAG 2.1 AA compliance testing
 */

import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/accessibility/jest-axe-setup.js'
  ],
  
  // Test file patterns for accessibility tests
  testMatch: [
    '<rootDir>/tests/accessibility/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.a11y.test.{js,jsx,ts,tsx}'
  ],
  
  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Coverage configuration for accessibility tests
  collectCoverageFrom: [
    'src/components/**/*.{js,jsx,ts,tsx}',
    'src/app/**/*.{js,jsx,ts,tsx}',
    'src/lib/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/_*.{js,jsx,ts,tsx}'
  ],
  
  // Coverage thresholds specific to accessibility
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/components/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  
  // Test timeout for accessibility tests (may take longer)
  testTimeout: 30000,
  
  // Verbose output for detailed accessibility reporting
  verbose: true,
  
  // Custom reporters for accessibility results
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: '.test-results/accessibility/html',
        filename: 'accessibility-jest-report.html',
        pageTitle: 'WCAG 2.1 AA Accessibility Test Results',
        logoImgPath: './docs/assets/vibecode-logo.png',
        hideIcon: false,
        expand: true,
        openReport: false
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: '.test-results/accessibility',
        outputName: 'accessibility-junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],
  
  // Global test configuration for accessibility
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    },
    // Accessibility testing globals
    __ACCESSIBILITY_TESTING__: true,
    __WCAG_LEVEL__: 'AA'
  },
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  }
}

// Create and export the Jest configuration
export default createJestConfig(customJestConfig)