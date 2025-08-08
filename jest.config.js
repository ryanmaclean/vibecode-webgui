/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./tests/jest.setup.js'],
  setupFiles: ['./tests/jest.polyfills.js'],
  modulePaths: ['<rootDir>'],
  
  // Increase timeout for integration tests
  testTimeout: 30000,
  
  moduleNameMapper: {
    '^lucide-react$': '<rootDir>/__mocks__/lucide-react.js',
    '^@/components/ui$': '<rootDir>/src/components/ui',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    '^@/samples/(.*)$': '<rootDir>/src/samples/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.*\\.mjs$))',
  ],
  
  // Test environment options
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
  ],
  
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/',
  ],

  // Use Babel for transformation to avoid SWC issues
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { 
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
      ]
    }],
  },

  // Extensions to handle
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
};

module.exports = config;
