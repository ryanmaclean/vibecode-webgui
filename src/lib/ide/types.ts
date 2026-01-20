/**
 * IDE Abstraction Layer Types
 * Supports OpenVSCode Server, Code-Server, and Eclipse Theia
 */

// Available IDE types as const array for type safety and iteration
export const IDE_TYPES = ['openvscode', 'code-server', 'theia'] as const;

// IDE Type derived from the const array
export type IDEType = typeof IDE_TYPES[number];

export type IDEStatus = 'starting' | 'ready' | 'error' | 'stopped';

export interface IDEConfig {
  type: IDEType;
  port?: number;
  workspaceId: string;
  userId: string;
  projectPath?: string;
  image?: string;
  extensions?: string[];
  auth?: {
    enabled: boolean;
    password?: string;
    token?: string;
  };
  resources?: {
    memory?: string;
    cpu?: string;
  };
}

export interface IDESession {
  id: string;
  type: IDEType;
  url: string;
  status: IDEStatus;
  workspaceId: string;
  userId: string;
  containerId?: string;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, unknown>;
}

export interface IDEHealthCheck {
  healthy: boolean;
  status: IDEStatus;
  message?: string;
  timestamp: Date;
}

/**
 * Base interface for all IDE implementations
 */
export interface WebIDE {
  /**
   * IDE identifier (e.g., "openvscode", "code-server", "theia")
   */
  readonly name: IDEType;

  /**
   * Start an IDE session with the given configuration
   */
  start(config: IDEConfig): Promise<IDESession>;

  /**
   * Stop a running IDE session
   */
  stop(sessionId: string): Promise<void>;

  /**
   * Get the current session status
   */
  getSession(sessionId: string): Promise<IDESession | null>;

  /**
   * Get the URL to access the IDE
   */
  getURL(sessionId: string): Promise<string>;

  /**
   * Perform a health check on the IDE instance
   */
  healthCheck(sessionId: string): Promise<IDEHealthCheck>;

  /**
   * Install extensions (IDE-specific)
   */
  installExtension?(sessionId: string, extensionId: string): Promise<void>;

  /**
   * List installed extensions
   */
  listExtensions?(sessionId: string): Promise<string[]>;
}

/**
 * IDE feature capabilities
 */
export interface IDECapabilities {
  type: IDEType;
  features: {
    builtInAuth: boolean;
    marketplaceAccess: 'full' | 'openvsx' | 'none';
    debugging: boolean;
    terminal: boolean;
    git: boolean;
    customization: 'high' | 'medium' | 'low';
    remoteDevelopment: boolean;
  };
  performance: {
    memory: 'high' | 'medium' | 'low';
    startup: 'fast' | 'medium' | 'slow';
  };
  licensing: string;
}

/**
 * IDE comparison matrix
 */
export const IDE_CAPABILITIES: Record<IDEType, IDECapabilities> = {
  openvscode: {
    type: 'openvscode',
    features: {
      builtInAuth: false,
      marketplaceAccess: 'full',
      debugging: true,
      terminal: true,
      git: true,
      customization: 'low',
      remoteDevelopment: true,
    },
    performance: {
      memory: 'high',
      startup: 'medium',
    },
    licensing: 'MIT',
  },
  'code-server': {
    type: 'code-server',
    features: {
      builtInAuth: true,
      marketplaceAccess: 'openvsx',
      debugging: true,
      terminal: true,
      git: true,
      customization: 'medium',
      remoteDevelopment: true,
    },
    performance: {
      memory: 'medium',
      startup: 'medium',
    },
    licensing: 'MIT',
  },
  theia: {
    type: 'theia',
    features: {
      builtInAuth: false,
      marketplaceAccess: 'openvsx',
      debugging: true,
      terminal: true,
      git: true,
      customization: 'high',
      remoteDevelopment: true,
    },
    performance: {
      memory: 'medium',
      startup: 'medium',
    },
    licensing: 'EPL-2.0 + MIT',
  },
};
