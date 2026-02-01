/**
 * Pagination Constants and Utilities
 *
 * Centralized pagination configuration to prevent resource exhaustion attacks
 * and ensure consistent behavior across all API endpoints.
 *
 * Security considerations:
 * - All limits are enforced server-side, client values are capped
 * - Default pagination is applied when not specified
 * - Resource-specific limits based on typical response sizes
 */

/**
 * Maximum allowed page sizes by resource type
 * Higher values for lightweight resources, lower for heavy ones
 */
export const MAX_PAGE_SIZE = {
  /** Default maximum for general list endpoints */
  DEFAULT: 100,

  /** AI/LLM requests - moderate size due to token data */
  AI_REQUESTS: 100,

  /** Agents list - moderate size */
  AGENTS: 50,

  /** Chat conversations - includes metadata */
  CONVERSATIONS: 100,

  /** Chat messages - can be large with content */
  MESSAGES: 200,

  /** Vector search results - resource intensive */
  VECTOR_SEARCH: 50,

  /** Batch vector search queries */
  VECTOR_BATCH_QUERIES: 10,

  /** Workspaces - includes resource data */
  WORKSPACES: 50,

  /** Templates - includes file content, keep lower */
  TEMPLATES: 50,

  /** Files listing - can be many files */
  FILES: 500,

  /** Users list - admin endpoints */
  USERS: 100,

  /** Monitoring/metrics data points */
  METRICS: 1000,

  /** Audit logs - can be numerous */
  AUDIT_LOGS: 500,

  /** Projects per workspace */
  PROJECTS: 100,

  /** Export operations - higher limit for data export */
  EXPORT: 10000,
} as const;

/**
 * Default page sizes when not specified in request
 * Conservative defaults to minimize resource usage
 */
export const DEFAULT_PAGE_SIZE = {
  /** Default for general list endpoints */
  DEFAULT: 20,

  /** AI/LLM requests */
  AI_REQUESTS: 10,

  /** Agents list */
  AGENTS: 20,

  /** Chat conversations */
  CONVERSATIONS: 20,

  /** Chat messages */
  MESSAGES: 50,

  /** Vector search results */
  VECTOR_SEARCH: 10,

  /** Workspaces */
  WORKSPACES: 20,

  /** Templates */
  TEMPLATES: 20,

  /** Files listing */
  FILES: 100,

  /** Users list */
  USERS: 20,

  /** Monitoring/metrics data points */
  METRICS: 100,

  /** Audit logs */
  AUDIT_LOGS: 50,

  /** Projects per workspace */
  PROJECTS: 20,
} as const;

/**
 * Maximum offset to prevent deep pagination attacks
 * Deep pagination can cause performance issues with large datasets
 */
export const MAX_OFFSET = {
  /** Default maximum offset */
  DEFAULT: 10000,

  /** For frequently accessed resources */
  STANDARD: 10000,

  /** For less frequently accessed or expensive queries */
  LIMITED: 1000,

  /** For admin/export operations */
  EXTENDED: 100000,
} as const;

/**
 * Pagination parameter types
 */
export interface PaginationParams {
  limit: number;
  offset: number;
  page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total?: number;
    hasMore: boolean;
    page?: number;
    totalPages?: number;
  };
}

/**
 * Validates and normalizes pagination parameters
 *
 * @param params - Raw pagination parameters from request
 * @param maxLimit - Maximum allowed limit for this resource
 * @param defaultLimit - Default limit when not specified
 * @param maxOffset - Maximum allowed offset
 * @returns Normalized pagination parameters
 */
export function validatePaginationParams(
  params: {
    limit?: number | string | null;
    offset?: number | string | null;
    page?: number | string | null;
  },
  maxLimit: number = MAX_PAGE_SIZE.DEFAULT,
  defaultLimit: number = DEFAULT_PAGE_SIZE.DEFAULT,
  maxOffset: number = MAX_OFFSET.DEFAULT
): PaginationParams {
  // Parse and validate limit
  let limit = defaultLimit;
  if (params.limit !== undefined && params.limit !== null) {
    const parsedLimit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : params.limit;
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, maxLimit);
    }
  }

  // Parse and validate offset
  let offset = 0;
  if (params.offset !== undefined && params.offset !== null) {
    const parsedOffset = typeof params.offset === 'string' ? parseInt(params.offset, 10) : params.offset;
    if (!isNaN(parsedOffset) && parsedOffset >= 0) {
      offset = Math.min(parsedOffset, maxOffset);
    }
  }

  // Support page-based pagination (page takes precedence if both provided)
  let page: number | undefined;
  if (params.page !== undefined && params.page !== null) {
    const parsedPage = typeof params.page === 'string' ? parseInt(params.page, 10) : params.page;
    if (!isNaN(parsedPage) && parsedPage >= 1) {
      page = parsedPage;
      offset = Math.min((parsedPage - 1) * limit, maxOffset);
    }
  }

  return { limit, offset, page };
}

/**
 * Creates a paginated response wrapper
 *
 * @param data - The data array to paginate
 * @param pagination - Pagination parameters used
 * @param total - Optional total count for calculating hasMore
 * @returns Formatted paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationParams,
  total?: number
): PaginatedResponse<T> {
  const hasMore = total !== undefined
    ? pagination.offset + data.length < total
    : data.length === pagination.limit;

  const response: PaginatedResponse<T> = {
    data,
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore,
    },
  };

  if (total !== undefined) {
    response.pagination.total = total;
    response.pagination.totalPages = Math.ceil(total / pagination.limit);
  }

  if (pagination.page !== undefined) {
    response.pagination.page = pagination.page;
  }

  return response;
}

/**
 * Extracts pagination parameters from URL search params
 *
 * @param searchParams - URLSearchParams object
 * @param maxLimit - Maximum allowed limit
 * @param defaultLimit - Default limit
 * @returns Validated pagination parameters
 */
export function getPaginationFromSearchParams(
  searchParams: URLSearchParams,
  maxLimit: number = MAX_PAGE_SIZE.DEFAULT,
  defaultLimit: number = DEFAULT_PAGE_SIZE.DEFAULT
): PaginationParams {
  return validatePaginationParams(
    {
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      page: searchParams.get('page'),
    },
    maxLimit,
    defaultLimit
  );
}

/**
 * Extracts pagination parameters from request body
 *
 * @param body - Request body object
 * @param maxLimit - Maximum allowed limit
 * @param defaultLimit - Default limit
 * @returns Validated pagination parameters
 */
export function getPaginationFromBody(
  body: Record<string, unknown>,
  maxLimit: number = MAX_PAGE_SIZE.DEFAULT,
  defaultLimit: number = DEFAULT_PAGE_SIZE.DEFAULT
): PaginationParams {
  return validatePaginationParams(
    {
      limit: body.limit as number | undefined,
      offset: body.offset as number | undefined,
      page: body.page as number | undefined,
    },
    maxLimit,
    defaultLimit
  );
}

/**
 * Type guard to check if a number is within pagination bounds
 */
export function isValidLimit(limit: number, max: number = MAX_PAGE_SIZE.DEFAULT): boolean {
  return Number.isInteger(limit) && limit > 0 && limit <= max;
}

/**
 * Type guard to check if an offset is valid
 */
export function isValidOffset(offset: number, max: number = MAX_OFFSET.DEFAULT): boolean {
  return Number.isInteger(offset) && offset >= 0 && offset <= max;
}

/**
 * Clamps a limit value to valid range
 */
export function clampLimit(
  limit: number,
  max: number = MAX_PAGE_SIZE.DEFAULT,
  defaultValue: number = DEFAULT_PAGE_SIZE.DEFAULT
): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return defaultValue;
  }
  return Math.min(Math.floor(limit), max);
}

/**
 * Clamps an offset value to valid range
 */
export function clampOffset(offset: number, max: number = MAX_OFFSET.DEFAULT): number {
  if (!Number.isFinite(offset) || offset < 0) {
    return 0;
  }
  return Math.min(Math.floor(offset), max);
}
