/**
 * @jest-environment node
 */

/**
 * Unit tests for Experiments API Route
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/experiments/route';

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

// Mock auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {}
}));

// Mock feature flag engine
jest.mock('@/lib/feature-flags', () => ({
  featureFlagEngine: {
    evaluateFlag: jest.fn(),
    trackMetric: jest.fn(),
    getExperimentResults: jest.fn(),
    listFlags: jest.fn()
  }
}));

// Mock server monitoring
jest.mock('@/lib/server-monitoring', () => ({
  appLogger: {
    logBusiness: jest.fn()
  }
}));

// Mock rate limiting - use a factory function
let mockRateLimitResult = {
  success: true,
  limit: 30,
  remaining: 29,
  reset: Date.now() + 60000,
};

jest.mock('@/lib/rate-limiting', () => ({
  createAPIRateLimit: jest.fn(() => jest.fn(async () => mockRateLimitResult)),
}));

// Mock logging
jest.mock('@/lib/logging', () => ({
  createServiceLogger: jest.fn(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }))
}));

// Mock cache utilities
jest.mock('@/lib/cache/cache-utils', () => ({
  cacheGet: jest.fn(),
  cacheGetOrSet: jest.fn(),
  CacheKeyGenerators: {
    experimentsConfig: jest.fn(() => 'experiments:config')
  },
  TTLPresets: {
    EXPERIMENTS_CONFIG: 300
  }
}));

// Mock cache headers
jest.mock('@/lib/cache/http-cache-headers', () => ({
  NO_CACHE_HEADERS: {
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  },
  withCacheStatus: jest.fn((headers, status) => ({
    ...headers,
    'X-Cache-Status': status
  }))
}));

// Helper function to create a mock NextRequest
function createMockRequest(
  url: string = 'http://localhost:3000/api/experiments',
  method: string = 'GET',
  body?: any
): NextRequest {
  const options: RequestInit = {
    method,
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'user-agent': 'test-agent'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return new NextRequest(url, options);
}

describe('/api/experiments', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset rate limit mock to default success state
    mockRateLimitResult = {
      success: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60000,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/experiments', () => {
    describe('Rate Limiting', () => {
      it('should enforce rate limits', async () => {
        mockRateLimitResult = {
          success: false,
          limit: 30,
          remaining: 0,
          reset: Date.now() + 60000,
          retryAfter: 60
        };

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate',
          flagKey: 'test-flag'
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toBe('Too many requests');
        expect(response.headers.get('Retry-After')).toBe('60');
      });
    });

    describe('Authentication', () => {
      it('should require authentication', async () => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValue(null);

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate',
          flagKey: 'test-flag'
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });

      it('should accept authenticated requests', async () => {
        const { getServerSession } = require('next-auth');
        const { featureFlagEngine } = require('@/lib/feature-flags');

        getServerSession.mockResolvedValue({
          user: { id: 'user-123', email: 'test@example.com' }
        });

        featureFlagEngine.evaluateFlag.mockResolvedValue({
          enabled: true,
          variant: 'control'
        });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate',
          flagKey: 'test-flag'
        });

        const response = await POST(mockRequest);

        expect(response.status).toBe(200);
      });
    });

    describe('Action: evaluate', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValue({
          user: { id: 'user-123', email: 'test@example.com' }
        });
      });

      it('should evaluate a feature flag', async () => {
        const { featureFlagEngine } = require('@/lib/feature-flags');
        const mockResult = {
          enabled: true,
          variant: 'treatment'
        };

        featureFlagEngine.evaluateFlag.mockResolvedValue(mockResult);

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate',
          flagKey: 'test-flag'
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual(mockResult);
        expect(featureFlagEngine.evaluateFlag).toHaveBeenCalledWith(
          'test-flag',
          expect.objectContaining({
            userId: 'user-123',
            userAgent: 'test-agent',
            ipAddress: '127.0.0.1'
          }),
          undefined
        );
      });

      it('should return 400 if flagKey is missing', async () => {
        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate'
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing flagKey parameter');
      });

      it('should pass default value if provided', async () => {
        const { featureFlagEngine } = require('@/lib/feature-flags');

        featureFlagEngine.evaluateFlag.mockResolvedValue({
          enabled: false,
          variant: 'control'
        });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate',
          flagKey: 'test-flag',
          context: {
            defaultValue: false
          }
        });

        await POST(mockRequest);

        expect(featureFlagEngine.evaluateFlag).toHaveBeenCalledWith(
          'test-flag',
          expect.anything(),
          false
        );
      });

      it('should log business event for flag evaluation', async () => {
        const { featureFlagEngine } = require('@/lib/feature-flags');
        const { appLogger } = require('@/lib/server-monitoring');

        featureFlagEngine.evaluateFlag.mockResolvedValue({
          enabled: true,
          variant: 'treatment'
        });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate',
          flagKey: 'test-flag'
        });

        await POST(mockRequest);

        expect(appLogger.logBusiness).toHaveBeenCalledWith(
          'feature_flag_evaluated',
          expect.objectContaining({
            feature: 'experiments',
            userId: 'user-123'
          })
        );
      });
    });

    describe('Action: track', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValue({
          user: { id: 'user-123', email: 'test@example.com' }
        });
      });

      it('should track experiment metrics', async () => {
        const { featureFlagEngine } = require('@/lib/feature-flags');

        featureFlagEngine.trackMetric.mockResolvedValue(undefined);

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'track',
          flagKey: 'test-flag',
          metricName: 'conversion',
          value: 1
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(featureFlagEngine.trackMetric).toHaveBeenCalledWith(
          'test-flag',
          'conversion',
          1,
          expect.objectContaining({
            userId: 'user-123'
          })
        );
      });

      it('should return 400 if required parameters are missing', async () => {
        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'track',
          flagKey: 'test-flag'
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing required parameters: flagKey, metricName, value');
      });

      it('should log business event for metric tracking', async () => {
        const { featureFlagEngine } = require('@/lib/feature-flags');
        const { appLogger } = require('@/lib/server-monitoring');

        featureFlagEngine.trackMetric.mockResolvedValue(undefined);

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'track',
          flagKey: 'test-flag',
          metricName: 'conversion',
          value: 1
        });

        await POST(mockRequest);

        expect(appLogger.logBusiness).toHaveBeenCalledWith(
          'experiment_metric_tracked',
          expect.objectContaining({
            feature: 'experiments',
            userId: 'user-123',
            metadata: expect.objectContaining({
              flagKey: 'test-flag',
              metricName: 'conversion',
              value: 1
            })
          })
        );
      });
    });

    describe('Action: evaluate_multiple', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValue({
          user: { id: 'user-123', email: 'test@example.com' }
        });
      });

      it('should evaluate multiple feature flags', async () => {
        const { featureFlagEngine } = require('@/lib/feature-flags');

        featureFlagEngine.evaluateFlag
          .mockResolvedValueOnce({ enabled: true, variant: 'treatment' })
          .mockResolvedValueOnce({ enabled: false, variant: 'control' });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate_multiple',
          flags: [
            { key: 'flag-1', defaultValue: false },
            { key: 'flag-2', defaultValue: true }
          ]
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.results).toHaveLength(2);
        expect(featureFlagEngine.evaluateFlag).toHaveBeenCalledTimes(2);
      });

      it('should return 400 if flags parameter is missing', async () => {
        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate_multiple'
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing or invalid flags parameter');
      });

      it('should return 400 if flags parameter is not an array', async () => {
        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate_multiple',
          flags: 'not-an-array'
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing or invalid flags parameter');
      });

      it('should log business event for multiple flag evaluation', async () => {
        const { featureFlagEngine } = require('@/lib/feature-flags');
        const { appLogger } = require('@/lib/server-monitoring');

        featureFlagEngine.evaluateFlag.mockResolvedValue({
          enabled: true,
          variant: 'control'
        });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate_multiple',
          flags: [{ key: 'flag-1' }, { key: 'flag-2' }]
        });

        await POST(mockRequest);

        expect(appLogger.logBusiness).toHaveBeenCalledWith(
          'multiple_flags_evaluated',
          expect.objectContaining({
            feature: 'experiments',
            metadata: expect.objectContaining({
              flagCount: 2
            })
          })
        );
      });
    });

    describe('Invalid Action', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValue({
          user: { id: 'user-123', email: 'test@example.com' }
        });
      });

      it('should return 400 for invalid action', async () => {
        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'invalid_action'
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid action');
      });
    });

    describe('Error Handling', () => {
      it('should handle unexpected errors gracefully', async () => {
        const { getServerSession } = require('next-auth');

        getServerSession.mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments', 'POST', {
          action: 'evaluate',
          flagKey: 'test-flag'
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Internal server error');
      });
    });
  });

  describe('GET /api/experiments', () => {
    describe('Rate Limiting', () => {
      it('should enforce rate limits', async () => {
        mockRateLimitResult = {
          success: false,
          limit: 30,
          remaining: 0,
          reset: Date.now() + 60000,
          retryAfter: 60
        };

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=list', 'GET');

        const response = await GET(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toBe('Too many requests');
      });
    });

    describe('Authentication', () => {
      it('should require authentication', async () => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValue(null);

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=list', 'GET');

        const response = await GET(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Authorization', () => {
      it('should require admin role', async () => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValue({
          user: { id: 'user-123', email: 'test@example.com', role: 'user' }
        });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=list', 'GET');

        const response = await GET(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Forbidden: Admin access required');
      });

      it('should allow admin users', async () => {
        const { getServerSession } = require('next-auth');
        const { featureFlagEngine } = require('@/lib/feature-flags');
        const { cacheGet, cacheGetOrSet } = require('@/lib/cache/cache-utils');

        getServerSession.mockResolvedValue({
          user: { id: 'admin-123', email: 'admin@example.com', role: 'admin' }
        });

        cacheGet.mockResolvedValue(null);
        cacheGetOrSet.mockResolvedValue({ flags: [] });
        featureFlagEngine.listFlags.mockResolvedValue([]);

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=list', 'GET');

        const response = await GET(mockRequest);

        expect(response.status).toBe(200);
      });
    });

    describe('Action: results', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValue({
          user: { id: 'admin-123', email: 'admin@example.com', role: 'admin' }
        });
      });

      it('should retrieve experiment results', async () => {
        const { featureFlagEngine } = require('@/lib/feature-flags');
        const mockResults = {
          flagKey: 'test-flag',
          metrics: {
            conversion: { control: 0.1, treatment: 0.15 }
          }
        };

        featureFlagEngine.getExperimentResults.mockResolvedValue(mockResults);

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=results&flagKey=test-flag', 'GET');

        const response = await GET(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual(mockResults);
        expect(featureFlagEngine.getExperimentResults).toHaveBeenCalledWith('test-flag');
      });

      it('should return 400 if flagKey is missing', async () => {
        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=results', 'GET');

        const response = await GET(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing flagKey parameter');
      });

      it('should log business event for results retrieval', async () => {
        const { featureFlagEngine } = require('@/lib/feature-flags');
        const { appLogger } = require('@/lib/server-monitoring');

        featureFlagEngine.getExperimentResults.mockResolvedValue({});

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=results&flagKey=test-flag', 'GET');

        await GET(mockRequest);

        expect(appLogger.logBusiness).toHaveBeenCalledWith(
          'experiment_results_retrieved',
          expect.objectContaining({
            feature: 'experiments',
            metadata: expect.objectContaining({
              flagKey: 'test-flag'
            })
          })
        );
      });
    });

    describe('Action: list', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValue({
          user: { id: 'admin-123', email: 'admin@example.com', role: 'admin' }
        });
      });

      it('should list all feature flags', async () => {
        const { featureFlagEngine } = require('@/lib/feature-flags');
        const { cacheGet, cacheGetOrSet } = require('@/lib/cache/cache-utils');

        const mockFlags = [
          { key: 'flag-1', enabled: true },
          { key: 'flag-2', enabled: false }
        ];

        cacheGet.mockResolvedValue(null);
        cacheGetOrSet.mockResolvedValue({ flags: mockFlags });
        featureFlagEngine.listFlags.mockResolvedValue(mockFlags);

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=list', 'GET');

        const response = await GET(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.flags).toEqual(mockFlags);
      });

      it('should return cached results when available', async () => {
        const { cacheGet } = require('@/lib/cache/cache-utils');
        const { withCacheStatus } = require('@/lib/cache/http-cache-headers');

        const mockFlags = [{ key: 'flag-1', enabled: true }];
        cacheGet.mockResolvedValue({ flags: mockFlags });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=list', 'GET');

        const response = await GET(mockRequest);

        expect(response.status).toBe(200);
        expect(withCacheStatus).toHaveBeenCalledWith(
          expect.anything(),
          'HIT'
        );
      });

      it('should return cache miss for fresh data', async () => {
        const { cacheGet, cacheGetOrSet } = require('@/lib/cache/cache-utils');
        const { withCacheStatus } = require('@/lib/cache/http-cache-headers');

        cacheGet.mockResolvedValue(null);
        cacheGetOrSet.mockResolvedValue({ flags: [] });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=list', 'GET');

        await GET(mockRequest);

        expect(withCacheStatus).toHaveBeenCalledWith(
          expect.anything(),
          'MISS'
        );
      });

      it('should log business event for flag listing', async () => {
        const { cacheGet, cacheGetOrSet } = require('@/lib/cache/cache-utils');
        const { appLogger } = require('@/lib/server-monitoring');

        cacheGet.mockResolvedValue(null);
        cacheGetOrSet.mockResolvedValue({ flags: [] });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=list', 'GET');

        await GET(mockRequest);

        expect(appLogger.logBusiness).toHaveBeenCalledWith(
          'feature_flags_listed',
          expect.objectContaining({
            feature: 'experiments'
          })
        );
      });
    });

    describe('Invalid Action', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValue({
          user: { id: 'admin-123', email: 'admin@example.com', role: 'admin' }
        });
      });

      it('should return 400 for invalid action', async () => {
        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=invalid', 'GET');

        const response = await GET(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid action');
      });
    });

    describe('Error Handling', () => {
      it('should handle unexpected errors gracefully', async () => {
        const { getServerSession } = require('next-auth');

        getServerSession.mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        mockRequest = createMockRequest('http://localhost:3000/api/experiments?action=list', 'GET');

        const response = await GET(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Internal server error');
      });
    });
  });
});
