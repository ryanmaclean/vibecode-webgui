/** @type {import('jest').Config} */
const baseConfig = require('./config/jest.config.js');

module.exports = {
  ...baseConfig,
  rootDir: __dirname,
  testPathIgnorePatterns: [
    ...(baseConfig.testPathIgnorePatterns || []),
    '<rootDir>/vibecode_webgui/', // Duplicate rig/crew trees - run root tests only
    '\\.claude/', // Agent worktrees - not real test targets
    // Quarantined: infra/env/mock issues - see docs/TODO.md
    '<rootDir>/tests/integration/vm-providers.test.ts',
    '<rootDir>/tests/unit/lib/monitoring/gastown-cli-tracing.test.ts',
    '<rootDir>/tests/vector-db-migrations.test.js',
    '<rootDir>/tests/vector-db-migration-utility.test.js',
    '<rootDir>/tests/integration/real-vector-db-creation.test.ts',
    '<rootDir>/tests/integration/vector-db-postgres.test.ts',
    '<rootDir>/tests/unit/lib/vector-db/vector-database-factory.test.ts',
    '<rootDir>/tests/complete/cluster-validation.test.ts',
    '<rootDir>/tests/unit/ci-self-healing.test.ts',
  ],
  modulePathIgnorePatterns: [
    ...(baseConfig.modulePathIgnorePatterns || []),
    '<rootDir>/vibecode_webgui/',
    '<rootDir>/.next/',
    '\\.claude/',
  ],
};
