/**
 * Conversation Store - Message history and conversation state management
 *
 * Features:
 * - Message history per agent with pagination
 * - Local cache with backend synchronization
 * - Search and filter capabilities
 * - Optimistic message updates
 * - Message grouping and threading
 *
 * @module stores/conversationStore
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Message role
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message status
 */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'error';

/**
 * Message type
 */
export interface Message {
  /** Unique message ID */
  id: string;

  /** Agent ID this message belongs to */
  agent_id: string;

  /** Message role */
  role: MessageRole;

  /** Message content */
  content: string;

  /** Message timestamp */
  timestamp: string;

  /** Message status */
  status: MessageStatus;

  /** Error message if status is error */
  error?: string;

  /** Message metadata */
  metadata?: {
    /** Token count */
    tokens?: number;
    /** Model used */
    model?: string;
    /** Response time in ms */
    response_time?: number;
    /** Context used */
    context?: string[];
  };
}

/**
 * Conversation pagination state
 */
export interface PaginationState {
  /** Current page */
  page: number;

  /** Items per page */
  limit: number;

  /** Total items */
  total: number;

  /** Has more items */
  hasMore: boolean;
}

/**
 * Conversation filters
 */
export interface ConversationFilters {
  /** Filter by role */
  role?: MessageRole;

  /** Search query */
  search?: string;

  /** Date range start */
  dateFrom?: string;

  /** Date range end */
  dateTo?: string;

  /** Filter by status */
  status?: MessageStatus;
}

/**
 * Conversation metadata
 */
export interface ConversationMetadata {
  /** Total message count */
  messageCount: number;

  /** First message timestamp */
  firstMessage?: string;

  /** Last message timestamp */
  lastMessage?: string;

  /** Total tokens used */
  totalTokens: number;

  /** Average response time */
  avgResponseTime: number;
}

/**
 * Conversation state
 */
interface ConversationStoreState {
  /** Messages grouped by agent_id */
  messages: Map<string, Message[]>;

  /** Pagination state per agent */
  pagination: Map<string, PaginationState>;

  /** Active filters per agent */
  filters: Map<string, ConversationFilters>;

  /** Loading states */
  loading: {
    fetching: Set<string>;
    sending: Set<string>;
  };

  /** Error states */
  errors: Map<string, string>;

  /** Conversation metadata */
  metadata: Map<string, ConversationMetadata>;

  /** Last sync timestamps */
  lastSync: Map<string, string>;

  /** Cache expiry time in ms */
  cacheExpiry: number;
}

/**
 * Conversation store actions
 */
interface ConversationStoreActions {
  // Message Management
  addMessage: (agentId: string, message: Omit<Message, 'id' | 'timestamp' | 'status'>) => Message;
  updateMessage: (agentId: string, messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (agentId: string, messageId: string) => void;
  clearMessages: (agentId: string) => void;

  // Sending Messages
  sendMessage: (agentId: string, content: string, role?: MessageRole) => Promise<Message>;

  // Fetching Messages
  fetchMessages: (agentId: string, page?: number) => Promise<void>;
  loadMoreMessages: (agentId: string) => Promise<void>;

  // Filtering and Search
  setFilters: (agentId: string, filters: ConversationFilters) => void;
  clearFilters: (agentId: string) => void;
  searchMessages: (agentId: string, query: string) => Message[];

  // Pagination
  setPage: (agentId: string, page: number) => void;
  resetPagination: (agentId: string) => void;

  // Selectors
  getMessages: (agentId: string) => Message[];
  getFilteredMessages: (agentId: string) => Message[];
  getMessage: (agentId: string, messageId: string) => Message | undefined;
  getMetadata: (agentId: string) => ConversationMetadata | undefined;

  // Error Handling
  setError: (agentId: string, error: string) => void;
  clearError: (agentId: string) => void;

  // Sync
  sync: (agentId: string) => Promise<void>;
  syncAll: () => Promise<void>;

  // Metadata
  updateMetadata: (agentId: string) => void;
}

type ConversationStore = ConversationStoreState & ConversationStoreActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: ConversationStoreState = {
  messages: new Map(),
  pagination: new Map(),
  filters: new Map(),
  loading: {
    fetching: new Set(),
    sending: new Set(),
  },
  errors: new Map(),
  metadata: new Map(),
  lastSync: new Map(),
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate conversation metadata
 */
function calculateMetadata(messages: Message[]): ConversationMetadata {
  if (messages.length === 0) {
    return {
      messageCount: 0,
      totalTokens: 0,
      avgResponseTime: 0,
    };
  }

  const totalTokens = messages.reduce((sum, msg) => sum + (msg.metadata?.tokens || 0), 0);
  const responseTimes = messages
    .map((msg) => msg.metadata?.response_time)
    .filter((time): time is number => typeof time === 'number');
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    : 0;

  return {
    messageCount: messages.length,
    firstMessage: messages[0]?.timestamp,
    lastMessage: messages[messages.length - 1]?.timestamp,
    totalTokens,
    avgResponseTime,
  };
}

/**
 * Filter messages based on filters
 */
function filterMessages(messages: Message[], filters: ConversationFilters): Message[] {
  let filtered = [...messages];

  if (filters.role) {
    filtered = filtered.filter((msg) => msg.role === filters.role);
  }

  if (filters.status) {
    filtered = filtered.filter((msg) => msg.status === filters.status);
  }

  if (filters.search) {
    const query = filters.search.toLowerCase();
    filtered = filtered.filter((msg) => msg.content.toLowerCase().includes(query));
  }

  if (filters.dateFrom) {
    filtered = filtered.filter((msg) => msg.timestamp >= filters.dateFrom!);
  }

  if (filters.dateTo) {
    filtered = filtered.filter((msg) => msg.timestamp <= filters.dateTo!);
  }

  return filtered;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useConversationStore = create<ConversationStore>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        ...initialState,

        // ============================================================================
        // Message Management
        // ============================================================================

        addMessage: (agentId: string, message: Omit<Message, 'id' | 'timestamp' | 'status'>) => {
          const newMessage: Message = {
            ...message,
            id: generateMessageId(),
            timestamp: new Date().toISOString(),
            status: 'sent',
          };

          set((state) => {
            const newMessages = new Map(state.messages);
            const agentMessages = newMessages.get(agentId) || [];
            newMessages.set(agentId, [...agentMessages, newMessage]);

            return { messages: newMessages };
          });

          get().updateMetadata(agentId);
          return newMessage;
        },

        updateMessage: (agentId: string, messageId: string, updates: Partial<Message>) => {
          set((state) => {
            const newMessages = new Map(state.messages);
            const agentMessages = newMessages.get(agentId);

            if (agentMessages) {
              const index = agentMessages.findIndex((msg) => msg.id === messageId);
              if (index !== -1) {
                const updatedMessages = [...agentMessages];
                updatedMessages[index] = { ...updatedMessages[index], ...updates };
                newMessages.set(agentId, updatedMessages);
              }
            }

            return { messages: newMessages };
          });

          get().updateMetadata(agentId);
        },

        deleteMessage: (agentId: string, messageId: string) => {
          set((state) => {
            const newMessages = new Map(state.messages);
            const agentMessages = newMessages.get(agentId);

            if (agentMessages) {
              newMessages.set(
                agentId,
                agentMessages.filter((msg) => msg.id !== messageId)
              );
            }

            return { messages: newMessages };
          });

          get().updateMetadata(agentId);
        },

        clearMessages: (agentId: string) => {
          set((state) => {
            const newMessages = new Map(state.messages);
            newMessages.delete(agentId);

            const newMetadata = new Map(state.metadata);
            newMetadata.delete(agentId);

            const newPagination = new Map(state.pagination);
            newPagination.delete(agentId);

            const newFilters = new Map(state.filters);
            newFilters.delete(agentId);

            return {
              messages: newMessages,
              metadata: newMetadata,
              pagination: newPagination,
              filters: newFilters,
            };
          });
        },

        // ============================================================================
        // Sending Messages
        // ============================================================================

        sendMessage: async (agentId: string, content: string, role: MessageRole = 'user') => {
          // Optimistic update
          const tempMessage = get().addMessage(agentId, {
            agent_id: agentId,
            role,
            content,
          });

          set((state) => ({
            loading: {
              ...state.loading,
              sending: new Set(state.loading.sending).add(agentId),
            },
          }));

          get().updateMessage(agentId, tempMessage.id, { status: 'sending' });

          try {
            const response = await fetch(`/api/agents/${agentId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: content, type: role }),
            });

            if (!response.ok) {
              throw new Error(`Failed to send message: ${response.statusText}`);
            }

            const data = await response.json();

            // Update with real message ID and status
            get().updateMessage(agentId, tempMessage.id, {
              id: data.message_id,
              status: 'delivered',
            });

            set((state) => {
              const newLoading = { ...state.loading };
              newLoading.sending.delete(agentId);
              return { loading: newLoading };
            });

            return { ...tempMessage, id: data.message_id, status: 'delivered' as MessageStatus };
          } catch (error) {
            get().updateMessage(agentId, tempMessage.id, {
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            });

            set((state) => {
              const newLoading = { ...state.loading };
              newLoading.sending.delete(agentId);

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

        // ============================================================================
        // Fetching Messages
        // ============================================================================

        fetchMessages: async (agentId: string, page = 1) => {
          set((state) => ({
            loading: {
              ...state.loading,
              fetching: new Set(state.loading.fetching).add(agentId),
            },
          }));

          try {
            const limit = 50;
            const response = await fetch(`/api/agents/${agentId}/messages?page=${page}&limit=${limit}`);

            if (!response.ok) {
              throw new Error(`Failed to fetch messages: ${response.statusText}`);
            }

            const data = await response.json();

            set((state) => {
              const newMessages = new Map(state.messages);
              newMessages.set(agentId, data.messages || []);

              const newPagination = new Map(state.pagination);
              newPagination.set(agentId, {
                page: data.pagination?.page || page,
                limit: data.pagination?.limit || limit,
                total: data.pagination?.total || 0,
                hasMore: (data.pagination?.page || page) < (data.pagination?.pages || 1),
              });

              const newLastSync = new Map(state.lastSync);
              newLastSync.set(agentId, new Date().toISOString());

              const newLoading = { ...state.loading };
              newLoading.fetching.delete(agentId);

              return {
                messages: newMessages,
                pagination: newPagination,
                lastSync: newLastSync,
                loading: newLoading,
              };
            });

            get().updateMetadata(agentId);
          } catch (error) {
            set((state) => {
              const newLoading = { ...state.loading };
              newLoading.fetching.delete(agentId);

              return {
                loading: newLoading,
                errors: new Map(state.errors).set(
                  agentId,
                  error instanceof Error ? error.message : 'Unknown error'
                ),
              };
            });
          }
        },

        loadMoreMessages: async (agentId: string) => {
          const pagination = get().pagination.get(agentId);
          if (!pagination || !pagination.hasMore) {
            return;
          }

          await get().fetchMessages(agentId, pagination.page + 1);
        },

        // ============================================================================
        // Filtering and Search
        // ============================================================================

        setFilters: (agentId: string, filters: ConversationFilters) => {
          set((state) => {
            const newFilters = new Map(state.filters);
            newFilters.set(agentId, filters);
            return { filters: newFilters };
          });
        },

        clearFilters: (agentId: string) => {
          set((state) => {
            const newFilters = new Map(state.filters);
            newFilters.delete(agentId);
            return { filters: newFilters };
          });
        },

        searchMessages: (agentId: string, query: string) => {
          const messages = get().getMessages(agentId);
          const lowerQuery = query.toLowerCase();
          return messages.filter((msg) => msg.content.toLowerCase().includes(lowerQuery));
        },

        // ============================================================================
        // Pagination
        // ============================================================================

        setPage: (agentId: string, page: number) => {
          get().fetchMessages(agentId, page);
        },

        resetPagination: (agentId: string) => {
          set((state) => {
            const newPagination = new Map(state.pagination);
            newPagination.delete(agentId);
            return { pagination: newPagination };
          });
        },

        // ============================================================================
        // Selectors
        // ============================================================================

        getMessages: (agentId: string) => {
          return get().messages.get(agentId) || [];
        },

        getFilteredMessages: (agentId: string) => {
          const messages = get().getMessages(agentId);
          const filters = get().filters.get(agentId);

          if (!filters) {
            return messages;
          }

          return filterMessages(messages, filters);
        },

        getMessage: (agentId: string, messageId: string) => {
          const messages = get().getMessages(agentId);
          return messages.find((msg) => msg.id === messageId);
        },

        getMetadata: (agentId: string) => {
          return get().metadata.get(agentId);
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
        // Sync
        // ============================================================================

        sync: async (agentId: string) => {
          const lastSync = get().lastSync.get(agentId);
          const now = Date.now();
          const cacheExpiry = get().cacheExpiry;

          // Check if cache is still valid
          if (lastSync && now - new Date(lastSync).getTime() < cacheExpiry) {
            return;
          }

          await get().fetchMessages(agentId);
        },

        syncAll: async () => {
          const agentIds = Array.from(get().messages.keys());
          await Promise.all(agentIds.map((id) => get().sync(id)));
        },

        // ============================================================================
        // Metadata
        // ============================================================================

        updateMetadata: (agentId: string) => {
          const messages = get().getMessages(agentId);
          const metadata = calculateMetadata(messages);

          set((state) => {
            const newMetadata = new Map(state.metadata);
            newMetadata.set(agentId, metadata);
            return { metadata: newMetadata };
          });
        },
      })),
      {
        name: 'conversation-store',
        partialize: (state) => ({
          messages: Array.from(state.messages.entries()),
          pagination: Array.from(state.pagination.entries()),
          lastSync: Array.from(state.lastSync.entries()),
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Convert arrays back to Maps
            state.messages = new Map(state.messages as [string, Message[]][]);
            state.pagination = new Map(state.pagination as [string, PaginationState][]);
            state.lastSync = new Map(state.lastSync as [string, string][]);

            // Recalculate metadata
            state.messages.forEach((_, agentId) => {
              state.updateMetadata(agentId);
            });
          }
        },
      }
    ),
    { name: 'ConversationStore' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select messages for agent
 */
export const selectMessages = (agentId: string) => (state: ConversationStore) =>
  state.getMessages(agentId);

/**
 * Select filtered messages for agent
 */
export const selectFilteredMessages = (agentId: string) => (state: ConversationStore) =>
  state.getFilteredMessages(agentId);

/**
 * Select pagination for agent
 */
export const selectPagination = (agentId: string) => (state: ConversationStore) =>
  state.pagination.get(agentId);

/**
 * Select metadata for agent
 */
export const selectMetadata = (agentId: string) => (state: ConversationStore) =>
  state.getMetadata(agentId);

/**
 * Select loading state for agent
 */
export const selectLoading = (agentId: string) => (state: ConversationStore) => ({
  isFetching: state.loading.fetching.has(agentId),
  isSending: state.loading.sending.has(agentId),
});

/**
 * Select error for agent
 */
export const selectError = (agentId: string) => (state: ConversationStore) =>
  state.errors.get(agentId);
