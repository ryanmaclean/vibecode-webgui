/**
 * Unit tests for Health Check API Route
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/health/route';

// Mock the monitoring module
jest.mock('@/lib/monitoring', () => ({
  monitoring: {
    recordMetric: jest.fn(),
    recordTrace: jest.fn(),
    checkDatabase: jest.fn().mockResolvedValue({ status: 'healthy' }),
    checkValkey: jest.fn().mockResolvedValue({ status: 'healthy' }),
    checkAIService: jest.fn().mockResolvedValue({ status: 'healthy' }),
    trackMetrics: jest.fn().mockResolvedValue(undefined),
    submitEvent: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock fs/promises module used by checkDiskSpace
jest.mock('fs/promises', () => ({
  stat: jest.fn().mockResolvedValue({
    isDirectory: () => true,
    isFile: () => false,
    size: 1024
  })
}));

// Helper function to create a mock NextRequest
function createMockRequest(url: string = 'http://localhost:3000/api/health'): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-forwarded-for': '127.0.0.1',
    },
  });
}

describe('/api/health', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Create a mock NextRequest
    mockRequest = createMockRequest('http://localhost:3000/api/health');

    // Reset environment variables in a type-safe way
    Reflect.set(process.env, 'NODE_ENV', 'test');
    Reflect.set(process.env, 'npm_package_version', '1.0.0');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status with basic information', async () => {
      const response = await GET(mockRequest);

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: '1.0.0',
        environment: 'test',
        checks: {
          memory: expect.objectContaining({
            status: expect.any(String),
            details: expect.any(Object)
          }),
          disk: expect.objectContaining({
            status: expect.any(String),
            details: expect.any(Object)
          }),
          database: { status: 'healthy' },
          valkey: { status: 'healthy' },
          ai: { status: 'healthy' }
        },
        responseTime: expect.stringMatching(/^\d+ms$/),
        performance: expect.objectContaining({
          responseTime: expect.any(Number),
          memoryUsage: expect.objectContaining({
            rss: expect.any(Number),
            heapTotal: expect.any(Number),
            heapUsed: expect.any(Number),
            external: expect.any(Number),
            arrayBuffers: expect.any(Number)
          }),
          cpuUsage: expect.any(Number)
        })
      });
    });

    it('should include timestamp in ISO format', async () => {
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include uptime as a number', async () => {
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThan(0);
    });

    it('should use default version when npm_package_version is not set', async () => {
      // Save the original value and create a copy without npm_package_version
      const originalVersion = process.env.npm_package_version;
      const { npm_package_version, ...envWithoutVersion } = process.env;
      Object.assign(process.env, envWithoutVersion);
      delete process.env.npm_package_version;

      try {
        const response = await GET(mockRequest);
        const data = await response.json();

        expect(data.version).toBe('1.0.0');
      } finally {
        // Restore the original value
        if (originalVersion !== undefined) {
          process.env.npm_package_version = originalVersion;
        }
      }
    });

    it('should use default environment when NODE_ENV is not set', async () => {
      // Save the original value and create a copy without NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      const { NODE_ENV, ...envWithoutNodeEnv } = process.env;
      Object.assign(process.env, envWithoutNodeEnv);
      delete process.env.NODE_ENV;

      try {
        const response = await GET(mockRequest);
        const data = await response.json();

        expect(data.environment).toBe('development');
      } finally {
        // Restore the original value
        if (originalEnv !== undefined) {
          process.env.NODE_ENV = originalEnv;
        }
      }
    });

    it('should include responseTime field', async () => {
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.responseTime).toBeDefined();
      expect(data.responseTime).toMatch(/^\d+ms$/);

      const timeMs = parseInt(data.responseTime);
      expect(timeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include memory check details', async () => {
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.checks.memory).toBeDefined();
      expect(data.checks.memory.details).toBeDefined();
      expect(data.checks.memory.details.used).toMatch(/^\d+MB$/);
      expect(data.checks.memory.details.total).toMatch(/^\d+MB$/);
      expect(data.checks.memory.details.percentage).toMatch(/^\d+%$/);
    });
  });
});
