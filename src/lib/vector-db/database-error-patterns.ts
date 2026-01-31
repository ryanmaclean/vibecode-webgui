/**
 * Database-specific error patterns for improved error categorization
 * This file contains provider-specific error patterns to enhance error categorization accuracy
 */

// Import VectorDbErrorType from the new handler which has more complete error types
import { VectorDbErrorType, VectorDBErrorType } from './vector-db-error-handler-new';

/**
 * Generic error object interface for type-safe error handling
 */
interface GenericError {
  message?: string;
  code?: string | number;
  name?: string;
  status?: number;
  statusCode?: number;
  sqlState?: string;
  body?: {
    code?: string;
  };
}

/**
 * Interface for database-specific error patterns
 */
export interface DbErrorPattern {
  // Error code patterns (string or number)
  codes?: (string | number)[];
  // Error message patterns (substring match)
  messages?: string[];
  // Status code patterns
  statusCodes?: number[];
  // Name patterns
  names?: string[];
  // Error types
  types?: VectorDbErrorType[];
  // SQLSTATE codes (for SQL databases)
  sqlStates?: string[];
  // Additional condition function for complex cases
  condition?: (error: unknown) => boolean;
}

/**
 * Database-specific error patterns for categorization
 */
export const DB_ERROR_PATTERNS: Record<string, Record<string, DbErrorPattern>> = {
   /**
    * CosmosDB-specific error patterns
    */
  'azure-postgres': {
    // Connection errors
    connection: {
      codes: [40613, 10928, 10929, 10053, 10054, 10060, 18456, 
              'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
      messages: [
        'connection', 'timeout', 'connect', 'connection was closed', 
        'resource limit', 'database is unavailable', 'connection limit', 
        'login failed', 'firewall', 'network', 'connection timed out',
        'Connection was closed', 'Resource limit', 'Could not connect'
      ],
      types: [VectorDBErrorType.CONNECTION_FAILED]
    },
    
    // pgvector extension issues - specific to Azure PostgreSQL
    vectorExtension: {
      messages: [
        'extension "vector" is not available',
        'extension vector does not exist',
        'could not open extension control file "vector.control"',
        'vector is invalid for server parameter shared_preload_libraries',
        'ServerParameterToCMSUnAllowedParameterValue',
        'Value \'vector\' is invalid for server parameter',
        'operator does not exist: vector',
        'type "vector" does not exist'
      ],
      condition: (error: unknown) => {
        const err = error as GenericError | null;
        const message = (err?.message || '').toLowerCase();
        return (
          message.includes('vector') &&
          (
            message.includes('shared_preload_libraries') ||
            message.includes('extension') ||
            message.includes('serverparametertocmsunallowedparametervalue')
          )
        );
      },
      types: [VectorDBErrorType.INITIALIZATION]
    },
    
    // Authentication errors
    authentication: {
      statusCodes: [401, 403],
      messages: [
        'authentication failed', 'password authentication', 
        'role does not exist', 'no pg_hba.conf entry',
        'Azure authentication', 'AD auth'
      ],
      types: [VectorDBErrorType.AUTHORIZATION_ERROR]
    },
    
    // Resource errors
    resource: {
      statusCodes: [404, 409, 412, 413, 429, 503],
      messages: [
        'out of memory', 'disk full', 'too many connections',
        'throttling', 'service unavailable', 'resource not found'
      ],
      types: [VectorDBErrorType.SERVICE]
    }
  },

  /**
   * PostgreSQL-specific error patterns
   * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
   */

  /**
   * PostgreSQL-specific error patterns
   * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
   */
  postgres: {
    // Connection errors
    connection: {
      codes: ['08000', '08003', '08006', '08001', '08004', '08007', '08P01', 'ECONNREFUSED', 'ECONNRESET'],
      sqlStates: ['08000', '08003', '08006', '08001', '08004', '08007', '08P01'],
      messages: ['connection', 'timeout', 'connect'],
      types: [VectorDBErrorType.CONNECTION_FAILED]
    },

    // Authentication errors
    authentication: {
      codes: ['28000', '28P01', '42501', '42000', 'EAUTH'],
      sqlStates: ['28000', '28P01', '42501', '42000'],
      statusCodes: [401, 403],
      messages: ['permission denied', 'not authorized', 'authorization', 'authentication'],
      types: [VectorDBErrorType.AUTHORIZATION_ERROR]
    },

    // Query syntax errors
    querySyntax: {
      codes: ['42601', '42P01', '42P02', '42622', '42703', '42704', '42P03', '42P04', '42P05', '42P06', '42P07', '42P08'],
      sqlStates: ['42601', '42P01', '42P02', '42622', '42703', '42704', '42P03', '42P04', '42P05', '42P06', '42P07', '42P08'],
      messages: ['syntax error', 'does not exist', 'not recognized', 'invalid', 'malformed'],
      types: [VectorDBErrorType.QUERY_FAILED]
    },

    // Resource errors
    resource: {
      codes: ['53000', '53100', '53200', '53300', '54000', '54001'],
      sqlStates: ['53000', '53100', '53200', '53300', '54000', '54001'],
      messages: ['out of memory', 'disk full', 'too many connections'],
      types: [VectorDBErrorType.SERVICE]
    },

    // Transaction errors
    transaction: {
      codes: ['25000', '25001', '25002', '25003', '25004', '25P01', '25P02'],
      sqlStates: ['25000', '25001', '25002', '25003', '25004', '25P01', '25P02'],
      messages: ['transaction', 'rollback', 'commit'],
      types: [VectorDBErrorType.QUERY_FAILED]
    },

    // Timeout errors
    timeout: {
      codes: ['57014', '57P01', '57P02', '57P03', '57P04', 'ETIMEDOUT', 'ESOCKETTIMEDOUT'],
      sqlStates: ['57014', '57P01', '57P02', '57P03', '57P04'],
      messages: ['timeout', 'timed out', 'deadlock detected', 'idle in transaction', 'terminated'],
      types: [VectorDBErrorType.TIMEOUT]
    },

    // Vector extension errors
    vectorExtension: {
      messages: ['vector', 'extension not installed', 'pgvector'],
      condition: (error: unknown) => {
        const err = error as GenericError | null;
        const message = err?.message?.toLowerCase() || '';
        return (
          message.includes('vector') &&
          (message.includes('extension') || message.includes('type') || message.includes('operator'))
        );
      },
      types: [VectorDBErrorType.CONFIGURATION_ERROR]
    }
  },

  /**
   * Redis-specific error patterns
   */
  redis: {
    // Connection errors
    connection: {
      codes: ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'],
      messages: ['connection refused', 'network error', 'connect'],
      types: [VectorDBErrorType.CONNECTION_FAILED]
    },

    // Authentication errors
    authentication: {
      codes: ['NOAUTH', 'WRONGPASS'],
      statusCodes: [401, 403],
      messages: ['authentication', 'auth', 'password', 'credentials', 'NOAUTH Authentication required'],
      types: [VectorDBErrorType.AUTHORIZATION_ERROR]
    },

    // Command errors
    command: {
      codes: ['WRONGTYPE', 'NOSCRIPT', 'NOTBUSY', 'UNBLOCKED', 'LOADING', 'MASTERDOWN', 'READONLY', 'WRONGPASS'],
      messages: ['command', 'operation against a key', 'wrong kind of value', 'script', 'unknown command'],
      types: [VectorDBErrorType.QUERY_FAILED]
    },

    // Resource errors
    resource: {
      codes: ['OOM', 'BUSY'],
      messages: ['out of memory', 'background save', 'busy'],
      types: [VectorDBErrorType.SERVICE]
    },

    // Timeout errors
    timeout: {
      codes: ['ETIMEDOUT', 'TIMEDOUT'],
      messages: ['timeout', 'timed out', 'connection timeout'],
      types: [VectorDBErrorType.TIMEOUT]
    },

    // Vector search errors
    vectorSearch: {
      messages: ['vector', 'index', 'similarity', 'cannot find vector'],
      condition: (error: unknown) => {
        const err = error as GenericError | null;
        const message = err?.message?.toLowerCase() || '';
        return (
          message.includes('vector') ||
          message.includes('index') ||
          message.includes('search') ||
          message.includes('distance')
        );
      },
      types: [VectorDBErrorType.SEARCH]
    }
  },

  /**
   * Azure PostgreSQL Extended error patterns
   * Enhanced patterns for Azure PostgreSQL
   */
  'azure-postgres-extended': {
    // Connection issues
    connection: {
      codes: [40613, 10928, 10929, 10053, 10054, 10060, 18456, 
              'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
      messages: [
        'Connection was closed', 'Resource limit', 'database is unavailable',
        'connection limit', 'login failed', 'firewall', 'network', 
        'Connection timed out', 'Could not connect'
      ],
      types: [VectorDBErrorType.CONNECTION_FAILED]
    },
    
    // pgvector extension issues
    extension: {
      messages: [
        'extension "vector" is not available',
        'extension vector does not exist',
        'could not open extension control file "vector.control"',
        'vector is invalid for server parameter shared_preload_libraries',
        'ServerParameterToCMSUnAllowedParameterValue',
        'Value \'vector\' is invalid for server parameter',
        'operator does not exist: vector',
        'type "vector" does not exist'
      ],
      types: [VectorDBErrorType.INITIALIZATION]
    },
    
    // Authentication errors
    authentication: {
      statusCodes: [401, 403],
      messages: [
        'authentication failed', 'password authentication', 
        'role does not exist', 'no pg_hba.conf entry',
        'Azure authentication', 'AD auth'
      ],
      types: [VectorDBErrorType.AUTHORIZATION_ERROR]
    },
    
    // Resource errors
    resource: {
      statusCodes: [404, 409, 412, 413, 429, 503],
      messages: [
        'out of memory', 'disk full', 'too many connections',
        'throttling', 'service unavailable', 'resource not found'
      ],
      types: [VectorDBErrorType.SERVICE]
    }
  },

  /**
   * CosmosDB-specific error patterns
   */
  cosmosdb: {
    // Connection errors
    connection: {
      codes: [
        'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
        10060, 10061, 10065, 10051, 10053, 10054, 10022
      ],
      messages: ['connection', 'connect', 'timeout', 'connection refused', 'network error'],
      types: [VectorDBErrorType.CONNECTION_FAILED]
    },

    // Authentication errors
    authentication: {
      statusCodes: [401, 403],
      messages: ['authentication', 'auth', 'password', 'credentials', 'unauthorized', 'access denied'],
      types: [VectorDBErrorType.AUTHORIZATION_ERROR]
    },

    // Resource errors
    resource: {
      statusCodes: [404, 409, 412, 413, 429, 503],
      messages: ['not found', 'conflict', 'precondition', 'too large', 'throttling', 'service unavailable'],
      types: [VectorDBErrorType.SERVICE]
    },

    // Query errors
    query: {
      statusCodes: [400],
      messages: ['query', 'syntax', 'invalid', 'bad request', 'malformed'],
      condition: (error: unknown) => {
        const err = error as GenericError | null;
        const message = err?.message?.toLowerCase() || '';
        const bodyCode = err?.body?.code?.toLowerCase() || '';
        return (
          message.includes('query') ||
          bodyCode.includes('badrequest') ||
          bodyCode.includes('invalidsyntax')
        );
      },
      types: [VectorDBErrorType.QUERY_FAILED]
    },

    // Timeout errors
    timeout: {
      codes: ['ETIMEDOUT', 'RequestTimeout'],
      statusCodes: [408, 504],
      messages: ['timeout', 'timed out', 'gateway timeout', 'request timeout'],
      types: [VectorDBErrorType.TIMEOUT]
    },

    // Rate limiting errors
    rateLimiting: {
      statusCodes: [429],
      messages: ['too many requests', 'rate limit', 'throttled', 'throughput'],
      condition: (error: unknown) => {
        const err = error as GenericError | null;
        const message = err?.message?.toLowerCase() || '';
        const bodyCode = err?.body?.code?.toLowerCase() || '';
        return (
          message.includes('rate') ||
          message.includes('throughput') ||
          bodyCode.includes('throttling') ||
          bodyCode.includes('requestratetoolarge')
        );
      },
      types: [VectorDBErrorType.SERVICE]
    }
  },

  /**
   * SQL Server-specific error patterns
   */
  sqlserver: {
    // Connection errors
    connection: {
      codes: [
        -2, 1, 2, 4060, 4064, 18456, 233, 53, 67, 10060, 10061, 40613,
        'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'
      ],
      messages: [
        'connection', 'connect', 'timeout', 'connection refused', 'network error',
        'A connection was successfully established with the server',
        'Connection failed', 'server is not found or not accessible',
        'Could not open a connection'
      ],
      types: [VectorDBErrorType.CONNECTION_FAILED]
    },

    // Authentication errors
    authentication: {
      codes: [18456, 18470, 18488, 4060, 4064],
      statusCodes: [401, 403],
      messages: [
        'Login failed', 'authentication', 'auth', 'password',
        'credentials', 'permission', 'access denied', 'insufficient'
      ],
      types: [VectorDBErrorType.AUTHORIZATION_ERROR]
    },

    // Query syntax errors
    querySyntax: {
      codes: [102, 103, 104, 105, 207, 208, 209, 2812],
      messages: [
        'syntax error', 'incorrect syntax', 'invalid', 'object name',
        'invalid column name', 'invalid object name', 'procedure'
      ],
      types: [VectorDBErrorType.QUERY_FAILED]
    },

    // Resource errors
    resource: {
      codes: [1204, 1205, 1222, 3960, 3961, 40197, 40501, 40613, 49918, 49919, 49920],
      messages: [
        'out of memory', 'disk full', 'deadlock', 'lock', 'resource',
        'throttled', 'elastic pool'
      ],
      types: [VectorDBErrorType.SERVICE]
    },

    // Timeout errors
    timeout: {
      codes: [-2, 'ETIMEDOUT', -1, 'ESOCKETTIMEDOUT', 10060, 258, 11001],
      messages: [
        'timeout', 'timed out', 'connection timeout', 'wait timeout',
        'timeout expired', 'operation canceled'
      ],
      types: [VectorDBErrorType.TIMEOUT]
    }
  },

  /**
   * Cognitive Search-specific error patterns
   */
  'cognitive-search': {
    // Connection errors
    connection: {
      codes: ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
      messages: [
        'connection', 'connect', 'timeout', 'connection refused',
        'network error', 'unable to connect'
      ],
      types: [VectorDBErrorType.CONNECTION_FAILED]
    },

    // Authentication errors
    authentication: {
      statusCodes: [401, 403],
      messages: [
        'authentication', 'auth', 'api key', 'credentials',
        'unauthorized', 'access denied', 'forbidden'
      ],
      types: [VectorDBErrorType.AUTHORIZATION_ERROR]
    },

    // Resource errors
    resource: {
      statusCodes: [404, 409, 412, 413, 429, 503],
      messages: [
        'not found', 'conflict', 'precondition', 'too large',
        'throttling', 'service unavailable', 'index not found',
        'document not found'
      ],
      types: [VectorDBErrorType.SERVICE]
    },

    // Query errors
    query: {
      statusCodes: [400],
      messages: [
        'query', 'syntax', 'invalid', 'bad request', 'malformed',
        'search request', 'vector configuration'
      ],
      types: [VectorDBErrorType.QUERY_FAILED]
    },

    // Vector specific errors
    vector: {
      messages: [
        'vector', 'embedding', 'dimension', 'vectorization',
        'semantic configuration', 'similarity'
      ],
      condition: (error: unknown) => {
        const err = error as GenericError | null;
        const message = err?.message?.toLowerCase() || '';
        return (
          message.includes('vector') ||
          message.includes('embedding') ||
          message.includes('dimension') ||
          message.includes('semantic')
        );
      },
      types: [VectorDBErrorType.VECTOR_CREATION_FAILED]
    },

    // Timeout errors
    timeout: {
      codes: ['ETIMEDOUT', 'RequestTimeout'],
      statusCodes: [408, 504],
      messages: ['timeout', 'timed out', 'gateway timeout', 'request timeout'],
      types: [VectorDBErrorType.TIMEOUT]
    },

    // Rate limiting errors
    rateLimiting: {
      statusCodes: [429],
      messages: ['too many requests', 'rate limit', 'throttled', 'throughput'],
      types: [VectorDBErrorType.SERVICE]
    }
  }
};

/**
 * Enhanced error categorization function that uses database-specific patterns
 * @param error Any error object to analyze
 * @param provider The database provider name (postgres, redis, etc.)
 * @returns The appropriate VectorDBErrorType
 */
export function categorizeErrorWithProvider(error: unknown, provider: string): VectorDbErrorType {
  if (!error) {
    return VectorDBErrorType.UNKNOWN_ERROR;
  }

  const err = error as GenericError;
  const rawMessage = err?.message;
  const message = String(rawMessage ?? '').toLowerCase();
  const code = String(err?.code ?? '');
  const name = String(err?.name ?? '').toLowerCase();
  const status = err?.status ?? err?.statusCode ?? 0;
  const numericCode = Number.isFinite(err?.code) ? Number(err?.code) : (
    Number.isFinite(err?.statusCode) ? Number(err?.statusCode) : NaN
  );
  const sqlState = err?.sqlState ?? '';
  const bodyCode = String(err?.body?.code ?? '').toLowerCase();

  // Simple provider heuristics before pattern matching
  if (provider === 'cosmosdb') {
    if (
      status === 408 || numericCode === 408 ||
      bodyCode.includes('requesttimeout')
    ) {
      return VectorDBErrorType.TIMEOUT;
    }
  }

  // Get provider-specific patterns
  const providerPatterns = DB_ERROR_PATTERNS[provider] || {};

  // Check each pattern category for the provider
  for (const [_category, pattern] of Object.entries(providerPatterns)) {
    // Check status codes
    if (pattern.statusCodes && (pattern.statusCodes.includes(status) || (Number.isFinite(numericCode) && pattern.statusCodes.includes(numericCode)))) {
      return pattern.types?.[0] || VectorDBErrorType.UNKNOWN_ERROR;
    }

    // Check error codes
    if (pattern.codes && pattern.codes.some(c => code.includes(c.toString()))) {
      return pattern.types?.[0] || VectorDBErrorType.UNKNOWN_ERROR;
    }

    // Check SQL states for SQL databases
    if (pattern.sqlStates && sqlState && pattern.sqlStates.some(s => sqlState.startsWith(s))) {
      return pattern.types?.[0] || VectorDBErrorType.UNKNOWN_ERROR;
    }

    // Check error messages
    if (pattern.messages && message && pattern.messages.some(m => message.includes(m.toLowerCase()))) {
      return pattern.types?.[0] || VectorDBErrorType.UNKNOWN_ERROR;
    }

    // Check error names
    if (pattern.names && pattern.names.some(n => name.includes(n.toLowerCase()))) {
      return pattern.types?.[0] || VectorDBErrorType.UNKNOWN_ERROR;
    }

    // Check custom condition if available
    if (pattern.condition && pattern.condition(error)) {
      return pattern.types?.[0] || VectorDBErrorType.UNKNOWN_ERROR;
    }
  }

  // If no specific pattern matches, fall back to generic categorization
  if (message.includes('not implemented') || message.includes('unsupported')) {
    return VectorDBErrorType.UNSUPPORTED_OPERATION;
  }

  // Minimal global fallback for common SQL query error patterns
  if (message.includes('does not exist') || code.startsWith('42')) {
    return VectorDBErrorType.QUERY_FAILED;
  }

  return VectorDBErrorType.UNKNOWN_ERROR;
}

/**
 * Determine if an error is likely to be retryable based on provider-specific patterns
 * @param error Any error object to analyze
 * @param provider The database provider name
 * @returns Boolean indicating if the error is retryable
 */
export function isRetryableWithProvider(error: unknown, provider: string): boolean {
  if (!error) {
    return false;
  }

  const errorType = categorizeErrorWithProvider(error, provider);

  // These error types are generally retryable across providers
  if (
    errorType === VectorDBErrorType.CONNECTION_FAILED ||
    errorType === VectorDBErrorType.TIMEOUT ||
    errorType === VectorDBErrorType.SERVICE
  ) {
    return true;
  }

  const err = error as GenericError;

  // Provider-specific retry logic
  if (provider === 'postgres' || provider === 'sqlserver') {
    // Check for deadlock errors which are retryable
    const message = (err?.message || '').toLowerCase();
    const code = (err?.code || '').toString();

    if (
      message.includes('deadlock') ||
      code === '1205' || // SQL Server deadlock
      code === '40001' || // SQL Server serialization failure
      code === '40P01' // PostgreSQL deadlock
    ) {
      return true;
    }
  }

  if (provider === 'cosmosdb' || provider === 'cognitive-search') {
    // Rate limiting errors are retryable
    const status = err?.status || err?.statusCode || 0;
    if (status === 429) {
      return true;
    }
  }

  return false;
}