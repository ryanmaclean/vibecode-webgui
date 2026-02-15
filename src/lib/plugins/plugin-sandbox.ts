/**
 * Plugin Sandbox
 * Provides isolated execution environment for plugins with security restrictions
 *
 * SECURITY NOTE: This implementation uses Node.js's built-in vm module.
 * For production use, consider upgrading to VM2 or isolated-vm for stronger isolation.
 */

import vm from 'vm';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import {
  PluginSandboxConfig,
  PluginContext,
  PluginPermission
} from '@/types/plugin';

/**
 * Sandbox execution result
 */
export interface SandboxExecutionResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: Error;
  executionTime: number;
  memoryUsed?: number;
}

/**
 * Sandbox execution options
 */
export interface SandboxExecutionOptions {
  timeout?: number;
  context?: Record<string, unknown>;
  allowAsync?: boolean;
}

/**
 * Default sandbox configuration
 */
const DEFAULT_SANDBOX_CONFIG: PluginSandboxConfig = {
  timeout: 30000,              // 30 seconds
  memoryLimit: 256,            // 256 MB
  cpuLimit: 5000,              // 5 seconds CPU time
  allowedPaths: [],
  allowedHosts: []
};

/**
 * Plugin Sandbox class
 * Creates isolated execution environments for plugin code
 */
export class PluginSandbox {
  private config: PluginSandboxConfig;
  private context: PluginContext;
  private sandboxContext: vm.Context | null = null;
  private eventEmitter: EventEmitter;

  constructor(context: PluginContext, config?: Partial<PluginSandboxConfig>) {
    this.context = context;
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Create sandbox context with restricted APIs
   */
  private createSandboxContext(): vm.Context {
    const sandboxGlobal = {
      // Safe globals
      console: this.createRestrictedConsole(),
      setTimeout: this.createRestrictedSetTimeout(),
      setInterval: this.createRestrictedSetInterval(),
      clearTimeout,
      clearInterval,
      Promise,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Date,
      Math,
      JSON,
      Error,
      TypeError,
      RangeError,

      // Plugin-specific APIs
      pluginContext: this.context,
      logger: this.context.logger,

      // Restricted filesystem access (if permission granted)
      fs: this.createRestrictedFS(),

      // Restricted network access (if permission granted)
      fetch: this.createRestrictedFetch(),

      // Event emitter for plugin communication
      emit: this.emit.bind(this),
      on: this.on.bind(this),

      // Utility functions
      require: this.createRestrictedRequire(),
    };

    return vm.createContext(sandboxGlobal);
  }

  /**
   * Create restricted console that logs through plugin logger
   */
  private createRestrictedConsole() {
    return {
      log: (...args: unknown[]) => this.context.logger.info(String(args.join(' '))),
      info: (...args: unknown[]) => this.context.logger.info(String(args.join(' '))),
      warn: (...args: unknown[]) => this.context.logger.warn(String(args.join(' '))),
      error: (...args: unknown[]) => this.context.logger.error(String(args.join(' '))),
      debug: (...args: unknown[]) => this.context.logger.debug(String(args.join(' '))),
    };
  }

  /**
   * Create restricted setTimeout with timeout limits
   */
  private createRestrictedSetTimeout() {
    return (callback: () => void, delay: number) => {
      const maxDelay = Math.min(delay, this.config.timeout);
      return setTimeout(callback, maxDelay);
    };
  }

  /**
   * Create restricted setInterval with timeout limits
   */
  private createRestrictedSetInterval() {
    return (callback: () => void, delay: number) => {
      const maxDelay = Math.min(delay, this.config.timeout);
      return setInterval(callback, maxDelay);
    };
  }

  /**
   * Create restricted filesystem access based on permissions
   */
  private createRestrictedFS() {
    const hasReadPermission = this.hasPermission('filesystem:read');
    const hasWritePermission = this.hasPermission('filesystem:write');

    if (!hasReadPermission && !hasWritePermission) {
      return undefined;
    }

    const restrictedFS: Record<string, unknown> = {};

    // Only allow access to plugin's data directory and explicitly allowed paths
    const isPathAllowed = (filePath: string): boolean => {
      const resolvedPath = path.resolve(filePath);
      const dataPath = path.resolve(this.context.dataPath);

      // Always allow plugin's data directory
      if (resolvedPath.startsWith(dataPath)) {
        return true;
      }

      // Check explicitly allowed paths
      return this.config.allowedPaths.some(allowedPath => {
        const resolvedAllowedPath = path.resolve(allowedPath);
        return resolvedPath.startsWith(resolvedAllowedPath);
      });
    };

    if (hasReadPermission) {
      restrictedFS.readFile = async (filePath: string) => {
        if (!isPathAllowed(filePath)) {
          throw new Error(`Access denied: ${filePath} is not in allowed paths`);
        }
        return fs.readFile(filePath, 'utf-8');
      };

      restrictedFS.readdir = async (dirPath: string) => {
        if (!isPathAllowed(dirPath)) {
          throw new Error(`Access denied: ${dirPath} is not in allowed paths`);
        }
        return fs.readdir(dirPath);
      };

      restrictedFS.stat = async (filePath: string) => {
        if (!isPathAllowed(filePath)) {
          throw new Error(`Access denied: ${filePath} is not in allowed paths`);
        }
        return fs.stat(filePath);
      };
    }

    if (hasWritePermission) {
      restrictedFS.writeFile = async (filePath: string, data: string) => {
        if (!isPathAllowed(filePath)) {
          throw new Error(`Access denied: ${filePath} is not in allowed paths`);
        }
        return fs.writeFile(filePath, data, 'utf-8');
      };

      restrictedFS.mkdir = async (dirPath: string) => {
        if (!isPathAllowed(dirPath)) {
          throw new Error(`Access denied: ${dirPath} is not in allowed paths`);
        }
        return fs.mkdir(dirPath, { recursive: true });
      };

      restrictedFS.unlink = async (filePath: string) => {
        if (!isPathAllowed(filePath)) {
          throw new Error(`Access denied: ${filePath} is not in allowed paths`);
        }
        return fs.unlink(filePath);
      };
    }

    return restrictedFS;
  }

  /**
   * Create restricted fetch based on network permissions
   */
  private createRestrictedFetch() {
    if (!this.hasPermission('network:outbound')) {
      return undefined;
    }

    return async (url: string, options?: RequestInit) => {
      // Parse URL to check against allowed hosts
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Check if host is allowed
      if (this.config.allowedHosts.length > 0) {
        const isHostAllowed = this.config.allowedHosts.some(allowedHost => {
          return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
        });

        if (!isHostAllowed) {
          throw new Error(`Network access denied: ${hostname} is not in allowed hosts`);
        }
      }

      // Use native fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };
  }

  /**
   * Create restricted require function
   * Only allows requiring safe built-in modules and plugin dependencies
   */
  private createRestrictedRequire() {
    const allowedBuiltins = [
      'events',
      'util',
      'crypto',
      'url',
      'querystring',
      'path'
    ];

    return (moduleName: string) => {
      // Only allow specific built-in modules
      if (allowedBuiltins.includes(moduleName)) {
        return require(moduleName);
      }

      throw new Error(`Module '${moduleName}' is not allowed in sandbox`);
    };
  }

  /**
   * Check if plugin has a specific permission
   */
  private hasPermission(permission: PluginPermission): boolean {
    return this.context.permissions.includes(permission);
  }

  /**
   * Event emitter methods for plugin communication
   */
  private emit(event: string, ...args: unknown[]): boolean {
    return this.eventEmitter.emit(event, ...args);
  }

  private on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Execute code in sandbox
   */
  async execute<T = unknown>(
    code: string,
    options: SandboxExecutionOptions = {}
  ): Promise<SandboxExecutionResult<T>> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Create or reuse sandbox context
      if (!this.sandboxContext) {
        this.sandboxContext = this.createSandboxContext();
      }

      // Apply custom context if provided
      if (options.context) {
        Object.assign(this.sandboxContext, options.context);
      }

      // Determine timeout
      const timeout = options.timeout || this.config.timeout;

      // Execute code in sandbox
      let result: T;

      if (options.allowAsync) {
        // For async code, wrap in async function
        const wrappedCode = `(async () => { ${code} })()`;
        const script = new vm.Script(wrappedCode);
        result = await script.runInContext(this.sandboxContext, {
          timeout,
          displayErrors: true
        }) as T;
      } else {
        // Synchronous execution
        const script = new vm.Script(code);
        result = script.runInContext(this.sandboxContext, {
          timeout,
          displayErrors: true
        }) as T;
      }

      const executionTime = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = Math.max(0, endMemory - startMemory) / (1024 * 1024); // Convert to MB

      // Check memory limit
      if (memoryUsed > this.config.memoryLimit) {
        this.context.logger.warn(
          `Plugin exceeded memory limit: ${memoryUsed.toFixed(2)}MB / ${this.config.memoryLimit}MB`
        );
      }

      return {
        success: true,
        result,
        executionTime,
        memoryUsed
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.context.logger.error('Sandbox execution failed', error);

      return {
        success: false,
        error: error as Error,
        executionTime
      };
    }
  }

  /**
   * Execute a function in sandbox
   */
  async executeFunction<T = unknown>(
    fn: (...args: unknown[]) => T | Promise<T>,
    args: unknown[] = [],
    options: SandboxExecutionOptions = {}
  ): Promise<SandboxExecutionResult<T>> {
    // Convert function to string and execute
    const fnString = fn.toString();
    const argsString = JSON.stringify(args);
    const code = `(${fnString})(...${argsString})`;

    return this.execute<T>(code, {
      ...options,
      allowAsync: true
    });
  }

  /**
   * Reset sandbox context
   */
  reset(): void {
    this.sandboxContext = null;
  }

  /**
   * Clean up sandbox resources
   */
  destroy(): void {
    this.reset();
    this.eventEmitter.removeAllListeners();
  }
}

/**
 * Create a new plugin sandbox
 */
export function createPluginSandbox(
  context: PluginContext,
  config?: Partial<PluginSandboxConfig>
): PluginSandbox {
  return new PluginSandbox(context, config);
}

/**
 * Execute code in a one-time sandbox (utility function)
 */
export async function executeInSandbox<T = unknown>(
  code: string,
  context: PluginContext,
  config?: Partial<PluginSandboxConfig>,
  options?: SandboxExecutionOptions
): Promise<SandboxExecutionResult<T>> {
  const sandbox = createPluginSandbox(context, config);

  try {
    return await sandbox.execute<T>(code, options);
  } finally {
    sandbox.destroy();
  }
}

export default PluginSandbox;
