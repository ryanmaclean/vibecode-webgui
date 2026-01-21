/**
 * AgentAPI Client Implementation
 * HTTP client for coder/agentapi protocol
 * @module protocols/agentapi-client
 */

import {
AgentAPIConfig,
  APIResponse,
  AgentAPIError,
  StartAgentRequest,
  AgentResponse,
  AgentStatusResponse,
  AgentListResponse,
  ListAgentsQuery,
  StopAgentQuery,
  StopAgentResponse,
  AgentMessageRequest,
  SendMessageResponse,
  StreamEventsQuery,
  SSEEvent,
  WSClientMessages,
  WSServerMessages,
  HealthResponse,
  DEFAULT_CONFIG,
} from '@/types/agent-api';
// import { logger } from '@/lib/logger';
// ============================================================================
// AgentAPI Client
// ============================================================================

export class AgentAPIClient {
  private config: Required<AgentAPIConfig>;
  private baseUrl: string;

  constructor(config?: Partial<AgentAPIConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseUrl = this.config.baseUrl;
  }

  // ========================================================================
  // Agent Lifecycle Management
  // ========================================================================

  /**
   * Start a new agent instance
   * POST /agents
   */
  async startAgent(
    request: StartAgentRequest
  ): Promise<APIResponse<AgentResponse>> {
    return this.request<AgentResponse>('/agents', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get agent status
   * GET /agents/:agentId
   */
  async getAgent(agentId: string): Promise<APIResponse<AgentStatusResponse>> {
    return this.request<AgentStatusResponse>(`/agents/${agentId}`);
  }

  /**
   * List all agents
   * GET /agents
   */
  async listAgents(
    query?: ListAgentsQuery
  ): Promise<APIResponse<AgentListResponse>> {
    const queryString = query ? this.buildQueryString(query as Record<string, unknown>) : '';
    return this.request<AgentListResponse>(`/agents${queryString}`);
  }

  /**
   * Stop an agent
   * DELETE /agents/:agentId
   */
  async stopAgent(
    agentId: string,
    query?: StopAgentQuery
  ): Promise<APIResponse<StopAgentResponse>> {
    const queryString = query ? this.buildQueryString(query as Record<string, unknown>) : '';
    return this.request<StopAgentResponse>(
      `/agents/${agentId}${queryString}`,
      {
        method: 'DELETE',
      }
    );
  }

  // ========================================================================
  // Agent Messaging
  // ========================================================================

  /**
   * Send message to agent
   * POST /agents/:agentId/messages
   */
  async sendMessage(
    agentId: string,
    request: AgentMessageRequest
  ): Promise<APIResponse<SendMessageResponse>> {
    return this.request<SendMessageResponse>(
      `/agents/${agentId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Get agent output history
   * GET /agents/:agentId/messages
   */
  async getMessages(
    agentId: string,
    limit?: number
  ): Promise<APIResponse<{ messages: Array<{ timestamp: string; line: string }> }>> {
    const queryString = limit ? `?limit=${limit}` : '';
    return this.request(`/agents/${agentId}/messages${queryString}`);
  }

  // ========================================================================
  // Real-time Streaming
  // ========================================================================

  /**
   * Create SSE event stream connection
   * GET /agents/:agentId/events
   */
  createEventStream(
    agentId: string,
    query?: StreamEventsQuery,
    handlers?: {
      onOutput?: (data: { timestamp: string; line: string }) => void;
      onStatus?: (data: { timestamp: string; status: string; progress?: number }) => void;
      onError?: (data: { timestamp: string; error: string; code?: string }) => void;
      onComplete?: (data: { timestamp: string; status: string; exit_code: number }) => void;
      onHeartbeat?: (data: { timestamp: string }) => void;
    }
  ): EventSource {
    const queryString = query ? this.buildQueryString(query as Record<string, unknown>) : '';
    const url = `${this.baseUrl}/agents/${agentId}/events${queryString}`;
    const eventSource = new EventSource(url);

    if (handlers?.onOutput) {
      eventSource.addEventListener('output', (event) => {
        const data = JSON.parse(event.data);
        handlers.onOutput!(data);
      });
    }

    if (handlers?.onStatus) {
      eventSource.addEventListener('status', (event) => {
        const data = JSON.parse(event.data);
        handlers.onStatus!(data);
      });
    }

    if (handlers?.onError) {
      eventSource.addEventListener('error', (event) => {
        if (event instanceof MessageEvent) {
          const data = JSON.parse(event.data);
          handlers.onError!(data);
        }
      });
    }

    if (handlers?.onComplete) {
      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        handlers.onComplete!(data);
      });
    }

    if (handlers?.onHeartbeat) {
      eventSource.addEventListener('heartbeat', (event) => {
        const data = JSON.parse(event.data);
        handlers.onHeartbeat!(data);
      });
    }

    return eventSource;
  }

  /**
   * Create WebSocket connection
   * WS /agents/:agentId/ws
   */
  createWebSocket(
    agentId: string,
    handlers?: {
      onOpen?: () => void;
      onOutput?: (content: string, timestamp: string) => void;
      onStatus?: (status: string, progress?: number) => void;
      onError?: (error: string) => void;
      onComplete?: (exitCode: number) => void;
      onClose?: () => void;
    }
  ): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/agents/${agentId}/ws`, ['agent-v1']);

    ws.onopen = () => {
      handlers?.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSServerMessages;

        switch (message.type) {
          case 'output':
            handlers?.onOutput?.(message.content, message.timestamp);
            break;
          case 'status':
            handlers?.onStatus?.(message.status, message.progress);
            break;
          case 'error':
            handlers?.onError?.(message.error);
            break;
          case 'complete':
            handlers?.onComplete?.(message.exit_code);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      handlers?.onClose?.();
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return ws;
  }

  /**
   * Send message via WebSocket
   */
  sendWebSocketMessage(ws: WebSocket, content: string): void {
    const message: WSClientMessages = {
      type: 'message',
      content,
    };
    ws.send(JSON.stringify(message));
  }

  /**
   * Send ping via WebSocket
   */
  sendWebSocketPing(ws: WebSocket): void {
    const message: WSClientMessages = {
      type: 'ping',
    };
    ws.send(JSON.stringify(message));
  }

  // ========================================================================
  // Health and Status
  // ========================================================================

  /**
   * Check API health
   * GET /health
   */
  async getHealth(): Promise<APIResponse<HealthResponse>> {
    return this.request<HealthResponse>('/health');
  }

  // ========================================================================
  // Terminal Emulation
  // ========================================================================

  /**
   * Execute terminal command (wrapper for agent execution)
   */
  async executeCommand(
    workspace: string,
    command: string,
    agentType: 'aider' | 'goose' | 'cline' = 'aider',
    model: string = 'claude-3-5-sonnet-20241022'
  ): Promise<APIResponse<AgentResponse>> {
    return this.startAgent({
      agent_type: agentType,
      workspace,
      model: model as any,
      task: command,
    });
  }

  /**
   * Monitor agent output with ANSI stripping
   */
  monitorOutput(
    agentId: string,
    callback: (cleanOutput: string) => void
  ): EventSource {
    return this.createEventStream(agentId, undefined, {
      onOutput: (data) => {
        const cleanOutput = this.stripANSI(data.line);
        callback(cleanOutput);
      },
    });
  }

  /**
   * Strip ANSI escape codes from output
   */
  private stripANSI(text: string): string {
     
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  // ========================================================================
  // Protocol Negotiation
  // ========================================================================

  /**
   * Discover server capabilities
   */
  async discoverCapabilities(): Promise<{
    version: string;
    supportedAgents: string[];
    supportedModels: string[];
    maxConcurrent: number;
  }> {
    const health = await this.getHealth();
    return {
      version: health.data.version,
      supportedAgents: ['aider', 'goose', 'cline'],
      supportedModels: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'gpt-4o',
        'gpt-4o-mini',
        'deepseek-chat',
      ],
      maxConcurrent: health.data.agents?.max_concurrent || 20,
    };
  }

  /**
   * Negotiate protocol version
   */
  async negotiateVersion(
    requestedVersion: string
  ): Promise<{ version: string; compatible: boolean }> {
    const health = await this.getHealth();
    const serverVersion = health.data.version;
    const compatible = this.isVersionCompatible(requestedVersion, serverVersion);
    return { version: serverVersion, compatible };
  }

  private isVersionCompatible(requested: string, server: string): boolean {
    const [reqMajor] = requested.split('.');
    const [srvMajor] = server.split('.');
    return reqMajor === srvMajor;
  }

  // ========================================================================
  // Low-level HTTP Request
  // ========================================================================

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error | null = null;
    const maxAttempts = this.config.retries ? this.config.maxRetries : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const responseHeaders = this.parseHeaders(response.headers);

        // Handle error responses
        if (!response.ok) {
          const problemDetails = await response.json();
          throw new AgentAPIError(
            problemDetails,
            this.extractRateLimitHeaders(responseHeaders)
          );
        }

        // Parse successful response
        const data = await response.json();
        const duration = Date.now() - startTime;

        // Log performance if >50ms
        if (duration > 50) {
          console.warn(`AgentAPI request took ${duration}ms: ${options.method || 'GET'} ${path}`);
        }

        return {
          data,
          status: response.status,
          headers: responseHeaders,
          rateLimit: this.extractRateLimitHeaders(responseHeaders),
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) except 429
        if (error instanceof AgentAPIError && error.status < 500 && error.status !== 429) {
          throw error;
        }

        // Retry with exponential backoff
        if (attempt < maxAttempts) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  private extractRateLimitHeaders(headers: Record<string, string>) {
    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];
    const retryAfter = headers['retry-after'];

    if (limit || remaining || reset) {
      return {
        'X-RateLimit-Limit': parseInt(limit || '0'),
        'X-RateLimit-Remaining': parseInt(remaining || '0'),
        'X-RateLimit-Reset': parseInt(reset || '0'),
        ...(retryAfter && { 'Retry-After': parseInt(retryAfter) }),
      };
    }

    return undefined;
  }

  private buildQueryString(params: Record<string, unknown>): string {
    const entries = Object.entries(params).filter(([_, value]) => value !== undefined);
    if (entries.length === 0) return '';

    const searchParams = new URLSearchParams();
    entries.forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });

    return `?${searchParams.toString()}`;
  }
}

// ============================================================================
// AgentAPI Client Factory
// ============================================================================

export function createAgentAPIClient(config?: Partial<AgentAPIConfig>): AgentAPIClient {
  return new AgentAPIClient(config);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultClient: AgentAPIClient | null = null;

export function getDefaultAgentAPIClient(): AgentAPIClient {
  if (!defaultClient) {
    defaultClient = new AgentAPIClient();
  }
  return defaultClient;
}

export function setDefaultAgentAPIClient(client: AgentAPIClient): void {
  defaultClient = client;
}
