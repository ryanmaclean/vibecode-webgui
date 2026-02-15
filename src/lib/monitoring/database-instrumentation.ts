/**
 * Database Query Instrumentation with OpenTelemetry
 * Provides PostgreSQL query tracing with span correlation
 */

// Check if we're in a Docker build environment
const isDockerBuild = (
  process.env.DOCKER_BUILD === 'true' ||
  process.env.SKIP_MONITORING === 'true' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.OTEL_ENABLED === 'false' ||
  process.env.DD_ENABLED === 'false'
);

// Conditional imports to prevent build-time errors in Docker
let PgInstrumentation: any = null;
let trace: any = null;
let context: any = null;

if (!isDockerBuild) {
  try {
    const pgInstrumentationModule = require('@opentelemetry/instrumentation-pg');
    const apiModule = require('@opentelemetry/api');

    PgInstrumentation = pgInstrumentationModule.PgInstrumentation;
    trace = apiModule.trace;
    context = apiModule.context;
  } catch (error) {
    // Debug log removed
  }
}

const isServer = typeof window === 'undefined';

/**
 * Create PostgreSQL instrumentation instance
 */
export function createPgInstrumentation() {
  if (!isServer || isDockerBuild || !PgInstrumentation) {
    return null;
  }

  try {
    return new PgInstrumentation({
      // Enable query parameter capture (sanitized)
      enhancedDatabaseReporting: true,

      // Hook to add custom attributes to database spans
      requestHook: (span: any, queryConfig: any) => {
        try {
          // Add custom attributes for better observability
          if (queryConfig) {
            // Add query type (SELECT, INSERT, UPDATE, DELETE, etc.)
            const queryType = extractQueryType(queryConfig.text || queryConfig);
            if (queryType) {
              span.setAttribute('db.query.type', queryType);
            }

            // Add query complexity hints
            const complexity = estimateQueryComplexity(queryConfig.text || queryConfig);
            span.setAttribute('db.query.complexity', complexity);

            // Add table name if detectable
            const tableName = extractTableName(queryConfig.text || queryConfig);
            if (tableName) {
              span.setAttribute('db.query.table', tableName);
            }

            // Add parameter count
            if (queryConfig.values && Array.isArray(queryConfig.values)) {
              span.setAttribute('db.query.param_count', queryConfig.values.length);
            }

            // Add custom vibecode attributes for correlation
            span.setAttribute('vibecode.service', 'webgui');
            span.setAttribute('vibecode.db.operation', 'query');
          }
        } catch (error) {
          // Silently handle errors in hook to prevent instrumentation failures
        }
      },

      // Hook to add custom attributes after query execution
      responseHook: (span: any, response: any) => {
        try {
          // Add row count if available
          if (response && typeof response.rowCount === 'number') {
            span.setAttribute('db.query.row_count', response.rowCount);
          }

          // Mark span as successful
          span.setAttribute('vibecode.db.success', true);
        } catch (error) {
          // Silently handle errors in hook
        }
      }
    });
  } catch (error) {
    console.error('❌ Failed to create PgInstrumentation:', error);
    return null;
  }
}

/**
 * Extract query type from SQL text
 */
function extractQueryType(queryText: string): string | null {
  if (!queryText || typeof queryText !== 'string') {
    return null;
  }

  const normalizedQuery = queryText.trim().toUpperCase();
  const queryTypes = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'BEGIN', 'COMMIT', 'ROLLBACK'];

  for (const type of queryTypes) {
    if (normalizedQuery.startsWith(type)) {
      return type;
    }
  }

  return 'OTHER';
}

/**
 * Extract primary table name from SQL query
 */
function extractTableName(queryText: string): string | null {
  if (!queryText || typeof queryText !== 'string') {
    return null;
  }

  // Simple table name extraction (handles common cases)
  const fromMatch = queryText.match(/FROM\s+["']?(\w+)["']?/i);
  if (fromMatch) {
    return fromMatch[1];
  }

  const intoMatch = queryText.match(/INTO\s+["']?(\w+)["']?/i);
  if (intoMatch) {
    return intoMatch[1];
  }

  const updateMatch = queryText.match(/UPDATE\s+["']?(\w+)["']?/i);
  if (updateMatch) {
    return updateMatch[1];
  }

  return null;
}

/**
 * Estimate query complexity based on keywords
 */
function estimateQueryComplexity(queryText: string): string {
  if (!queryText || typeof queryText !== 'string') {
    return 'unknown';
  }

  const normalizedQuery = queryText.toUpperCase();

  // Check for complex operations
  if (normalizedQuery.includes('JOIN') && normalizedQuery.includes('SUBQUERY')) {
    return 'very_high';
  }

  if (normalizedQuery.includes('JOIN') || normalizedQuery.includes('UNION')) {
    return 'high';
  }

  if (normalizedQuery.includes('GROUP BY') || normalizedQuery.includes('ORDER BY') || normalizedQuery.includes('HAVING')) {
    return 'medium';
  }

  return 'low';
}

/**
 * Get current trace context for correlation
 */
export function getDatabaseTraceContext(): {
  trace_id?: string;
  span_id?: string;
} {
  if (!isServer || isDockerBuild || !trace || !context) {
    return {};
  }

  try {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) {
      return {};
    }

    const spanContext = activeSpan.spanContext();
    return {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId
    };
  } catch (error) {
    return {};
  }
}

/**
 * Wrap a database operation with tracing
 */
export async function traceDatabaseOperation<T>(
  operationName: string,
  attributes: Record<string, any>,
  fn: () => Promise<T>
): Promise<T> {
  if (!isServer || isDockerBuild || !trace) {
    // Execute without tracing in Docker build or client-side
    return fn();
  }

  const tracer = trace.getTracer('vibecode-webgui-db');

  return tracer.startActiveSpan(
    `db.${operationName}`,
    {
      attributes: {
        'db.system': 'postgresql',
        'vibecode.service': 'webgui',
        ...attributes
      }
    },
    async (span: any) => {
      try {
        const result = await fn();
        span.setStatus({ code: 1 }); // OK status
        return result;
      } catch (error) {
        span.setStatus({
          code: 2, // ERROR status
          message: (error as Error).message
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Get database instrumentation configuration
 */
export function getDatabaseInstrumentationConfig() {
  return {
    enabled: !isDockerBuild && !!PgInstrumentation,
    enhanced_reporting: true,
    query_sanitization: true,
    span_correlation: true
  };
}
