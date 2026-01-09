import createNextJestConfig from 'next/jest.js'

const createJestConfig = createNextJestConfig({ dir: './' })

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/tests/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock modules that are imported but not installed
    '^y-leveldb$': '<rootDir>/tests/__mocks__/y-leveldb.js',
    '^y-websocket/bin/utils$': '<rootDir>/tests/__mocks__/y-websocket-utils.js',
  },
  modulePathIgnorePatterns: ['<rootDir>/extensions/', '<rootDir>/.next/', '<rootDir>/openvscode-server/', '<rootDir>/fast-openvscode-vm/'],
  coveragePathIgnorePatterns: [],
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'] }],
  },
  transformIgnorePatterns: ['node_modules/(?!(ky))/'],
  // Memory and performance settings
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB',
  // Force garbage collection between tests
  logHeapUsage: false,
}

export default createJestConfig(customJestConfig)
