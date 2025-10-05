/**
 * SSE Middleware for Zustand
 *
 * Integrates Server-Sent Events with Zustand stores for real-time updates
 *
 * @module stores/middleware/sseMiddleware
 */

import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import type { SSEEvent } from '@/types/agent-api';

// ============================================================================
// Types
// ============================================================================

export interface SSEConnection {
  url: string;
  eventSource: EventSource | null;
  connected: boolean;
  reconnectAttempts: number;
  lastEventId: string | null;
}

export interface SSEMiddlewareOptions {
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;

  /** Reconnection delay in ms */
  reconnectDelay?: number;

  /** Whether to reconnect automatically */
  autoReconnect?: boolean;

  /** Event handler callback */
  onEvent?: (event: SSEEvent) => void;

  /** Connection handler callback */
  onConnect?: () => void;

  /** Disconnection handler callback */
  onDisconnect?: () => void;

  /** Error handler callback */
  onError?: (error: Event) => void;
}

// ============================================================================
// SSE Connection Manager
// ============================================================================

class SSEConnectionManager {
  private connections: Map<string, SSEConnection> = new Map();
  private options: Required<SSEMiddlewareOptions>;

  constructor(options: SSEMiddlewareOptions = {}) {
    this.options = {
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectDelay: options.reconnectDelay ?? 3000,
      autoReconnect: options.autoReconnect ?? true,
      onEvent: options.onEvent ?? (() => {}),
      onConnect: options.onConnect ?? (() => {}),
      onDisconnect: options.onDisconnect ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
  }

  /**
   * Connect to SSE endpoint
   */
  connect(key: string, url: string): void {
    // Close existing connection if any
    this.disconnect(key);

    try {
      const connection: SSEConnection = {
        url,
        eventSource: null,
        connected: false,
        reconnectAttempts: 0,
        lastEventId: null,
      };

      // Create EventSource with last event ID for resume
      const eventSource = new EventSource(
        connection.lastEventId
          ? `${url}?from_sequence=${connection.lastEventId}`
          : url
      );

      connection.eventSource = eventSource;

      // Handle connection open
      eventSource.onopen = () => {
        connection.connected = true;
        connection.reconnectAttempts = 0;
        this.options.onConnect();
      };

      // Handle messages
      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent;
          connection.lastEventId = data.id;
          this.options.onEvent(data);
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      };

      // Handle errors
      eventSource.onerror = (error: Event) => {
        connection.connected = false;
        this.options.onError(error);
        this.options.onDisconnect();

        // Attempt reconnection
        if (
          this.options.autoReconnect &&
          connection.reconnectAttempts < this.options.maxReconnectAttempts
        ) {
          connection.reconnectAttempts++;
          setTimeout(() => {
            if (this.connections.has(key)) {
              this.connect(key, url);
            }
          }, this.options.reconnectDelay);
        } else {
          eventSource.close();
        }
      };

      this.connections.set(key, connection);
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
    }
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect(key: string): void {
    const connection = this.connections.get(key);
    if (connection?.eventSource) {
      connection.eventSource.close();
      connection.connected = false;
      this.options.onDisconnect();
    }
    this.connections.delete(key);
  }

  /**
   * Disconnect all connections
   */
  disconnectAll(): void {
    this.connections.forEach((_, key) => this.disconnect(key));
  }

  /**
   * Get connection status
   */
  isConnected(key: string): boolean {
    return this.connections.get(key)?.connected ?? false;
  }

  /**
   * Get all connections
   */
  getConnections(): Map<string, SSEConnection> {
    return new Map(this.connections);
  }
}

// ============================================================================
// Middleware Implementation
// ============================================================================

export interface SSEMiddleware {
  sse: {
    manager: SSEConnectionManager;
    connect: (key: string, url: string) => void;
    disconnect: (key: string) => void;
    disconnectAll: () => void;
    isConnected: (key: string) => boolean;
  };
}

type SSEMiddlewareImpl = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  initializer: StateCreator<T, [...Mps, ['sse', SSEMiddleware]], Mcs>
) => StateCreator<T, Mps, [['sse', SSEMiddleware], ...Mcs]>;

/**
 * Create SSE middleware for Zustand
 */
export const sseMiddleware: (
  options?: SSEMiddlewareOptions
) => SSEMiddlewareImpl = (options = {}) => {
  return (initializer) => (set, get, store) => {
    const manager = new SSEConnectionManager(options);

    // Add SSE methods to store
    const sse: SSEMiddleware['sse'] = {
      manager,
      connect: manager.connect.bind(manager),
      disconnect: manager.disconnect.bind(manager),
      disconnectAll: manager.disconnectAll.bind(manager),
      isConnected: manager.isConnected.bind(manager),
    };

    // Extend store with SSE functionality
    const extendedStore = initializer(
      set,
      get,
      store as Parameters<typeof initializer>[2]
    );

    return {
      ...extendedStore,
      sse,
    };
  };
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create SSE connection for agent
 */
export function createAgentSSEConnection(
  agentId: string,
  onEvent: (event: SSEEvent) => void,
  onConnect?: () => void,
  onDisconnect?: () => void,
  onError?: (error: Event) => void
): SSEConnectionManager {
  const manager = new SSEConnectionManager({
    onEvent,
    onConnect,
    onDisconnect,
    onError,
    maxReconnectAttempts: 5,
    reconnectDelay: 3000,
    autoReconnect: true,
  });

  const url = `/api/agents/${agentId}/stream`;
  manager.connect(agentId, url);

  return manager;
}

/**
 * Parse SSE event data
 */
export function parseSSEEvent(data: string): SSEEvent | null {
  try {
    return JSON.parse(data) as SSEEvent;
  } catch (error) {
    console.error('Failed to parse SSE event:', error);
    return null;
  }
}

/**
 * Create SSE event listener
 */
export function createSSEListener<T = unknown>(
  url: string,
  onEvent: (event: SSEEvent<T>) => void,
  onError?: (error: Event) => void
): () => void {
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event: MessageEvent) => {
    const data = parseSSEEvent(event.data);
    if (data) {
      onEvent(data as SSEEvent<T>);
    }
  };

  eventSource.onerror = (error: Event) => {
    onError?.(error);
    eventSource.close();
  };

  // Return cleanup function
  return () => {
    eventSource.close();
  };
}
