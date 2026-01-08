import { logEvent, trackTiming, trackError } from '@/lib/analytics';

/**
 * Custom error class for fetch-related errors
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public status?: number,
    public url?: string,
    public attempt?: number,
    public isRetryError: boolean = false,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'FetchError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FetchError);
    }
  }
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends FetchError {
  constructor(url: string, timeout: number) {
    super(`Request timeout after ${timeout}ms`, 408, url, undefined, false);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown for network-level failures
 */
export class NetworkError extends FetchError {
  constructor(message: string, url: string, originalError?: Error) {
    super(message, undefined, url, undefined, false, originalError);
    this.name = 'NetworkError';
  }
}

/**
 * Type guard to check if an error is a FetchError
 */
export function isFetchError(error: unknown): error is FetchError {
  return error instanceof FetchError;
}

/**
 * Type guard to check if an error is a TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Type guard to check if an error is a NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

// Status codes that should trigger a retry
const RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// Maximum jitter to add to retry delays (in ms)
const MAX_JITTER = 500;

interface FetchWithRetryOptions extends RequestInit {
  /** Maximum number of retry attempts (default: 3) */
  retries?: number;
  /** Base delay between retries in ms (default: 1000ms) */
  retryDelay?: number;
  /** Request timeout in ms (default: 30000ms) */
  timeout?: number;
  /** HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504]) */
  retryStatusCodes?: number[];
  /** Custom function to determine if a request should be retried */
  shouldRetry?: (error: Error, response: Response | null, attempt: number) => boolean;
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Fetches a resource with retry logic and timeout
 * Implements exponential backoff with jitter to prevent thundering herd
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 30000,
    retryStatusCodes = RETRY_STATUS_CODES,
    shouldRetry: customShouldRetry,
    onRetry,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const url = typeof input === 'string' ? input : input.toString();

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;
  let attempt = 0;

  // Add jitter to prevent thundering herd
  const getJitter = () => Math.random() * MAX_JITTER;
  
  // Default retry condition
  const defaultShouldRetry = (error: Error, response: Response | null, attempt: number): boolean => {
    if (attempt > retries) return false;
    if (error?.name === 'AbortError') return false;
    
    // Don't retry 4xx errors except for specific status codes
    if (response?.status && response.status >= 400 && response.status < 500) {
      return retryStatusCodes.includes(response.status);
    }
    
    return true;
  };

  const shouldRetry = customShouldRetry || defaultShouldRetry;

  while (attempt <= retries) {
    try {
      attempt++;
      
      const response = await fetch(input, {
        ...fetchOptions,
        signal: controller.signal,
      });
      
      lastResponse = response;

      if (!response.ok) {
        throw new FetchError(
          `HTTP error! status: ${response.status}`,
          response.status,
          url,
          attempt
        );
      }

      clearTimeout(timeoutId);
      return response;
      
    } catch (error: unknown) {
      const err = error as Error & { status?: number };
      lastError = err;
      
      // Check if we should retry
      if (!shouldRetry(err, lastResponse, attempt)) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const baseDelay = retryDelay * Math.pow(2, attempt - 1);
      const delay = Math.min(baseDelay + getJitter(), 30000); // Cap at 30s
      
      // Notify about the retry
      onRetry?.(attempt, err, delay);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Clean up timeout to prevent memory leaks
  clearTimeout(timeoutId);

  // Throw enhanced error with full context
  if (lastError instanceof FetchError) {
    // Update existing FetchError with retry information
    lastError.isRetryError = true;
    lastError.attempt = attempt;
    if (!lastError.url) lastError.url = url;
    throw lastError;
  }

  // Create new FetchError for other error types
  throw new FetchError(
    lastError?.message || 'Unknown error occurred',
    lastResponse?.status,
    url,
    attempt,
    true,
    lastError || undefined
  );
}

// Helper for streaming responses with progress
export async function* streamResponse(
  response: Response,
  onProgress?: (progress: number) => void
): AsyncGenerator<string> {
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedLength = 0;
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedLength += value.length;
      
      if (contentLength > 0 && onProgress) {
        const progress = Math.round((receivedLength / contentLength) * 100);
        onProgress(progress);
      }

      const chunk = decoder.decode(value, { stream: true });
      yield chunk;
    }
  } finally {
    reader.releaseLock();
  }
}

// Analytics wrapper for fetch operations
export async function trackedFetch(
  eventName: string,
  input: RequestInfo | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const startTime = performance.now();
  const url = typeof input === 'string' ? input : input.toString();
  
  try {
    const response = await fetchWithRetry(input, {
      ...options,
      onRetry: (attempt, error, delay) => {
        logEvent('fetch_retry', {
          eventName,
          url,
          attempt,
          delay,
          error: error?.message || 'Unknown error',
          status: isFetchError(error) ? error.status : 0,
        });
      },
    });
    
    const duration = Math.round(performance.now() - startTime);
    
    // Log successful request
    logEvent('fetch_success', {
      eventName,
      url,
      method: options.method || 'GET',
      status: response.status,
      duration,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });
    
    // Track timing metric
    trackTiming(`fetch_${eventName}`, duration, {
      url,
      status: response.status,
      method: options.method || 'GET',
    });
    
    return response;
    
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const status = isFetchError(error) ? error.status : undefined;
    
    // Log error
    trackError(error instanceof Error ? error : new Error(errorMessage), {
      eventName: `fetch_error_${eventName}`,
      url,
      duration,
      status,
      method: options.method || 'GET',
    });
    
    // Track failed request
    logEvent('fetch_error', {
      eventName,
      url,
      method: options.method || 'GET',
      error: errorMessage,
      status,
      duration,
    });
    
    throw error;
  }
}
