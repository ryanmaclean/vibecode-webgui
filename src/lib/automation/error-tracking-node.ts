/**
 * Datadog Error Tracking Automation for Node.js Scripts
 * 
 * This module provides automatic error tracking for all Node.js scripts,
 * automation tools, and CI/CD processes.
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

export interface ErrorTrackingConfig {
  enabled: boolean;
  service: string;
  environment: string;
  version: string;
  apiKey?: string;
  site?: string;
}

export interface ScriptContext {
  scriptName: string;
  scriptPath: string;
  scriptArgs: string[];
  component: string;
  action: string;
  hostname: string;
  user: string;
  workingDirectory: string;
  nodeVersion: string;
  platform: string;
  warningName?: string;
  warningStack?: string;
}

export interface ErrorContext {
  error: Error;
  context: ScriptContext;
  additionalData?: Record<string, any>;
  tags?: Record<string, string>;
}

class NodeScriptErrorTracker {
  private config: ErrorTrackingConfig;
  private context: ScriptContext;
  private startTime: number;

  constructor(config: ErrorTrackingConfig, context: ScriptContext) {
    this.config = config;
    this.context = context;
    this.startTime = Date.now();
  }

  /**
   * Initialize error tracking for the script
   */
  init(): void {
    if (!this.config.enabled || !this.config.apiKey) {
      console.log('⚠️  Datadog Error Tracking is disabled or not configured');
      return;
    }

    // Set up global error handlers
    this.setupGlobalErrorHandlers();

    // Track script start
    this.trackScriptStart();

    console.log(`📊 Datadog Error Tracking initialized for ${this.context.scriptName}`);
  }

  /**
   * Set up global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.trackError({
        error,
        context: this.context,
        additionalData: {
          errorType: 'uncaughtException',
          processUptime: process.uptime()
        },
        tags: {
          error_type: 'uncaught_exception'
        }
      });
      
      // Re-throw to maintain normal behavior
      throw error;
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.trackError({
        error,
        context: this.context,
        additionalData: {
          errorType: 'unhandledRejection',
          promise: promise.toString(),
          processUptime: process.uptime()
        },
        tags: {
          error_type: 'unhandled_rejection'
        }
      });
    });

    // Handle warnings
    process.on('warning', (warning) => {
      this.trackWarning(warning.message, {
        ...this.context,
        warningName: warning.name,
        warningStack: warning.stack
      });
    });
  }

  /**
   * Track script start
   */
  private trackScriptStart(): void {
    if (!this.config.enabled || !this.config.apiKey) return;

    const payload = {
      timestamp: new Date().toISOString(),
      service: this.config.service,
      env: this.config.environment,
      version: this.config.version,
      message: `Script started: ${this.context.scriptName}`,
      context: {
        ...this.context,
        startTime: this.startTime,
        pid: process.pid,
        memoryUsage: process.memoryUsage()
      },
      tags: [
        `service:${this.config.service}`,
        `env:${this.config.environment}`,
        `component:${this.context.component}`,
        `script:${this.context.scriptName}`,
        'event_type:script_start'
      ]
    };

    this.sendToDatadog(payload);
  }

  /**
   * Track script completion
   */
  trackScriptCompletion(exitCode: number = 0): void {
    if (!this.config.enabled || !this.config.apiKey) return;

    const duration = Date.now() - this.startTime;
    const payload = {
      timestamp: new Date().toISOString(),
      service: this.config.service,
      env: this.config.environment,
      version: this.config.version,
      message: `Script completed: ${this.context.scriptName}`,
      context: {
        ...this.context,
        exitCode,
        duration,
        endTime: Date.now(),
        pid: process.pid,
        memoryUsage: process.memoryUsage()
      },
      tags: [
        `service:${this.config.service}`,
        `env:${this.config.environment}`,
        `component:${this.context.component}`,
        `script:${this.context.scriptName}`,
        'event_type:script_completion',
        `exit_code:${exitCode}`
      ]
    };

    this.sendToDatadog(payload);
  }

  /**
   * Track an error
   */
  trackError(errorContext: ErrorContext): void {
    if (!this.config.enabled || !this.config.apiKey) return;

    const payload = {
      timestamp: new Date().toISOString(),
      service: this.config.service,
      env: this.config.environment,
      version: this.config.version,
      error: {
        message: errorContext.error.message,
        name: errorContext.error.name,
        stack: errorContext.error.stack
      },
      context: {
        ...errorContext.context,
        ...errorContext.additionalData,
        processUptime: process.uptime(),
        pid: process.pid,
        memoryUsage: process.memoryUsage()
      },
      tags: [
        `service:${this.config.service}`,
        `env:${this.config.environment}`,
        `component:${errorContext.context.component}`,
        `script:${errorContext.context.scriptName}`,
        'error_type:script_execution',
        ...Object.entries(errorContext.tags || {}).map(([key, value]) => `${key}:${value}`)
      ]
    };

    this.sendToDatadog(payload);
    console.error(`❌ Error tracked: ${errorContext.error.name} - ${errorContext.error.message}`);
  }

  /**
   * Track a warning
   */
  trackWarning(message: string, context: Partial<ScriptContext> = {}): void {
    if (!this.config.enabled || !this.config.apiKey) return;

    const payload = {
      timestamp: new Date().toISOString(),
      service: this.config.service,
      env: this.config.environment,
      version: this.config.version,
      message: `Warning: ${message}`,
      context: {
        ...this.context,
        ...context,
        warningMessage: message,
        processUptime: process.uptime(),
        pid: process.pid
      },
      tags: [
        `service:${this.config.service}`,
        `env:${this.config.environment}`,
        `component:${this.context.component}`,
        `script:${this.context.scriptName}`,
        'event_type:warning'
      ]
    };

    this.sendToDatadog(payload);
    console.warn(`⚠️  Warning tracked: ${message}`);
  }

  /**
   * Track command execution
   */
  trackCommandExecution(command: string, exitCode: number, output?: string): void {
    if (!this.config.enabled || !this.config.apiKey) return;

    const payload = {
      timestamp: new Date().toISOString(),
      service: this.config.service,
      env: this.config.environment,
      version: this.config.version,
      message: `Command executed: ${command}`,
      context: {
        ...this.context,
        command,
        exitCode,
        output: output?.substring(0, 1000), // Limit output size
        processUptime: process.uptime(),
        pid: process.pid
      },
      tags: [
        `service:${this.config.service}`,
        `env:${this.config.environment}`,
        `component:${this.context.component}`,
        `script:${this.context.scriptName}`,
        'event_type:command_execution',
        `exit_code:${exitCode}`
      ]
    };

    this.sendToDatadog(payload);
  }

  /**
   * Track performance metrics
   */
  trackPerformanceMetric(metricName: string, value: number, unit: string = 'ms'): void {
    if (!this.config.enabled || !this.config.apiKey) return;

    const payload = {
      timestamp: new Date().toISOString(),
      service: this.config.service,
      env: this.config.environment,
      version: this.config.version,
      message: `Performance metric: ${metricName} = ${value} ${unit}`,
      context: {
        ...this.context,
        metricName,
        metricValue: value,
        metricUnit: unit,
        processUptime: process.uptime(),
        pid: process.pid,
        memoryUsage: process.memoryUsage()
      },
      tags: [
        `service:${this.config.service}`,
        `env:${this.config.environment}`,
        `component:${this.context.component}`,
        `script:${this.context.scriptName}`,
        `metric_name:${metricName}`,
        'event_type:performance_metric'
      ]
    };

    this.sendToDatadog(payload);
  }

  /**
   * Track database operations
   */
  trackDatabaseOperation(operation: string, success: boolean, duration?: number, error?: Error): void {
    if (!this.config.enabled || !this.config.apiKey) return;

    const payload = {
      timestamp: new Date().toISOString(),
      service: this.config.service,
      env: this.config.environment,
      version: this.config.version,
      message: `Database operation: ${operation}`,
      context: {
        ...this.context,
        databaseOperation: operation,
        success,
        duration,
        error: error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : undefined,
        processUptime: process.uptime(),
        pid: process.pid
      },
      tags: [
        `service:${this.config.service}`,
        `env:${this.config.environment}`,
        `component:${this.context.component}`,
        `script:${this.context.scriptName}`,
        'event_type:database_operation',
        `operation:${operation}`,
        `success:${success}`
      ]
    };

    this.sendToDatadog(payload);
  }

  /**
   * Track API calls
   */
  trackApiCall(url: string, method: string, statusCode: number, duration?: number, error?: Error): void {
    if (!this.config.enabled || !this.config.apiKey) return;

    const payload = {
      timestamp: new Date().toISOString(),
      service: this.config.service,
      env: this.config.environment,
      version: this.config.version,
      message: `API call: ${method} ${url}`,
      context: {
        ...this.context,
        apiUrl: url,
        apiMethod: method,
        statusCode,
        duration,
        error: error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : undefined,
        processUptime: process.uptime(),
        pid: process.pid
      },
      tags: [
        `service:${this.config.service}`,
        `env:${this.config.environment}`,
        `component:${this.context.component}`,
        `script:${this.context.scriptName}`,
        'event_type:api_call',
        `method:${method}`,
        `status_code:${statusCode}`
      ]
    };

    this.sendToDatadog(payload);
  }

  /**
   * Send data to Datadog
   */
  private async sendToDatadog(payload: Record<string, unknown>): Promise<void> {
    try {
      const response = await fetch(`https://http-intake.logs.datadoghq.com/v1/input/${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        console.warn(`Failed to send data to Datadog: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to send data to Datadog:', error);
    }
  }
}

/**
 * Create error tracker instance
 */
export function createScriptErrorTracker(
  scriptName: string,
  component: string = 'script',
  action: string = 'execution'
): NodeScriptErrorTracker {
  const config: ErrorTrackingConfig = {
    enabled: process.env.DD_ERROR_TRACKING_ENABLED === 'true',
    service: process.env.DD_SERVICE || 'vibecode-webgui',
    environment: process.env.DD_ENV || process.env.NODE_ENV || 'development',
    version: process.env.DD_VERSION || '1.0.0',
    apiKey: process.env.DD_API_KEY,
    site: process.env.DD_SITE || 'datadoghq.com'
  };

  const context: ScriptContext = {
    scriptName,
    scriptPath: process.argv[1] || scriptName,
    scriptArgs: process.argv.slice(2),
    component,
    action,
    hostname: require('os').hostname(),
    user: require('os').userInfo().username,
    workingDirectory: process.cwd(),
    nodeVersion: process.version,
    platform: process.platform
  };

  return new NodeScriptErrorTracker(config, context);
}

/**
 * Safe command execution with error tracking
 */
export async function safeExecuteCommand(
  command: string,
  errorTracker: NodeScriptErrorTracker,
  options: Record<string, unknown> = {}
): Promise<{ success: boolean; output?: string; error?: Error }> {
  const startTime = Date.now();
  
  try {
    console.log(`🔧 Executing: ${command}`);
    
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      ...options
    });

    const duration = Date.now() - startTime;
    errorTracker.trackCommandExecution(command, 0, output);
    errorTracker.trackPerformanceMetric('command_execution_time', duration);

    return { success: true, output };
  } catch (error) {
    const duration = Date.now() - startTime;
    const exitCode = (error as { status?: number }).status || 1;
    
    errorTracker.trackCommandExecution(command, exitCode, (error as { stdout?: string }).stdout);
    errorTracker.trackPerformanceMetric('command_execution_time', duration);
    
    if (error instanceof Error) {
      errorTracker.trackError({
        error,
        context: errorTracker['context'],
        additionalData: {
          command,
          exitCode,
          duration
        },
        tags: {
          error_type: 'command_execution'
        }
      });
    }

    return { success: false, error: error as Error };
  }
}

/**
 * Utility function to check error tracking availability
 */
export function checkErrorTrackingAvailability(): boolean {
  const enabled = process.env.DD_ERROR_TRACKING_ENABLED === 'true';
  const apiKey = process.env.DD_API_KEY;
  
  if (!enabled || !apiKey) {
    console.log('⚠️  Datadog Error Tracking is disabled or not configured');
    console.log('   Set DD_ERROR_TRACKING_ENABLED=true and DD_API_KEY to enable');
    return false;
  }
  
  return true;
}

// Export the class for advanced usage
export { NodeScriptErrorTracker };
