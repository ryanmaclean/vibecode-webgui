# Datadog Toto Test Observability

## Overview

Toto is Datadog's test observability solution that provides end-to-end visibility into your test execution. This document explains how to use Toto with VibeCode's test suite to gain insights into test performance, flakiness, and reliability.

## Prerequisites

- Datadog API key with test management permissions
- Datadog Application Key
- `@datadog/toto` package installed
- Node.js 16+ environment

## Installation

1. Install the required package:

```bash
npm install --save-dev @datadog/toto
```

2. Set up environment variables in your `.env` file:

```env
DD_API_KEY=your_api_key_here
DD_APP_KEY=your_app_key_here
DD_SITE=datadoghq.com  # or your Datadog site
ENABLE_DATADOG_TESTS=true
```

## Basic Usage

### Writing Toto-Enabled Tests

```typescript
import { TotoTest } from '@datadog/toto';

describe('Login Flow', () => {
  let totoTest;

  beforeAll(() => {
    totoTest = new TotoTest({
      apiKey: process.env.DD_API_KEY,
      appKey: process.env.DD_APP_KEY,
      site: process.env.DD_SITE || 'datadoghq.com',
      service: 'vibecode-webgui',
      env: process.env.NODE_ENV || 'test'
    });
  });

  test('user can login successfully', async () => {
    const testSpan = await totoTest.startTest({
      name: 'vibecode.webui.login_success',
      suite: 'vibecode-webui-e2e',
      startTime: Date.now(),
      tags: {
        'test.type': 'e2e',
        'test.framework': 'jest',
        'test.team': 'platform'
      }
    });

    try {
      // Test steps
      await testSpan.addStep('navigate_to_login', { url: '/login' });
      await testSpan.addStep('enter_credentials', { username: 'testuser' });
      
      // Assertions
      const isLoggedIn = true; // Replace with actual test logic
      await testSpan.addStep('verify_login', { success: isLoggedIn });
      
      // Mark test as passed
      await testSpan.end({
        result: 'pass',
        duration: 1000,
        metrics: {
          'test.duration': 1000,
          'test.steps': 3
        }
      });
      
      expect(isLoggedIn).toBe(true);
    } catch (error) {
      await testSpan.end({
        result: 'fail',
        error: error.message,
        metrics: {
          'test.failed': 1
        }
      });
      throw error;
    }
  });
});
```

## Test Suites

Toto supports grouping related tests into suites for better organization:

```typescript
describe('E2E Test Suite', () => {
  let suiteSpan;
  
  beforeAll(async () => {
    suiteSpan = await toto.startTestSuite({
      name: 'vibecode-e2e-suite',
      startTime: Date.now(),
      tags: {
        'test.type': 'e2e',
        'test.framework': 'jest',
        'test.team': 'platform'
      }
    });
  });

  afterAll(async () => {
    await suiteSpan.end({
      result: 'pass',
      duration: 5000 // Total suite duration
    });
  });

  // Individual tests...
});
```

## Best Practices

1. **Tagging**: Use consistent tags for filtering in Datadog:
   - `test.type`: e2e, unit, integration
   - `test.framework`: jest, cypress, playwright
   - `test.team`: platform, web, backend

2. **Error Handling**: Always wrap test execution in try/catch to ensure proper test closure

3. **Step Granularity**: Break tests into meaningful steps for better observability

4. **Metrics**: Include relevant metrics like duration, step counts, and custom business metrics

## Viewing Results

1. Navigate to **CI Visibility > Test Runs** in Datadog
2. Filter by service: `service:vibecode-webgui`
3. Analyze test performance, flakiness, and trends

## Troubleshooting

- **Missing test data**: Verify API keys and ensure tests are properly closed with `end()`
- **Permission issues**: Check API key permissions in Datadog
- **Timeouts**: Increase test timeouts for long-running tests

## Reference

- [Datadog Toto Documentation](https://docs.datadoghq.com/continuous_testing/)
- [Test Observability Best Practices](https://docs.datadoghq.com/continuous_testing/best_practices/)
