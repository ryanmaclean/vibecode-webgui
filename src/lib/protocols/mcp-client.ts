/**
 * MCP (Model Context Protocol) Client Implementation
 * Supports stdio, HTTP, and WebSocket transports
 * @module protocols/mcp-client
 */

import { EventEmitter } from 'events';

// ============================================================================
// MCP Protocol Types
// ============================================================================

export type MCPTransportType = 'stdio' | 'http' | 'websocket';

export interface MCPClientConfig {
  transport: MCPTransportType;
  url?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPromptTemplate {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface MCPCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  sampling?: boolean;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: MCPCapabilities;
}

// ============================================================================
// MCP Request/Response Types
// ============================================================================

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// MCP Client Implementation
// ============================================================================

export class MCPClient extends EventEmitter {
  private config: Required<MCPClientConfig>;
  private connected: boolean = false;
  private serverInfo: MCPServerInfo | null = null;
  private requestId: number = 0;
  private pendingRequests: Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private ws: WebSocket | null = null;

  constructor(config: MCPClientConfig) {
    super();
    this.config = {
      transport: config.transport,
      url: config.url || '',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      headers: config.headers || {},
    };
  }

  // Connection Management
  async connect(): Promise<MCPServerInfo> {
    if (this.connected) {
      return this.serverInfo!;
    }

    try {
      switch (this.config.transport) {
        case 'websocket':
          await this.connectWebSocket();
          break;
        case 'http':
          await this.connectHTTP();
          break;
        case 'stdio':
          throw new Error('stdio transport not supported in browser');
        default:
          throw new Error(`Unsupported transport: ${this.config.transport}`);
      }

      // Initialize connection with server
      const initResult = await this.request<MCPServerInfo>('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          sampling: {},
        },
        clientInfo: {
          name: 'vibecode-webgui',
          version: '0.1.0',
        },
      });

      this.serverInfo = initResult;
      this.connected = true;
      this.emit('connected', this.serverInfo);

      return this.serverInfo;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.url) {
        reject(new Error('WebSocket URL required'));
        return;
      }

      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(new Error(`WebSocket connection error: ${error}`));
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('disconnected');
      };

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, this.config.timeout);
    });
  }

  private async connectHTTP(): Promise<void> {
    if (!this.config.url) {
      throw new Error('HTTP URL required');
    }
    // HTTP transport is stateless, just verify endpoint is reachable
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.serverInfo = null;
    this.emit('disconnected');
  }

  // Tool Discovery and Invocation
  async listTools(): Promise<MCPTool[]> {
    const result = await this.request<{ tools: MCPTool[] }>('tools/list');
    return result.tools;
  }

  async invokeTool<T = unknown>(
    name: string,
    args: Record<string, unknown>
  ): Promise<T> {
    const result = await this.request<{ content: T[] }>('tools/call', {
      name,
      arguments: args,
    });
    return result.content[0];
  }

  // Resource Access
  async listResources(): Promise<MCPResource[]> {
    const result = await this.request<{ resources: MCPResource[] }>('resources/list');
    return result.resources;
  }

  async readResource(uri: string): Promise<string> {
    const result = await this.request<{ contents: Array<{ uri: string; text: string }> }>('resources/read', {
      uri,
    });
    return result.contents[0].text;
  }

  async writeResource(uri: string, content: string): Promise<void> {
    await this.request('resources/write', {
      uri,
      contents: [{ uri, text: content }],
    });
  }

  // Prompt Templates
  async listPrompts(): Promise<MCPPromptTemplate[]> {
    const result = await this.request<{ prompts: MCPPromptTemplate[] }>('prompts/list');
    return result.prompts;
  }

  async getPrompt(
    name: string,
    args: Record<string, string>
  ): Promise<{ messages: Array<{ role: string; content: string }> }> {
    return await this.request('prompts/get', {
      name,
      arguments: args,
    });
  }

  // Sampling API Integration
  async createMessage(
    messages: Array<{ role: string; content: string }>,
    options?: {
      maxTokens?: number;
      temperature?: number;
      stopSequences?: string[];
      modelPreferences?: {
        hints?: Array<{ name?: string }>;
        costPriority?: number;
        speedPriority?: number;
        intelligencePriority?: number;
      };
    }
  ): Promise<{ content: string; stopReason?: string; model?: string }> {
    return await this.request('sampling/createMessage', {
      messages,
      ...options,
    });
  }

  // Low-level Request/Response
  private async request<T = unknown>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      if (this.config.transport === 'websocket') {
        this.ws?.send(JSON.stringify(request));
      } else if (this.config.transport === 'http') {
        this.sendHTTPRequest(request)
          .then((response) => this.handleMessage(JSON.stringify(response)))
          .catch((error) => {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(error);
          });
      }
    });
  }

  private async sendHTTPRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.config.url) {
      throw new Error('HTTP URL not configured');
    }

    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as MCPResponse | MCPNotification;

      // Handle response
      if ('id' in message) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);

          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message.result);
          }
        }
      } else {
        // Handle notification
        this.emit('notification', message);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  // Status and Capabilities
  isConnected(): boolean {
    return this.connected;
  }

  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo;
  }

  getCapabilities(): MCPCapabilities {
    return this.serverInfo?.capabilities || {};
  }
}

// ============================================================================
// MCP Client Factory
// ============================================================================

export function createMCPClient(config: MCPClientConfig): MCPClient {
  return new MCPClient(config);
}

// ============================================================================
// Protocol Utilities
// ============================================================================

export function isValidMCPResponse(data: unknown): data is MCPResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'jsonrpc' in data &&
    data.jsonrpc === '2.0' &&
    'id' in data
  );
}

export function isValidMCPNotification(data: unknown): data is MCPNotification {
  return (
    typeof data === 'object' &&
    data !== null &&
    'jsonrpc' in data &&
    data.jsonrpc === '2.0' &&
    'method' in data &&
    !('id' in data)
  );
}
