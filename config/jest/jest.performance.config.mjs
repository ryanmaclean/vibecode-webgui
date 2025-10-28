/**
 * Jest Configuration for Performance Tests
 * 
 * Dedicated configuration for running performance tests
 * with appropriate timeouts and test environment
 */

import createNextJestConfig from 'next/jest.js'

const createJestConfig = createNextJestConfig({ dir: './' })

const performanceJestConfig = {
  displayName: 'performance',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/performance/**/*.test.ts',
    '<rootDir>/tests/performance/**/*.test.js'
  ],
  testTimeout: 30000, // 30 seconds for performance tests
  setupFilesAfterEnv: ['<rootDir>/tests/performance-jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/extensions/', '<rootDir>/.next/'],
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-typescript'] }],
  },
  collectCoverage: false, // Performance tests don't need coverage
  verbose: true,
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'performance-test-results.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
}

export default createJestConfig(performanceJestConfig)
