/**
 * Mock Data Factories
 *
 * Centralized export of all mock data factory functions.
 * Use these factories to create consistent, realistic test data across your test suite.
 *
 * @module mock-factories
 *
 * @example
 * ```typescript
 * import {
 *   createMockUser,
 *   createMockSession,
 *   createMockWorkspace,
 *   createMockAgent,
 * } from '@/tests/utils/mock-factories';
 *
 * const user = createMockUser({ email: 'test@example.com' });
 * const session = createMockSession({ user });
 * const workspace = createMockWorkspace({ owner: user.id });
 * ```
 */

// User factories
export {
  createMockUser,
  createMockAdmin,
  createMockUsers,
  type MockUser,
} from './user';

// Session factories
export {
  createMockSession,
  createMockSessionWithUser,
  createExpiredMockSession,
  createExpiringSoonMockSession,
  type MockSession,
} from './session';

// Workspace factories
export {
  createMockWorkspace,
  createMockSharedWorkspace,
  createMockArchivedWorkspace,
  createMockWorkspaces,
  createMockWorkspaceSettings,
  type MockWorkspace,
} from './workspace';

// Metrics factories
export {
  createMockMetrics,
  createMockHealthCheck,
  createMockUnhealthyHealthCheck,
  createMockDatadogMetrics,
  createMockMetricsArray,
  createMockPerformanceMetrics,
  type MockMetrics,
  type MockHealthCheck,
  type MockHealthCheckDetail,
  type MockDatadogMetrics,
} from './metrics';

// Agent factories
export {
  createMockAgent,
  createMockCodeAgent,
  createMockThread,
  createMockMessage,
  createMockAssistantMessage,
  createMockRun,
  createMockAgents,
  type MockAgent,
  type MockAgentTool,
  type MockThread,
  type MockMessage,
  type MockRun,
} from './agent';

// Project factories
export {
  createMockProject,
  createMockReactProject,
  createMockNextProject,
  createMockFile,
  createMockPackageJson,
  createMockFileTree,
  createMockFiles,
  createMockProjectWithFiles,
  type MockProject,
  type MockFile,
  type MockFileTree,
} from './project';
