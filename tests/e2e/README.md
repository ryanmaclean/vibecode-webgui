# E2E Test Suite

Comprehensive end-to-end test suite for VibeCode WebGUI using Playwright.

## Overview

This E2E test suite provides comprehensive coverage of critical user journeys and application functionality:

### Test Categories

1. **Authentication Flow** (`auth-flow.test.ts`)
   - Login/logout functionality
   - Authentication state management
   - Registration flow
   - Error handling

2. **AI Features** (`ai-features.test.ts`)
   - AI chat interface
   - Code generation
   - Prompt handling
   - Response processing
   - Error scenarios

3. **Workspace Management** (`workspace-management.test.ts`)
   - Project creation
   - File operations
   - Code editor functionality
   - Workspace navigation

4. **UI Responsiveness** (`ui-responsiveness.test.ts`)
   - Mobile/tablet/desktop layouts
   - Cross-browser compatibility
   - Touch interactions
   - Performance validation

5. **Critical User Journeys** (`critical-user-journeys.test.ts`)
   - Complete development workflows
   - New user onboarding
   - Error recovery scenarios
   - Performance under load

6. **Accessibility** (`accessibility.test.ts`)
   - WCAG 2.1 AA compliance
   - Keyboard navigation
   - Screen reader compatibility
   - Color contrast validation

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Specific Test Categories
```bash
npm run test:e2e:auth        # Authentication tests
npm run test:e2e:ai          # AI features tests
npm run test:e2e:workspace   # Workspace management tests
npm run test:e2e:responsive  # Responsive design tests
npm run test:e2e:journeys    # Critical user journeys
npm run test:e2e:a11y        # Accessibility tests
```

### Debug Mode
```bash
npm run test:e2e:headed      # Run with browser UI visible
```

### Test Reports
```bash
npm run test:e2e:report      # View HTML test report
```

## Configuration

Tests are configured via `playwright.config.ts` with:

- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Base URL**: http://localhost:3000
- **Timeouts**: 60s test timeout, 15s action timeout
- **Artifacts**: Screenshots on failure, videos on failure
- **Reports**: HTML, JSON, JUnit formats

## Test Helpers

The `utils/test-helpers.ts` provides reusable utilities:

- **Page Management**: `waitForPageReady()`, `takeScreenshot()`
- **Authentication**: `login()`, `logout()`
- **AI Interactions**: `submitAIPrompt()`, `waitForAIResponse()`
- **Accessibility**: `checkAccessibility()`
- **Performance**: `checkPagePerformance()`
- **Error Handling**: `checkForErrors()`

## Environment Requirements

### Development Server
Tests require the application to be running on `http://localhost:3000`:
```bash
npm run dev
```

### Test Data
Some tests may require:
- Test user credentials (`test@vibecode.com` / `testpass123`)
- API endpoints to be available
- Database in a clean state

### Browser Dependencies
Playwright browsers are installed automatically:
```bash
npx playwright install
```

## Test Strategy

### Coverage Areas

1. **Functional Testing**
   - Core application features
   - User interactions
   - API integrations
   - Error scenarios

2. **Cross-Browser Testing**
   - Chrome, Firefox, Safari compatibility
   - Mobile browser testing
   - Feature parity across browsers

3. **Accessibility Testing**
   - WCAG compliance validation
   - Keyboard navigation
   - Screen reader compatibility
   - Color contrast verification

4. **Performance Testing**
   - Page load times
   - Response times
   - Memory usage
   - Network efficiency

### Test Patterns

- **Page Object Pattern**: Reusable test helpers
- **Data-Driven Testing**: Multiple viewport/browser combinations
- **Error Simulation**: Network failures, API errors
- **Progressive Enhancement**: Graceful degradation testing

## CI/CD Integration

Tests run automatically in GitHub Actions with:

- Parallel execution across browsers
- Artifact collection (screenshots, videos)
- Test result reporting
- Performance metrics tracking

## Debugging

### Local Debugging
```bash
# Run specific test with debug
npx playwright test tests/e2e/auth-flow.test.ts --debug

# Run with trace viewer
npx playwright test --trace on
```

### Screenshots and Videos
Test artifacts are saved to:
- Screenshots: `test-results/screenshots/`
- Videos: `test-results/videos/`
- Traces: `test-results/traces/`

### Common Issues

1. **Application Not Running**: Ensure `npm run dev` is running
2. **Timing Issues**: Use `waitForPageReady()` helper
3. **Authentication**: Check test user credentials
4. **Flaky Tests**: Add appropriate waits and retries

## Contributing

When adding new E2E tests:

1. Use the test helpers from `utils/test-helpers.ts`
2. Follow existing test patterns
3. Add appropriate accessibility checks
4. Include error scenario testing
5. Update this README with new test categories
6. Add new test commands to package.json

### Example Test Structure
```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = createTestHelpers(page);
    await helpers.login(); // If authentication required
  });

  test('should perform specific functionality', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    // Test implementation
    await page.goto('/feature');
    await helpers.waitForPageReady();
    
    // Assertions
    await expect(page.locator('selector')).toBeVisible();
    
    // Accessibility check
    await helpers.checkAccessibility();
    
    // Screenshot for verification
    await helpers.takeScreenshot('feature-test');
  });
});
```

## Monitoring and Metrics

E2E tests track:
- Test execution time
- Success/failure rates
- Browser-specific issues
- Performance regressions
- Accessibility violations

Results are integrated with Datadog monitoring for continuous quality tracking.