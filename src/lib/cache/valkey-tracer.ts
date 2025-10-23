/**
 * Custom tracing for ValKey/Redis operations
 * Integrates with Datadog APM for detailed monitoring
 */

import tracer from 'dd-trace';
// import { logger } from '../server-monitoring';

// Interface for the ValKey operation details
interface ValKeyOperation {
  command: string;
  args?: any[];
  key?: string;
  keys?: string[];
  startTime: number;
  endTime?: number;
  error?: Error;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  source: string;
}

/**
 * ValKey/Redis operation tracer
 * Wraps Redis/ValKey commands in Datadog APM traces
 */
class ValKeyTracer {
  private operations: Map<string, ValKeyOperation> = new Map();
  private readonly enabled: boolean;
  private readonly tracingEnabled: boolean;

  constructor() {
    this.enabled = process.env.NODE_ENV !== 'test';
    this.tracingEnabled = Boolean(process.env.DD_API_KEY && process.env.DD_APM_ENABLED !== 'false');
    
    if (this.tracingEnabled) {
      console.log('ValKey APM tracing enabled');
    }
  }

  /**
   * Start tracking an operation
   */
  startOperation(command: string, args: any[] = [], source: string): string {
    if (!this.enabled) return '';
    
    const operationId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Extract key/keys from arguments based on command
    const keys: string[] = [];
    let key: string | undefined;
    
    if (['get', 'set', 'del', 'exists', 'incr', 'expire'].includes(command.toLowerCase())) {
      key = String(args[0] || '');
      keys.push(key);
    } else if (['mget', 'mset'].includes(command.toLowerCase())) {
      if (Array.isArray(args[0])) {
        keys.push(...args[0].map(String));
      } else if (typeof args[0] === 'object') {
        keys.push(...Object.keys(args[0]));
      }
    }
    
    this.operations.set(operationId, {
      command,
      args,
      key,
      keys,
      startTime: Date.now(),
      status: 'pending',
      source
    });
    
    // Start Datadog span if tracing is enabled
    if (this.tracingEnabled) {
      const span = tracer.startSpan('valkey.operation');
      span.setTag('valkey.command', command);
      span.setTag('valkey.source', source);
      
      if (key) {
        span.setTag('valkey.key', key);
      }
      
      if (keys.length > 0) {
        span.setTag('valkey.key_count', keys.length);
      }
      
      // Store span in operation
      (this.operations.get(operationId) as any).span = span;
    }
    
    return operationId;
  }
  
  /**
   * Complete an operation with success
   */
  endOperation(operationId: string, result?: any): void {
    if (!this.enabled || !operationId) return;
    
    const operation = this.operations.get(operationId);
    if (!operation) return;
    
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.status = 'success';
    
    // Log successful operations
    if (operation.duration > 50) {
      // Only log slower operations
      console.log('ValKey operation completed', {
        command: operation.command,
        duration: operation.duration,
        key: operation.key,
        keyCount: operation.keys?.length,
        source: operation.source
      });
    }
    
    // Finish Datadog span if tracing is enabled
    if (this.tracingEnabled && (operation as any).span) {
      const span = (operation as any).span;
      span.setTag('valkey.duration', operation.duration);
      span.setTag('valkey.status', 'success');
      
      // For get operations, track hit/miss
      if (operation.command.toLowerCase() === 'get') {
        const hit = result !== null && result !== undefined;
        span.setTag('valkey.hit', hit);
      }
      
      span.finish();
    }
    
    this.operations.delete(operationId);
  }
  
  /**
   * Complete an operation with error
   */
  errorOperation(operationId: string, error: Error): void {
    if (!this.enabled || !operationId) return;
    
    const operation = this.operations.get(operationId);
    if (!operation) return;
    
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.status = 'error';
    operation.error = error;
    
    // Log failed operations
    console.error('ValKey operation failed', {
      command: operation.command,
      duration: operation.duration,
      key: operation.key,
      keyCount: operation.keys?.length,
      source: operation.source,
      error: error.message,
      stack: error.stack
    });
    
    // Finish Datadog span if tracing is enabled
    if (this.tracingEnabled && (operation as any).span) {
      const span = (operation as any).span;
      span.setTag('valkey.duration', operation.duration);
      span.setTag('valkey.status', 'error');
      span.setTag('error', true);
      span.setTag('error.type', error.name);
      span.setTag('error.msg', error.message);
      span.setTag('error.stack', error.stack);
      span.finish();
    }
    
    this.operations.delete(operationId);
  }
  
  /**
   * Get active operations for debugging
   */
  getActiveOperations(): ValKeyOperation[] {
    return Array.from(this.operations.values());
  }
  
  /**
   * Helper to wrap a ValKey/Redis command with tracing
   */
  async traceCommand<T>(
    command: string, 
    args: any[] = [], 
    source: string,
    executor: () => Promise<T>
  ): Promise<T> {
    const operationId = this.startOperation(command, args, source);
    
    try {
      const result = await executor();
      this.endOperation(operationId, result);
      return result;
    } catch (error) {
      this.errorOperation(operationId, error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const valkeyTracer = new ValKeyTracer();
export default valkeyTracer;