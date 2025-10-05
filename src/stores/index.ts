/**
 * Stores Index - Central export for all Zustand stores
 *
 * @module stores
 */

// Core Stores
export { useAgentStore } from './agentStore';
export { useConversationStore } from './conversationStore';
export { useUIStore } from './uiStore';

// Agent Store Exports
export type {
  AgentSession,
  AgentStats,
} from './agentStore';

export {
  selectAllSessions,
  selectRunningSessions,
  selectActiveAgent,
  selectStats,
  selectLoading,
  selectErrors,
} from './agentStore';

// Conversation Store Exports
export type {
  Message,
  MessageRole,
  MessageStatus,
  PaginationState,
  ConversationFilters,
  ConversationMetadata,
} from './conversationStore';

export {
  selectMessages,
  selectFilteredMessages,
  selectPagination,
  selectMetadata,
  selectLoading as selectConversationLoading,
  selectError,
} from './conversationStore';

// UI Store Exports
export type {
  LayoutMode,
  ThemeMode,
  PanelType,
  KeyboardShortcut,
  PanelState,
  Breakpoint,
  NotificationSettings,
  AccessibilitySettings,
} from './uiStore';

export {
  selectLayout,
  selectTheme,
  selectPanel,
  selectVisiblePanels,
  selectShortcuts,
  selectEnabledShortcuts,
  selectBreakpoint,
  selectIsMobile,
  selectNotifications,
  selectAccessibility,
  selectSidebarCollapsed,
  selectActiveModal,
  selectCommandPaletteOpen,
  useBreakpointDetector,
} from './uiStore';

// Middleware
export { sseMiddleware, createAgentSSEConnection, parseSSEEvent, createSSEListener } from './middleware/sseMiddleware';
export { optimisticMiddleware, withOptimisticUpdate, generateOptimisticId } from './middleware/optimisticMiddleware';

export type {
  SSEConnection,
  SSEMiddlewareOptions,
  SSEMiddleware,
} from './middleware/sseMiddleware';

export type {
  OptimisticUpdate,
  OptimisticMiddlewareOptions,
  OptimisticMiddleware,
} from './middleware/optimisticMiddleware';
