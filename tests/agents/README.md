# OpenAI Agents Testing Suite

Comprehensive testing suite for the OpenAI Agents integration.

## Quick Start

```bash
# Install dependencies
npm install

# Run all agent tests
npm test -- --testPathPatterns=agents

# Run specific test suite
npm run test:unit -- --testPathPatterns=agents/unit
npm run test:integration -- --testPathPatterns=agents/integration
npm run test:e2e -- tests/agents/e2e/
```

## Test Structure

```
tests/agents/
├── unit/              # Unit tests for core functionality
├── integration/       # Integration tests with API
├── e2e/              # End-to-end UI tests
├── mocks/            # Mock API server
├── fixtures/         # Test data and utilities
├── contract/         # API contract tests
├── chaos/            # Chaos engineering tests
├── accessibility/    # Accessibility tests
└── performance/      # Performance regression tests
```

## Test Categories

### Unit Tests

Test individual components in isolation:
- Agent initialization
- Message processing
- Tool execution
- Memory management
- Specialized agent types

**Run**: `npm run test:unit -- --testPathPatterns=agents/unit`

### Integration Tests

Test workflows with real API interactions:
- Multi-turn conversations
- Tool chains
- Agent workflows
- Error handling

**Run**: `npm run test:integration -- --testPathPatterns=agents/integration`

### E2E Tests

Test complete user workflows through UI:
- Agent creation
- Agent management
- Real-time updates
- Responsive design

**Run**: `npm run test:e2e -- tests/agents/e2e/`

### Contract Tests

Ensure OpenAI API compliance:
- Request format
- Response format
- Tool definitions
- Error handling

**Run**: `npm test -- --testPathPatterns=agents/contract`

### Chaos Tests

Test system resilience:
- Network failures
- Rate limiting
- Memory pressure
- Tool failures

**Run**: `npm test -- --testPathPatterns=agents/chaos`

### Accessibility Tests

Ensure WCAG compliance:
- Keyboard navigation
- Screen reader support
- Color contrast
- ARIA labels

**Run**: `npx playwright test tests/agents/accessibility/`

### Performance Tests

Track performance metrics:
- Response times
- Memory usage
- Token optimization
- Page load times

**Run**: `npm test -- --testPathPatterns=agents/performance`

## Writing Tests

### Basic Test Structure

```typescript
import { Agent, createAgent } from '@/lib/agent-framework';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', async () => {
    // Arrange
    const agent = createAgent({ model: 'gpt-4o-mini' });

    // Act
    const result = await agent.processMessage('Test');

    // Assert
    expect(result.content).toBeDefined();
  });
});
```

### Using Mock Server

```typescript
import { setupMockServer, setMockChatResponse } from '../mocks/openai-api-server';

describe('With Mock Server', () => {
  setupMockServer();

  it('should use mock response', async () => {
    setMockChatResponse('Mocked response');

    const agent = createAgent({ model: 'gpt-4o' });
    const response = await agent.processMessage('Test');

    expect(response.content).toBe('Mocked response');
  });
});
```

### Using Fixtures

```typescript
import { mockAgentRequests, AgentTestUtils } from '../fixtures/agent-data';

describe('With Fixtures', () => {
  it('should use fixture data', async () => {
    const agent = AgentTestUtils.createMockAgent({
      status: 'running',
    });

    expect(agent.status).toBe('running');
  });
});
```

## Configuration

### Jest Configuration

See `jest.config.mjs` in project root.

### Playwright Configuration

See `playwright.config.ts` in project root.

### Environment Variables

```bash
# Required for integration tests
OPENAI_API_KEY=sk-...

# Optional
OPENAI_API_BASE_URL=https://api.openai.com
AGENT_API_BASE_URL=http://localhost:3000/api
```

## Coverage

Generate coverage report:

```bash
npm run test:coverage -- --testPathPatterns=agents
```

View report:

```bash
open coverage/lcov-report/index.html
```

## Troubleshooting

### Tests Timing Out

Increase timeout in test:

```typescript
it('should complete', async () => {
  // test code
}, 30000); // 30 second timeout
```

### Mock Server Not Working

Ensure setup is called:

```typescript
import { setupMockServer } from '../mocks/openai-api-server';

describe('Test Suite', () => {
  setupMockServer(); // Add this

  // tests...
});
```

### Flaky Tests

Use proper async handling:

```typescript
// Bad
await page.click('button');
expect(page.locator('.result')).toBeVisible();

// Good
await page.click('button');
await expect(page.locator('.result')).toBeVisible();
```

## Best Practices

1. Keep tests independent
2. Use descriptive test names
3. Mock external dependencies
4. Clean up after tests
5. Use fixtures for test data
6. Follow AAA pattern (Arrange, Act, Assert)
7. Test both success and failure cases
8. Document complex test logic

## Resources

- [Full Documentation](../../claudedocs/OPENAI_AGENTS_TESTING.md)
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)

## Support

For questions or issues:
1. Check documentation
2. Review existing tests for examples
3. Open an issue on GitHub
