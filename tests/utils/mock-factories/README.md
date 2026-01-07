# Mock Data Factories

Reusable mock data factories to support consistent, maintainable test data across the VibeCode test suite.

## Overview

Mock factories provide a standardized way to create test data objects with sensible defaults while allowing easy customization through overrides. This approach:

- **Reduces duplication**: Write mock setup once, use everywhere
- **Improves maintainability**: Update defaults in one place
- **Prevents undefined errors**: All required fields have default values
- **Enhances readability**: Tests focus on what's being tested, not setup

## Installation

The factories are already available in the test suite. Import them from the utils directory:

```typescript
import {
  createMockUser,
  createMockSession,
  createMockWorkspace,
} from '@/tests/utils/mock-factories';
```

## Available Factories

### User Factories

Create mock user objects for authentication and authorization tests.

```typescript
import { createMockUser, createMockAdmin, createMockUsers } from '@/tests/utils/mock-factories';

// Basic user
const user = createMockUser();
// { id: 'mock-user-id', email: 'test@example.com', name: 'Test User', ... }

// Custom user
const customUser = createMockUser({
  id: 'user-123',
  email: 'alice@example.com',
  name: 'Alice',
});

// Admin user
const admin = createMockAdmin();

// Multiple users
const users = createMockUsers(5); // Creates 5 users
```

### Session Factories

Create NextAuth session objects for authentication tests.

```typescript
import {
  createMockSession,
  createMockSessionWithUser,
  createExpiredMockSession,
  createExpiringSoonMockSession,
} from '@/tests/utils/mock-factories';

// Basic session
const session = createMockSession();
// { user: { ... }, expires: Date (24h from now) }

// Session with specific user
const customSession = createMockSessionWithUser(createMockUser({ id: 'user-123' }));

// Expired session (for testing session refresh)
const expiredSession = createExpiredMockSession();

// Session expiring soon (for testing warnings)
const soonExpiring = createExpiringSoonMockSession(5); // Expires in 5 minutes
```

### Workspace Factories

Create mock workspace objects for collaboration and workspace management tests.

```typescript
import {
  createMockWorkspace,
  createMockSharedWorkspace,
  createMockArchivedWorkspace,
  createMockWorkspaces,
  createMockWorkspaceSettings,
} from '@/tests/utils/mock-factories';

// Basic workspace
const workspace = createMockWorkspace();

// Custom workspace
const myWorkspace = createMockWorkspace({
  id: 'ws-123',
  name: 'My Project',
  owner: 'user-123',
});

// Shared workspace with members
const sharedWorkspace = createMockSharedWorkspace(['user-1', 'user-2', 'user-3']);

// Archived workspace
const archived = createMockArchivedWorkspace();

// Multiple workspaces
const workspaces = createMockWorkspaces(3);

// Just the settings
const settings = createMockWorkspaceSettings({ theme: 'light' });
```

### Metrics Factories

Create mock monitoring and metrics data for observability tests.

```typescript
import {
  createMockMetrics,
  createMockHealthCheck,
  createMockUnhealthyHealthCheck,
  createMockDatadogMetrics,
  createMockMetricsArray,
  createMockPerformanceMetrics,
} from '@/tests/utils/mock-factories';

// Basic metrics
const metrics = createMockMetrics({ metric: 'api.requests', value: 100 });

// Health check (all services healthy)
const healthCheck = createMockHealthCheck();

// Unhealthy health check
const unhealthy = createMockUnhealthyHealthCheck('database');

// Datadog metrics
const ddMetrics = createMockDatadogMetrics({ metric: 'vibecode.api.latency' });

// Multiple metrics
const metricsArray = createMockMetricsArray(10); // 10 metrics at 1-minute intervals

// Performance metrics
const perfMetrics = createMockPerformanceMetrics({ responseTime: 200 });
```

### Agent Factories

Create mock AI agent objects for OpenAI Agents API tests.

```typescript
import {
  createMockAgent,
  createMockCodeAgent,
  createMockThread,
  createMockMessage,
  createMockAssistantMessage,
  createMockRun,
  createMockAgents,
} from '@/tests/utils/mock-factories';

// Basic agent
const agent = createMockAgent();

// Code assistant agent
const codeAgent = createMockCodeAgent();

// Custom agent
const customAgent = createMockAgent({
  name: 'Research Assistant',
  instructions: 'You help with research tasks',
  tools: [{ type: 'retrieval' }],
});

// Thread
const thread = createMockThread();

// User message
const message = createMockMessage({ content: [{ type: 'text', text: { value: 'Hello!', annotations: [] } }] });

// Assistant message
const response = createMockAssistantMessage('I can help with that.');

// Run
const run = createMockRun({ status: 'completed' });

// Multiple agents
const agents = createMockAgents(3);
```

### Project Factories

Create mock project and file objects for project generation and file sync tests.

```typescript
import {
  createMockProject,
  createMockReactProject,
  createMockNextProject,
  createMockFile,
  createMockPackageJson,
  createMockFileTree,
  createMockFiles,
  createMockProjectWithFiles,
} from '@/tests/utils/mock-factories';

// Basic project
const project = createMockProject();

// React project
const reactProject = createMockReactProject();

// Next.js project
const nextProject = createMockNextProject();

// Custom project
const customProject = createMockProject({
  name: 'My App',
  framework: 'vue',
  language: 'javascript',
});

// File
const file = createMockFile({ path: '/src/app.ts', content: 'export default {}' });

// package.json
const packageJson = createMockPackageJson('my-app');

// File tree
const fileTree = createMockFileTree();

// Multiple files
const files = createMockFiles(5);

// Project with complete file structure
const fullProject = createMockProjectWithFiles({ name: 'Complete App' });
```

## Usage Patterns

### Basic Test Setup

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createMockUser, createMockSession } from '@/tests/utils/mock-factories';
import { getServerSession } from 'next-auth';

jest.mock('next-auth');

describe('User API', () => {
  const mockUser = createMockUser({ id: 'test-user-123' });
  const mockSession = createMockSession({ user: mockUser });

  beforeEach(() => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it('should return current user', async () => {
    const response = await fetch('/api/user/me');
    const data = await response.json();
    expect(data.id).toBe(mockUser.id);
  });
});
```

### Complex Test Scenarios

```typescript
import {
  createMockUser,
  createMockWorkspace,
  createMockSharedWorkspace,
} from '@/tests/utils/mock-factories';

describe('Workspace Collaboration', () => {
  it('should allow workspace owner to add members', () => {
    const owner = createMockUser({ id: 'owner-1' });
    const member1 = createMockUser({ id: 'member-1' });
    const member2 = createMockUser({ id: 'member-2' });

    const workspace = createMockWorkspace({ owner: owner.id });

    // Test adding members
    const updatedWorkspace = createMockSharedWorkspace(
      [member1.id, member2.id],
      { id: workspace.id, owner: owner.id }
    );

    expect(updatedWorkspace.members).toHaveLength(2);
  });
});
```

### Integration Tests

```typescript
import {
  createMockUser,
  createMockSession,
  createMockAgent,
  createMockThread,
} from '@/tests/utils/mock-factories';

describe('Agent API Integration', () => {
  it('should create agent and thread for user', async () => {
    const user = createMockUser({ id: 'user-123' });
    const session = createMockSession({ user });

    const agent = createMockAgent({
      metadata: { userId: user.id },
    });

    const thread = createMockThread();

    expect(agent.metadata.userId).toBe(user.id);
  });
});
```

## Best Practices

1. **Use factories over manual objects**: Factories ensure consistency and handle all required fields.

2. **Override only what you need**: Let defaults handle common cases.
   ```typescript
   // Good
   const user = createMockUser({ email: 'specific@example.com' });

   // Avoid
   const user = {
     id: 'user-1',
     email: 'specific@example.com',
     name: 'Test User',
     role: 'user',
     // ... lots of boilerplate
   };
   ```

3. **Compose factories**: Build complex objects from simpler ones.
   ```typescript
   const user = createMockUser({ id: 'user-123' });
   const session = createMockSession({ user });
   const workspace = createMockWorkspace({ owner: user.id });
   ```

4. **Use specialized factories**: Take advantage of purpose-built variants.
   ```typescript
   // Instead of
   const admin = createMockUser({ role: 'admin', email: 'admin@example.com' });

   // Use
   const admin = createMockAdmin();
   ```

5. **Batch create when testing multiple items**: Use array factories for lists.
   ```typescript
   const users = createMockUsers(5);
   const workspaces = createMockWorkspaces(3, { owner: 'user-123' });
   ```

## Extending Factories

If you need additional mock types, follow the existing pattern:

1. Create a new file in `tests/utils/mock-factories/`
2. Define TypeScript interfaces
3. Create factory functions with sensible defaults
4. Add specialized variants as needed
5. Export from `index.ts`

Example:

```typescript
// notification.ts
export interface MockNotification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export const createMockNotification = (
  overrides: Partial<MockNotification> = {}
): MockNotification => {
  return {
    id: 'notif-123',
    userId: 'user-123',
    message: 'Test notification',
    read: false,
    createdAt: new Date(),
    ...overrides,
  };
};
```

## Migration Guide

### Before (Manual Mocks)

```typescript
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSession = {
  user: mockUser,
  expires: new Date(Date.now() + 86400000),
};
```

### After (Using Factories)

```typescript
import { createMockUser, createMockSession } from '@/tests/utils/mock-factories';

const mockUser = createMockUser({ id: 'test-user-123' });
const mockSession = createMockSession({ user: mockUser });
```

## Expected Impact

By using these factories, we expect to:

- Fix 50-75 tests with missing or undefined mock data
- Reduce test maintenance time by 60-70%
- Improve test readability by removing boilerplate
- Enable faster test writing (5-10 minutes per test instead of 15-20)

## Related Documentation

- [Test Roadmap](/tmp/fix-roadmap.md)
- [Unit Test Analysis](/tmp/unit-test-analysis.md)
- [Testing Guide](../TESTING_GUIDE.md)
- [Mock Templates](../mock-templates.ts)

## Support

For questions or issues with mock factories, refer to:
- GitHub Issue #773 (Mock Factory Infrastructure)
- Test improvement roadmap
- Team testing documentation
