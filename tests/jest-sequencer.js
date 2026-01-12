const Sequencer = require('@jest/test-sequencer').default;

/**
 * Custom test sequencer that runs slow tests first to maximize parallelization efficiency.
 * Slow tests are identified by known patterns or test file paths.
 */
class CustomSequencer extends Sequencer {
  // Known slow test files (>5s execution time based on baseline)
  static SLOW_TESTS = new Set([
    'tests/monitoring/alert-validation.test.ts',
    'tests/integration/litellm-integration.test.ts',
    'tests/integration/datadog-e2e-infrastructure.test.ts',
    'tests/integration/vm-providers.test.ts',
    'tests/unit/agents/openai-client.test.ts',
    'tests/integration/enhanced-terminal-integration.test.ts',
    'tests/mocks/ai-generation-service.test.ts',
  ]);

  sort(tests) {
    const copyTests = Array.from(tests);

    // Separate slow and fast tests
    const slowTests = [];
    const fastTests = [];

    copyTests.forEach((test) => {
      const testPath = test.path;
      const isSlowTest = Array.from(CustomSequencer.SLOW_TESTS).some((slowPath) =>
        testPath.includes(slowPath)
      );

      if (isSlowTest) {
        slowTests.push(test);
      } else {
        fastTests.push(test);
      }
    });

    // Run slow tests first to start them early, then fast tests
    // This maximizes CPU utilization with parallel workers
    return [...slowTests, ...fastTests];
  }
}

module.exports = CustomSequencer;
