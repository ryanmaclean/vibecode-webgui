/**
 * Runtime-aware logger with Datadog APM integration.
 *
 * Uses Winston when running in the Node.js runtime (server/Edge-disabled routes),
 * and falls back to a lightweight console-based shim when executing in Edge
 * environments where Node primitives are unavailable.
 * 
 * Includes Datadog APM tracing and metrics integration for production monitoring.
 */

const isEdgeRuntime = typeof (globalThis as any).EdgeRuntime !== 'undefined';
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogContext {
  service?: string;
  component?: string;
  userId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  operation?: string;
  duration?: number;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    operation: string;
    duration: number;
    unit: string;
  };
  [key: string]: unknown;
}

type LogMethod = (message: unknown, metadata?: LogContext) => void;

interface StructuredLogger {
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
  
  // Convenience methods for common use cases
  http: (method: string, url: string, status: number, duration?: number, metadata?: LogContext) => void;
  security: (event: string, metadata?: LogContext) => void;
  performance: (operation: string, duration: number, metadata?: LogContext) => void;
  api: (endpoint: string, method: string, status: number, metadata?: LogContext) => void;
  
  // Enhanced monitoring methods with Datadog APM integration
  trace: (operation: string, fn: () => Promise<any>, metadata?: LogContext) => Promise<any>;
  metric: (name: string, value: number, tags?: Record<string, string>, metadata?: LogContext) => void;
  span: (operation: string, fn: () => any, metadata?: LogContext) => any;
  timing: (operation: string, startTime: number, metadata?: LogContext) => void;
  counter: (name: string, value?: number, tags?: Record<string, string>, metadata?: LogContext) => void;
  gauge: (name: string, value: number, tags?: Record<string, string>, metadata?: LogContext) => void;
}

let baseLogger: StructuredLogger;
let createChildLoggerImpl: (metadata: Record<string, unknown>) => StructuredLogger;

// Datadog APM integration helpers
function getDatadogTraceContext(): { traceId?: string; spanId?: string } {
  try {
    // Try to get OpenTelemetry trace context
    if (typeof require !== 'undefined') {
      try {
        const { trace } = require('@opentelemetry/api');
        const span = trace.getActiveSpan();
        if (span) {
          const spanContext = span.spanContext();
          return {
            traceId: spanContext.traceId,
            spanId: spanContext.spanId
          };
        }
      } catch (e) {
        // OpenTelemetry not available
      }

      // Try to get Datadog trace context
      try {
        const tracer = require('dd-trace');
        const span = tracer.scope().active();
        if (span) {
          return {
            traceId: span.context()._traceId?.toString(16),
            spanId: span.context()._spanId?.toString(16)
          };
        }
      } catch (e) {
        // dd-trace not available
      }
    }
  } catch (e) {
    // No tracing available
  }
  return {};
}

function submitMetricToDatadog(name: string, value: number, tags: Record<string, string> = {}) {
  try {
    if (typeof require !== 'undefined') {
      try {
        const tracer = require('dd-trace');
        const formattedTags = Object.entries(tags).map(([k, v]) => `${k}:${v}`);
        tracer.dogstatsd.gauge(name, value, formattedTags);
      } catch (e) {
        // dd-trace not available, try alternative metric submission
        if (process.env.DD_API_KEY) {
          // Could implement direct API submission here
        }
      }
    }
  } catch (e) {
    // Metrics submission failed silently
  }
}

if (!isEdgeRuntime) {
  const { default: winston } = await import('winston');

  const winstonLogger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'vibecode-webgui' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...metadata }) => {
            let msg = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(metadata).length > 0) {
              msg += ` ${JSON.stringify(metadata)}`;
            }
            return msg;
          })
        ),
      }),
    ],
  });

  if (isProduction) {
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
  }

  const createLoggerMethods = (winston: any) => {
    // Enhanced logging with trace context injection
    const logWithTrace = (level: string, message: unknown, metadata?: LogContext) => {
      const traceContext = getDatadogTraceContext();
      const enhancedMetadata = {
        ...metadata,
        ...traceContext,
        timestamp: new Date().toISOString(),
        service: 'vibecode-webgui'
      };
      winston[level](message, enhancedMetadata);
    };

    return {
      error: (message: unknown, metadata?: LogContext) => logWithTrace('error', message, metadata),
      warn: (message: unknown, metadata?: LogContext) => logWithTrace('warn', message, metadata),
      info: (message: unknown, metadata?: LogContext) => logWithTrace('info', message, metadata),
      debug: (message: unknown, metadata?: LogContext) => logWithTrace('debug', message, metadata),
      
      http: (method: string, url: string, status: number, duration?: number, metadata?: LogContext) => {
        const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
        const httpMetadata = {
          http: { method, url, status, duration },
          ...metadata
        };
        logWithTrace(logLevel, 'HTTP Request', httpMetadata);
        
        // Submit HTTP metrics to Datadog
        if (duration) {
          submitMetricToDatadog('vibecode.http.response_time', duration, {
            method,
            status_code: status.toString(),
            endpoint: url.split('?')[0]
          });
        }
        submitMetricToDatadog('vibecode.http.requests', 1, {
          method,
          status_code: status.toString(),
          endpoint: url.split('?')[0]
        });
      },
      
      security: (event: string, metadata?: LogContext) => {
        const securityMetadata = {
          security: { event },
          ...metadata
        };
        logWithTrace('warn', 'Security Event', securityMetadata);
        
        // Submit security metrics
        submitMetricToDatadog('vibecode.security.events', 1, {
          event_type: event
        });
      },
      
      performance: (operation: string, duration: number, metadata?: LogContext) => {
        const logLevel = duration > 5000 ? 'warn' : 'info';
        const perfMetadata = {
          performance: { operation, duration, unit: 'ms' },
          ...metadata
        };
        logWithTrace(logLevel, 'Performance Metric', perfMetadata);
        
        // Submit performance metrics
        submitMetricToDatadog(`vibecode.performance.${operation}`, duration, {
          operation
        });
      },
      
      api: (endpoint: string, method: string, status: number, metadata?: LogContext) => {
        const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
        const apiMetadata = {
          api: { endpoint, method, status },
          ...metadata
        };
        logWithTrace(logLevel, 'API Call', apiMetadata);
        
        // Submit API metrics
        submitMetricToDatadog('vibecode.api.calls', 1, {
          endpoint,
          method,
          status_code: status.toString()
        });
      },

      // Enhanced monitoring methods with Datadog APM integration
      trace: async (operation: string, fn: () => Promise<any>, metadata?: LogContext) => {
        const startTime = Date.now();
        let span: any = null;
        
        try {
          // Try to create a Datadog span
          try {
            const tracer = require('dd-trace');
            span = tracer.startSpan(`vibecode.${operation}`);
            if (metadata) {
              span.setTags(metadata);
            }
          } catch (e) {
            // dd-trace not available
          }
          
          const result = await fn();
          const duration = Date.now() - startTime;
          
          logWithTrace('info', `Trace completed: ${operation}`, {
            operation,
            duration,
            success: true,
            ...metadata
          });
          
          submitMetricToDatadog(`vibecode.trace.${operation}`, duration, {
            operation,
            success: 'true'
          });
          
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          logWithTrace('error', `Trace failed: ${operation}`, {
            operation,
            duration,
            success: false,
            error: {
              name: error instanceof Error ? error.name : 'Unknown',
              message: error instanceof Error ? error.message : String(error)
            },
            ...metadata
          });
          
          submitMetricToDatadog(`vibecode.trace.${operation}`, duration, {
            operation,
            success: 'false'
          });
          
          if (span) {
            span.setTag('error', true);
          }
          
          throw error;
        } finally {
          if (span) {
            span.finish();
          }
        }
      },

      metric: (name: string, value: number, tags?: Record<string, string>, metadata?: LogContext) => {
        logWithTrace('debug', `Custom metric: ${name}`, {
          metric: { name, value, tags },
          ...metadata
        });
        submitMetricToDatadog(name, value, tags || {});
      },

      span: (operation: string, fn: () => any, metadata?: LogContext) => {
        const startTime = Date.now();
        try {
          const result = fn();
          const duration = Date.now() - startTime;
          
          logWithTrace('debug', `Span completed: ${operation}`, {
            operation,
            duration,
            success: true,
            ...metadata
          });
          
          submitMetricToDatadog(`vibecode.span.${operation}`, duration, {
            operation,
            success: 'true'
          });
          
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          logWithTrace('error', `Span failed: ${operation}`, {
            operation,
            duration,
            success: false,
            error: {
              name: error instanceof Error ? error.name : 'Unknown',
              message: error instanceof Error ? error.message : String(error)
            },
            ...metadata
          });
          
          submitMetricToDatadog(`vibecode.span.${operation}`, duration, {
            operation,
            success: 'false'
          });
          
          throw error;
        }
      },

      timing: (operation: string, startTime: number, metadata?: LogContext) => {
        const duration = Date.now() - startTime;
        logWithTrace('info', `Timing: ${operation}`, {
          operation,
          duration,
          unit: 'ms',
          ...metadata
        });
        
        submitMetricToDatadog(`vibecode.timing.${operation}`, duration, {
          operation
        });
      },

      counter: (name: string, value = 1, tags?: Record<string, string>, metadata?: LogContext) => {
        logWithTrace('debug', `Counter: ${name}`, {
          counter: { name, value, tags },
          ...metadata
        });
        
        try {
          if (typeof require !== 'undefined') {
            const tracer = require('dd-trace');
            const formattedTags = Object.entries(tags || {}).map(([k, v]) => `${k}:${v}`);
            tracer.dogstatsd.increment(name, value, formattedTags);
          }
        } catch (e) {
          // Fallback to gauge
          submitMetricToDatadog(name, value, tags || {});
        }
      },

      gauge: (name: string, value: number, tags?: Record<string, string>, metadata?: LogContext) => {
        logWithTrace('debug', `Gauge: ${name}`, {
          gauge: { name, value, tags },
          ...metadata
        });
        submitMetricToDatadog(name, value, tags || {});
      }
    };
  };

  baseLogger = createLoggerMethods(winstonLogger);

  createChildLoggerImpl = (metadata: Record<string, unknown>) => {
    const childWinston = {
      error: (message: unknown, additional?: Record<string, unknown>) => {
        winstonLogger.error(message, { ...metadata, ...additional });
      },
      warn: (message: unknown, additional?: Record<string, unknown>) => {
        winstonLogger.warn(message, { ...metadata, ...additional });
      },
      info: (message: unknown, additional?: Record<string, unknown>) => {
        winstonLogger.info(message, { ...metadata, ...additional });
      },
      debug: (message: unknown, additional?: Record<string, unknown>) => {
        winstonLogger.debug(message, { ...metadata, ...additional });
      },
    };
    
    return createLoggerMethods(childWinston);
  };
} else {
  const edgeLog = (
    level: 'error' | 'warn' | 'info' | 'debug',
    message: unknown,
    metadata?: Record<string, unknown>
  ) => {
    const payload = metadata && Object.keys(metadata).length > 0 ? metadata : undefined;
    (console[level] ?? console.log).call(console, message, payload);
  };

  const createEdgeLoggerMethods = (logFn: typeof edgeLog) => ({
    error: (message: unknown, metadata?: LogContext) => logFn('error', message, metadata),
    warn: (message: unknown, metadata?: LogContext) => logFn('warn', message, metadata),
    info: (message: unknown, metadata?: LogContext) => logFn('info', message, metadata),
    debug: (message: unknown, metadata?: LogContext) => logFn('debug', message, metadata),
    
    http: (method: string, url: string, status: number, duration?: number, metadata?: LogContext) => {
      const logLevel: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      logFn(logLevel, 'HTTP Request', {
        http: { method, url, status, duration },
        ...metadata
      });
    },
    
    security: (event: string, metadata?: LogContext) => {
      logFn('warn', 'Security Event', {
        security: { event },
        ...metadata
      });
    },
    
    performance: (operation: string, duration: number, metadata?: LogContext) => {
      const logLevel: LogLevel = duration > 5000 ? 'warn' : 'info';
      logFn(logLevel, 'Performance Metric', {
        performance: { operation, duration, unit: 'ms' },
        ...metadata
      });
    },
    
    api: (endpoint: string, method: string, status: number, metadata?: LogContext) => {
      const logLevel: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      logFn(logLevel, 'API Call', {
        api: { endpoint, method, status },
        ...metadata
      });
    },

    // Enhanced monitoring methods (simplified for Edge runtime)
    trace: async (operation: string, fn: () => Promise<any>, metadata?: LogContext) => {
      const startTime = Date.now();
      try {
        const result = await fn();
        const duration = Date.now() - startTime;
        logFn('info', `Trace completed: ${operation}`, {
          operation,
          duration,
          success: true,
          ...metadata
        });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logFn('error', `Trace failed: ${operation}`, {
          operation,
          duration,
          success: false,
          error: {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error)
          },
          ...metadata
        });
        throw error;
      }
    },

    metric: (name: string, value: number, tags?: Record<string, string>, metadata?: LogContext) => {
      logFn('debug', `Custom metric: ${name}`, {
        metric: { name, value, tags },
        ...metadata
      });
    },

    span: (operation: string, fn: () => any, metadata?: LogContext) => {
      const startTime = Date.now();
      try {
        const result = fn();
        const duration = Date.now() - startTime;
        logFn('debug', `Span completed: ${operation}`, {
          operation,
          duration,
          success: true,
          ...metadata
        });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logFn('error', `Span failed: ${operation}`, {
          operation,
          duration,
          success: false,
          error: {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error)
          },
          ...metadata
        });
        throw error;
      }
    },

    timing: (operation: string, startTime: number, metadata?: LogContext) => {
      const duration = Date.now() - startTime;
      logFn('info', `Timing: ${operation}`, {
        operation,
        duration,
        unit: 'ms',
        ...metadata
      });
    },

    counter: (name: string, value = 1, tags?: Record<string, string>, metadata?: LogContext) => {
      logFn('debug', `Counter: ${name}`, {
        counter: { name, value, tags },
        ...metadata
      });
    },

    gauge: (name: string, value: number, tags?: Record<string, string>, metadata?: LogContext) => {
      logFn('debug', `Gauge: ${name}`, {
        gauge: { name, value, tags },
        ...metadata
      });
    }
  });

  baseLogger = createEdgeLoggerMethods(edgeLog);

  createChildLoggerImpl = (metadata: Record<string, unknown>) => {
    const childEdgeLog = (level: LogLevel, message: unknown, additional?: Record<string, unknown>) => {
      edgeLog(level, message, { ...metadata, ...additional });
    };
    
    return createEdgeLoggerMethods(childEdgeLog);
  };
}

export const logger: StructuredLogger = baseLogger;

export function createChildLogger(metadata: Record<string, unknown>): StructuredLogger {
  return createChildLoggerImpl(metadata);
}
