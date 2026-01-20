/**
 * Comprehensive tests for fetchWithRetry utility function
 * Tests retry logic, exponential backoff, error handling, and edge cases
 */

import { jest } from '@jest/globals';

// Mock the analytics module
jest.mock('@/lib/analytics', () => ({
  logEvent: jest.fn(),
  trackTiming: jest.fn(),
  trackError: jest.fn()
}));

// Mock fetch globally with proper typing
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch as unknown as typeof fetch;

// Import the function after mocking
import { fetchWithRetry, FetchError, isFetchError, TimeoutError } from '@/lib/utils/fetch';

const realSetTimeout = global.setTimeout;
const realClearTimeout = global.clearTimeout;

const createResponse = (status: number, body?: Record<string, unknown>): Response => {
  const response = new Response(body ? JSON.stringify(body) : null, {
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
  });

  // Manually set .ok property since Response constructor doesn't always handle it correctly
  Object.defineProperty(response, 'ok', {
    value: status >= 200 && status < 300,
    writable: false,
    configurable: true
  });

  return response;
};

describe('fetchWithRetry', () => {
  let setTimeoutSpy: jest.SpiedFunction<typeof setTimeout>;
  let clearTimeoutSpy: jest.SpiedFunction<typeof clearTimeout>;

  beforeEach(() => {
    jest.clearAllMocks();

    const timers = new Map<number, ReturnType<typeof realSetTimeout>>();
    let nextId = 1;

    setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    setTimeoutSpy.mockImplementation(((handler: TimerHandler, timeout?: number, ...args: any[]) => {
      const id = nextId++;
      const timer = realSetTimeout(() => {
        timers.delete(id);
        if (typeof handler === 'function') {
          handler(...args);
        }
      }, 0);
      timers.set(id, timer);
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    clearTimeoutSpy.mockImplementation(((id: unknown) => {
      if (typeof id === 'number') {
        const timer = timers.get(id);
        if (timer) {
          realClearTimeout(timer);
          timers.delete(id);
        }
      }
      return undefined;
    }) as typeof clearTimeout);
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  describe('Basic Functionality', () => {
    it('should make a successful request on first attempt', async () => {
      const mockResponse = createResponse(200);
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithRetry('https://api.example.com/test');

      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        signal: expect.any(Object)
      });
    });

    it('should pass through fetch options correctly', async () => {
      const mockResponse = createResponse(200);
      mockFetch.mockResolvedValueOnce(mockResponse);

      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      };

      await fetchWithRetry('https://api.example.com/test', options);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        ...options,
        signal: expect.any(Object)
      });
    });

    it('should handle URL objects correctly', async () => {
      const mockResponse = createResponse(200);
      mockFetch.mockResolvedValueOnce(mockResponse);

      const url = new URL('https://api.example.com/test');
      await fetchWithRetry(url);

      expect(mockFetch).toHaveBeenCalledWith(url, {
        signal: expect.any(Object)
      });
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 500 error and succeed on second attempt', async () => {
      const errorResponse = createResponse(500);
      const successResponse = createResponse(200);

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const result = await fetchWithRetry('https://api.example.com/test');

      expect(result).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 error and succeed on third attempt', async () => {
      const errorResponse = createResponse(503);
      const successResponse = createResponse(200);

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const result = await fetchWithRetry('https://api.example.com/test');

      expect(result).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 400 error (client error)', async () => {
      const errorResponse = createResponse(400);

      mockFetch.mockResolvedValue(errorResponse);

      await expect(fetchWithRetry('https://api.example.com/test')).rejects.toThrow('HTTP error! status: 400');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 408 error (timeout)', async () => {
      const errorResponse = createResponse(408);
      const successResponse = createResponse(200);

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const result = await fetchWithRetry('https://api.example.com/test');

      expect(result).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 error (rate limit)', async () => {
      const errorResponse = createResponse(429);
      const successResponse = createResponse(200);

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const result = await fetchWithRetry('https://api.example.com/test');

      expect(result).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Configuration', () => {
    it('should respect custom retry count', async () => {
      const errorResponse = createResponse(500);

      mockFetch.mockResolvedValue(errorResponse);

      await expect(fetchWithRetry('https://api.example.com/test', { retries: 1 })).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should respect custom retry status codes for 4xx errors', async () => {
      const errorResponse = createResponse(408);

      mockFetch.mockResolvedValue(errorResponse);

      // Custom retry status codes that don't include 408
      await expect(fetchWithRetry('https://api.example.com/test', { 
        retryStatusCodes: [429] // Only retry 429, not 408
      })).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry for 408
    });

    it('should use custom shouldRetry function', async () => {
      const errorResponse = createResponse(500);

      mockFetch.mockResolvedValue(errorResponse);

      const customShouldRetry = jest
        .fn<(error: Error, response: Response | null, attempt: number) => boolean>()
        .mockReturnValue(false);

      await expect(fetchWithRetry('https://api.example.com/test', { 
        shouldRetry: customShouldRetry 
      })).rejects.toThrow();
      
      expect(customShouldRetry).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
    });

    it('should call onRetry callback for each retry attempt', async () => {
      const errorResponse = createResponse(500);
      const successResponse = createResponse(200);

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const onRetry = jest.fn();

      await fetchWithRetry('https://api.example.com/test', { onRetry });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number));
    });
  });

  describe('Error Handling', () => {
    it('should throw error after exhausting retries', async () => {
      const errorResponse = createResponse(500);

      mockFetch.mockResolvedValue(errorResponse);

      await expect(fetchWithRetry('https://api.example.com/test', { retries: 2 })).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should enhance error with context information', async () => {
      const errorResponse = createResponse(500);

      mockFetch.mockResolvedValue(errorResponse);

      try {
        await fetchWithRetry('https://api.example.com/test', { retries: 1 });
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(isFetchError(error)).toBe(true);
        expect(error).toBeInstanceOf(FetchError);
        expect(error.url).toBe('https://api.example.com/test');
        expect(error.attempt).toBe(2);
        expect(error.status).toBe(500);
        expect(error.isRetryError).toBe(true);
      }
    });

    it('should handle network errors and retry', async () => {
      const networkError = new Error('Network error');
      const successResponse = createResponse(200);

      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(successResponse);

      const result = await fetchWithRetry('https://api.example.com/test');

      expect(result).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on AbortError', async () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';

      mockFetch.mockRejectedValue(abortError);

      await expect(fetchWithRetry('https://api.example.com/test')).rejects.toThrow('Request aborted');
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
    });
  });

  describe('Timeout Handling', () => {
    it('should set up timeout correctly', async () => {
      const mockResponse = createResponse(200);
      mockFetch.mockResolvedValueOnce(mockResponse);

      await fetchWithRetry('https://api.example.com/test', { timeout: 5000 });

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should use default timeout when not specified', async () => {
      const mockResponse = createResponse(200);
      mockFetch.mockResolvedValueOnce(mockResponse);

      await fetchWithRetry('https://api.example.com/test');

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30000); // Default 30s
    });

    it('should throw TimeoutError when the request exceeds the timeout', async () => {
      mockFetch.mockImplementation((_, options?: RequestInit) => {
        const signal = options?.signal as AbortSignal | undefined;

        return new Promise((_resolve, reject) => {
          const rejectWithAbort = () => {
            const abortError = new Error('Request aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          };

          if (signal?.aborted) {
            rejectWithAbort();
            return;
          }

          signal?.addEventListener('abort', rejectWithAbort, { once: true });
        });
      });

      await expect(fetchWithRetry('https://api.example.com/test', { timeout: 1000 }))
        .rejects.toThrow(TimeoutError);
    });
  });

  describe('Non-OK Response Handling', () => {
    it('should return response when failOnNonOk is false', async () => {
      const errorResponse = createResponse(400);
      mockFetch.mockResolvedValueOnce(errorResponse);

      const response = await fetchWithRetry('https://api.example.com/test', { failOnNonOk: false });

      expect(response).toBe(errorResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff with jitter', async () => {
      const errorResponse = createResponse(500);
      const successResponse = createResponse(200);

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const onRetry = jest.fn();

      await fetchWithRetry('https://api.example.com/test', { 
        retryDelay: 1000,
        onRetry 
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      
      // First retry should have delay around 1000ms + jitter
      const firstDelay = onRetry.mock.calls[0][2];
      expect(firstDelay).toBeGreaterThanOrEqual(1000);
      expect(firstDelay).toBeLessThanOrEqual(1500); // 1000 + max jitter (500)
      
      // Second retry should have delay around 2000ms + jitter
      const secondDelay = onRetry.mock.calls[1][2];
      expect(secondDelay).toBeGreaterThanOrEqual(2000);
      expect(secondDelay).toBeLessThanOrEqual(2500); // 2000 + max jitter (500)
    });

    it('should cap delay at 30 seconds', async () => {
      const errorResponse = createResponse(500);

      mockFetch.mockResolvedValue(errorResponse);

      const onRetry = jest.fn();

      try {
        await fetchWithRetry('https://api.example.com/test', { 
          retryDelay: 10000, // Large base delay
          retries: 5,
          onRetry 
        });
      } catch (error) {
        // Expected to fail after retries
      }

      // Check that delays are capped at 30 seconds
      onRetry.mock.calls.forEach((call) => {
        const delay = call[2];
        expect(delay).toBeLessThanOrEqual(30000);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty URL', async () => {
      const mockResponse = createResponse(200);
      mockFetch.mockResolvedValueOnce(mockResponse);

      await fetchWithRetry('');

      expect(mockFetch).toHaveBeenCalledWith('', {
        signal: expect.any(Object)
      });
    });

    it('should handle undefined options', async () => {
      const mockResponse = createResponse(200);
      mockFetch.mockResolvedValueOnce(mockResponse);

      await fetchWithRetry('https://api.example.com/test', undefined);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        signal: expect.any(Object)
      });
    });

    it('should handle zero retries', async () => {
      const errorResponse = createResponse(500);

      mockFetch.mockResolvedValue(errorResponse);

      await expect(fetchWithRetry('https://api.example.com/test', { retries: 0 })).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });
});
