/**
 * Agent Store - Global state management for AI agent sessions
 *
 * Features:
 * - Active agent tracking with real-time status updates
 * - Session management (start, stop, restart)
 * - SSE event integration for live updates
 * - Persistent storage with localStorage backup
 * - Optimistic updates with rollback on error
 *
 * @module stores/agentStore
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import type {
  AgentType,
  AgentStatus,
  AgentStatusResponse,
  ModelType,
  SSEEvent,
  OutputEventData,
  StatusEventData,
  ErrorEventData,
  CompleteEventData,
  StartAgentRequest,
} from '@/types/agent-api';

// ============================================================================
// Types
// ============================================================================

/**
 * Agent session state
 */
export interface AgentSession {
  /** Unique agent identifier */
  agent_id: string;

  /** Agent type */
  agent_type: AgentType;

  /** Current status */
  status: AgentStatus;

  /** Terminal session ID */
  terminal_id: string;

  /** Process ID */
  pid?: number;

  /** Workspace path */
  workspace: string;

  /** LLM model */
  model: ModelType;

  /** Task description */
  task: string;

  /** Creation timestamp */
  created_at: string;

  /** Last status update timestamp */
  updated_at: string;

  /** Uptime in seconds */
  uptime_seconds: number;

  /** Exit code (null if running) */
  exit_code: number | null;

  /** Resource usage */
  resource_usage?: {
    cpu_percent: number;
    memory_mb: number;
    disk_io_mb: number;
  };

  /** Task progress (0.0-1.0) */
  progress?: number;

  /** Last error message */
  last_error?: string;

  /** SSE connection status */
  sse_connected: boolean;

  /** WebSocket connection status */
  ws_connected: boolean;
}

/**
 * Agent statistics
 */
export interface AgentStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  stopped: number;
  error: number;
  by_type: Record<AgentType, number>;
}

/**
 * Agent store state
 */
interface AgentStoreState {
  /** Map of agent_id to session */
  sessions: Map<string, AgentSession>;

  /** Currently active agent ID */
  activeAgentId: string | null;

  /** Loading states */
  loading: {
    starting: Set<string>;
    stopping: Set<string>;
    restarting: Set<string>;
  };

  /** Error states */
  errors: Map<string, string>;

  /** Last sync timestamp */
  lastSync: string | null;

  /** Statistics */
  stats: AgentStats;
}

/**
 * Agent store actions
 */
interface AgentStoreActions {
  // Session Management
  startAgent: (request: StartAgentRequest) => Promise<AgentSession>;
  stopAgent: (agentId: string, force?: boolean) => Promise<void>;
  restartAgent: (agentId: string) => Promise<AgentSession>;
  setActiveAgent: (agentId: string | null) => void;

  // Data Updates
  updateAgent: (agentId: string, updates: Partial<AgentSession>) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus, progress?: number) => void;
  removeAgent: (agentId: string) => void;

  // Batch Operations
  loadAgents: (agents: AgentStatusResponse[]) => void;
  clearCompleted: () => void;
  clearAll: () => void;

  // SSE Event Handlers
  handleSSEEvent: (agentId: string, event: SSEEvent) => void;
  handleSSEConnect: (agentId: string) => void;
  handleSSEDisconnect: (agentId: string) => void;

  // Error Handling
  setError: (agentId: string, error: string) => void;
  clearError: (agentId: string) => void;

  // Selectors
  getAgent: (agentId: string) => AgentSession | undefined;
  getActiveAgent: () => AgentSession | undefined;
  getAgentsByStatus: (status: AgentStatus) => AgentSession[];
  getAgentsByType: (type: AgentType) => AgentSession[];

  // Statistics
  updateStats: () => void;

  // Sync
  sync: () => Promise<void>;
}

type AgentStore = AgentStoreState & AgentStoreActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: AgentStoreState = {
  sessions: new Map(),
  activeAgentId: null,
  loading: {
    starting: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  },
  errors: new Map(),
  lastSync: null,
  stats: {
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    stopped: 0,
    error: 0,
    by_type: {
      aider: 0,
      goose: 0,
      cline: 0,
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate statistics from sessions
 */
function calculateStats(sessions: Map<string, AgentSession>): AgentStats {
  const stats: AgentStats = {
    total: sessions.size,
    running: 0,
    completed: 0,
    failed: 0,
    stopped: 0,
    error: 0,
    by_type: { aider: 0, goose: 0, cline: 0 },
  };

  sessions.forEach((session) => {
    stats[session.status]++;
    stats.by_type[session.agent_type]++;
  });

  return stats;
}

/**
 * Convert API response to session
 */
function apiResponseToSession(response: AgentStatusResponse): AgentSession {
  return {
    agent_id: response.agent_id,
    agent_type: response.agent_type,
    status: response.status,
    terminal_id: response.terminal_id,
    pid: response.pid,
    workspace: response.workspace,
    model: 'claude-3-5-sonnet-20241022' as ModelType, // Default, should come from API
    task: '', // Should come from API
    created_at: response.created_at,
    updated_at: new Date().toISOString(),
    uptime_seconds: response.uptime_seconds,
    exit_code: response.exit_code,
    resource_usage: response.resource_usage,
    sse_connected: false,
    ws_connected: false,
  };
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAgentStore = create<AgentStore>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        ...initialState,

        // ============================================================================
        // Session Management
        // ============================================================================

        startAgent: async (request: StartAgentRequest) => {
          const tempId = `${request.agent_type}-temp-${Date.now()}`;

          // Optimistic update
          set((state) => ({
            loading: {
              ...state.loading,
              starting: new Set(state.loading.starting).add(tempId),
            },
          }));

          try {
            const response = await fetch('/api/agents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(request),
            });

            if (!response.ok) {
              throw new Error(`Failed to start agent: ${response.statusText}`);
            }

            const data = await response.json();
            const session: AgentSession = {
              agent_id: data.agent_id,
              agent_type: request.agent_type,
              status: data.status,
              terminal_id: data.terminal_id,
              pid: data.pid,
              workspace: request.workspace,
              model: request.model,
              task: request.task,
              created_at: data.created_at,
              updated_at: new Date().toISOString(),
              uptime_seconds: 0,
              exit_code: null,
              sse_connected: false,
              ws_connected: false,
            };

            set((state) => {
              const newSessions = new Map(state.sessions);
              newSessions.set(session.agent_id, session);

              const newLoading = { ...state.loading };
              newLoading.starting.delete(tempId);

              return {
                sessions: newSessions,
                loading: newLoading,
                activeAgentId: session.agent_id,
              };
            });

            get().updateStats();
            return session;
          } catch (error) {
            set((state) => {
              const newLoading = { ...state.loading };
              newLoading.starting.delete(tempId);

              return {
                loading: newLoading,
                errors: new Map(state.errors).set(
                  tempId,
                  error instanceof Error ? error.message : 'Unknown error'
                ),
              };
            });
            throw error;
          }
        },

        stopAgent: async (agentId: string, force = false) => {
          set((state) => ({
            loading: {
              ...state.loading,
              stopping: new Set(state.loading.stopping).add(agentId),
            },
          }));

          try {
            const response = await fetch(`/api/agents/${agentId}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ force }),
            });

            if (!response.ok) {
              throw new Error(`Failed to stop agent: ${response.statusText}`);
            }

            set((state) => {
              const newSessions = new Map(state.sessions);
              const session = newSessions.get(agentId);

              if (session) {
                newSessions.set(agentId, {
                  ...session,
                  status: 'stopped',
                  updated_at: new Date().toISOString(),
                });
              }

              const newLoading = { ...state.loading };
              newLoading.stopping.delete(agentId);

              return {
                sessions: newSessions,
                loading: newLoading,
              };
            });

            get().updateStats();
          } catch (error) {
            set((state) => {
              const newLoading = { ...state.loading };
              newLoading.stopping.delete(agentId);

              return {
                loading: newLoading,
                errors: new Map(state.errors).set(
                  agentId,
                  error instanceof Error ? error.message : 'Unknown error'
                ),
              };
            });
            throw error;
          }
        },

        restartAgent: async (agentId: string) => {
          const session = get().getAgent(agentId);
          if (!session) {
            throw new Error(`Agent ${agentId} not found`);
          }

          set((state) => ({
            loading: {
              ...state.loading,
              restarting: new Set(state.loading.restarting).add(agentId),
            },
          }));

          try {
            await get().stopAgent(agentId, true);

            const newSession = await get().startAgent({
              agent_type: session.agent_type,
              workspace: session.workspace,
              model: session.model,
              task: session.task,
            });

            set((state) => {
              const newLoading = { ...state.loading };
              newLoading.restarting.delete(agentId);

              return {
                loading: newLoading,
                activeAgentId: newSession.agent_id,
              };
            });

            return newSession;
          } catch (error) {
            set((state) => {
              const newLoading = { ...state.loading };
              newLoading.restarting.delete(agentId);

              return {
                loading: newLoading,
                errors: new Map(state.errors).set(
                  agentId,
                  error instanceof Error ? error.message : 'Unknown error'
                ),
              };
            });
            throw error;
          }
        },

        setActiveAgent: (agentId: string | null) => {
          set({ activeAgentId: agentId });
        },

        // ============================================================================
        // Data Updates
        // ============================================================================

        updateAgent: (agentId: string, updates: Partial<AgentSession>) => {
          set((state) => {
            const newSessions = new Map(state.sessions);
            const session = newSessions.get(agentId);

            if (session) {
              newSessions.set(agentId, {
                ...session,
                ...updates,
                updated_at: new Date().toISOString(),
              });
            }

            return { sessions: newSessions };
          });

          get().updateStats();
        },

        updateAgentStatus: (agentId: string, status: AgentStatus, progress?: number) => {
          get().updateAgent(agentId, { status, progress });
        },

        removeAgent: (agentId: string) => {
          set((state) => {
            const newSessions = new Map(state.sessions);
            newSessions.delete(agentId);

            const newErrors = new Map(state.errors);
            newErrors.delete(agentId);

            return {
              sessions: newSessions,
              errors: newErrors,
              activeAgentId: state.activeAgentId === agentId ? null : state.activeAgentId,
            };
          });

          get().updateStats();
        },

        // ============================================================================
        // Batch Operations
        // ============================================================================

        loadAgents: (agents: AgentStatusResponse[]) => {
          set((state) => {
            const newSessions = new Map(state.sessions);

            agents.forEach((agent) => {
              const session = apiResponseToSession(agent);
              newSessions.set(session.agent_id, session);
            });

            return {
              sessions: newSessions,
              lastSync: new Date().toISOString(),
            };
          });

          get().updateStats();
        },

        clearCompleted: () => {
          set((state) => {
            const newSessions = new Map(state.sessions);

            newSessions.forEach((session, id) => {
              if (session.status === 'completed' || session.status === 'stopped') {
                newSessions.delete(id);
              }
            });

            return { sessions: newSessions };
          });

          get().updateStats();
        },

        clearAll: () => {
          set({
            ...initialState,
            sessions: new Map(),
            activeAgentId: null,
          });
        },

        // ============================================================================
        // SSE Event Handlers
        // ============================================================================

        handleSSEEvent: (agentId: string, event: SSEEvent) => {
          switch (event.event) {
            case 'output': {
              const data = event.data as OutputEventData;
              get().updateAgent(agentId, {
                updated_at: data.timestamp,
              });
              break;
            }

            case 'status': {
              const data = event.data as StatusEventData;
              get().updateAgent(agentId, {
                status: data.status,
                progress: data.progress,
                updated_at: data.timestamp,
              });
              break;
            }

            case 'error': {
              const data = event.data as ErrorEventData;
              get().updateAgent(agentId, {
                status: 'error',
                last_error: data.error,
                updated_at: data.timestamp,
              });
              get().setError(agentId, data.error);
              break;
            }

            case 'complete': {
              const data = event.data as CompleteEventData;
              get().updateAgent(agentId, {
                status: data.status,
                exit_code: data.exit_code,
                updated_at: data.timestamp,
              });
              break;
            }

            case 'heartbeat':
              // Update last activity timestamp
              get().updateAgent(agentId, {});
              break;
          }
        },

        handleSSEConnect: (agentId: string) => {
          get().updateAgent(agentId, { sse_connected: true });
        },

        handleSSEDisconnect: (agentId: string) => {
          get().updateAgent(agentId, { sse_connected: false });
        },

        // ============================================================================
        // Error Handling
        // ============================================================================

        setError: (agentId: string, error: string) => {
          set((state) => ({
            errors: new Map(state.errors).set(agentId, error),
          }));
        },

        clearError: (agentId: string) => {
          set((state) => {
            const newErrors = new Map(state.errors);
            newErrors.delete(agentId);
            return { errors: newErrors };
          });
        },

        // ============================================================================
        // Selectors
        // ============================================================================

        getAgent: (agentId: string) => {
          return get().sessions.get(agentId);
        },

        getActiveAgent: () => {
          const { activeAgentId, sessions } = get();
          return activeAgentId ? sessions.get(activeAgentId) : undefined;
        },

        getAgentsByStatus: (status: AgentStatus) => {
          const sessions = Array.from(get().sessions.values());
          return sessions.filter((s) => s.status === status);
        },

        getAgentsByType: (type: AgentType) => {
          const sessions = Array.from(get().sessions.values());
          return sessions.filter((s) => s.agent_type === type);
        },

        // ============================================================================
        // Statistics
        // ============================================================================

        updateStats: () => {
          const stats = calculateStats(get().sessions);
          set({ stats });
        },

        // ============================================================================
        // Sync
        // ============================================================================

        sync: async () => {
          try {
            const response = await fetch('/api/agents');
            if (!response.ok) {
              throw new Error(`Failed to sync agents: ${response.statusText}`);
            }

            const data = await response.json();
            get().loadAgents(data.agents || []);
          } catch (error) {
            console.error('Failed to sync agents:', error);
          }
        },
      })),
      {
        name: 'agent-store',
        partialize: (state) => ({
          sessions: Array.from(state.sessions.entries()),
          activeAgentId: state.activeAgentId,
          lastSync: state.lastSync,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Convert sessions array back to Map
            const sessions = new Map(state.sessions as [string, AgentSession][]);
            state.sessions = sessions;
            state.updateStats();
          }
        },
      }
    ),
    { name: 'AgentStore' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select all sessions as array
 */
export const selectAllSessions = (state: AgentStore) =>
  Array.from(state.sessions.values());

/**
 * Select running sessions
 */
export const selectRunningSessions = (state: AgentStore) =>
  state.getAgentsByStatus('running');

/**
 * Select active agent
 */
export const selectActiveAgent = (state: AgentStore) =>
  state.getActiveAgent();

/**
 * Select statistics
 */
export const selectStats = (state: AgentStore) =>
  state.stats;

/**
 * Select loading state
 */
export const selectLoading = (state: AgentStore) => ({
  isStarting: state.loading.starting.size > 0,
  isStopping: state.loading.stopping.size > 0,
  isRestarting: state.loading.restarting.size > 0,
});

/**
 * Select errors
 */
export const selectErrors = (state: AgentStore) =>
  Array.from(state.errors.entries());
