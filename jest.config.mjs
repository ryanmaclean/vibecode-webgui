import createNextJestConfig from 'next/jest.js'

const createJestConfig = createNextJestConfig({ dir: './' })

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/tests/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/extensions/', '<rootDir>/.next/'],
  coveragePathIgnorePatterns: [],
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'] }],
  },
  transformIgnorePatterns: ['node_modules/(?!(ky))/'],
}

export default createJestConfig(customJestConfig)
