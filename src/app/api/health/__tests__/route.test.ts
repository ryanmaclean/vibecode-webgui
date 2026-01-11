/**
 * @jest-environment node
 */

/**
 * Unit tests for Health Check API Route
 */

import { NextRequest } from 'next/server';
import { GET, collectHealthSnapshot } from '../route';
import { monitoring } from '@/lib/monitoring';

// Mock the monitoring module
jest.mock('@/lib/monitoring', () => ({
  monitoring: {
    recordMetric: jest.fn(),
    recordTrace: jest.fn(),
    checkDatabase: jest.fn().mockResolvedValue({
      status: 'healthy',
      details: { connected: true }
    }),
    checkValkey: jest.fn().mockResolvedValue({
      status: 'healthy',
      details: { connected: true }
    }),
    checkAIService: jest.fn().mockResolvedValue({
      status: 'healthy',
      details: { provider: 'test-mode', available: true }
    }),
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

describe('/api/health', () => {
  let mockRequest: NextRequest;
  let originalEnv: NodeJS.ProcessEnv;

  const setEnv = (key: string, value: string | undefined) => {
    const envCopy = { ...process.env } as NodeJS.ProcessEnv & Record<string, string | undefined>;
    if (value === undefined) {
      const { [key]: _removed, ...rest } = envCopy;
      process.env = rest as NodeJS.ProcessEnv;
    } else {
      envCopy[key] = value;
      process.env = envCopy;
    }
  };

  const getSnapshot = async () => {
    // Use a timestamp slightly in the past to ensure responseTime > 0
    const { snapshot } = await collectHealthSnapshot(Date.now() - 1);
    return snapshot;
  };

  beforeEach(() => {
    originalEnv = { ...process.env } as NodeJS.ProcessEnv;

    mockRequest = {
      url: 'http://localhost:3000/api/health',
      method: 'GET',
      headers: new Headers(),
      nextUrl: new URL('http://localhost:3000/api/health')
    } as NextRequest;

    process.env = {
      ...process.env,
      NODE_ENV: 'test',
      npm_package_version: '1.0.0',
    } as NodeJS.ProcessEnv;
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  describe('collectHealthSnapshot', () => {
    it('should return healthy status with basic information', async () => {
      const snapshot = await getSnapshot();

      expect(snapshot).toEqual({
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
      const snapshot = await getSnapshot();

      expect(snapshot.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include uptime as a number', async () => {
      const snapshot = await getSnapshot();

      expect(typeof snapshot.uptime).toBe('number');
      expect(snapshot.uptime).toBeGreaterThan(0);
    });

    it('should use default version when npm_package_version is not set', async () => {
      const originalVersion = process.env.npm_package_version;
      setEnv('npm_package_version', undefined);

      try {
        const snapshot = await getSnapshot();
        expect(snapshot.version).toBe('1.0.0');
      } finally {
        setEnv('npm_package_version', originalVersion);
      }
    });

    it('should use default environment when NODE_ENV is not set', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      setEnv('NODE_ENV', undefined);

      try {
        const snapshot = await getSnapshot();
        expect(snapshot.environment).toBe('development');
      } finally {
        setEnv('NODE_ENV', originalNodeEnv);
      }
    });

    it('should include performance metrics', async () => {
      const snapshot = await getSnapshot();

      expect(snapshot.performance).toEqual({
        responseTime: expect.any(Number),
        memoryUsage: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number)
        }),
        cpuUsage: expect.any(Number)
      });
    });

    it('should have response time greater than 0', async () => {
      const snapshot = await getSnapshot();

      expect(snapshot.performance.responseTime).toBeGreaterThan(0);
    });

    it('should include memory usage information', async () => {
      const snapshot = await getSnapshot();

      expect(snapshot.performance.memoryUsage.rss).toBeGreaterThan(0);
      expect(snapshot.performance.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(snapshot.performance.memoryUsage.heapUsed).toBeGreaterThan(0);
    });
  });

  describe('GET handler', () => {
    it('should respond with JSON payload when healthy', async () => {
      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('should return 503 when a health check fails', async () => {
      (monitoring.checkAIService as jest.Mock).mockResolvedValueOnce({ status: 'error' });

      const response = await GET(mockRequest);
      expect(response.status).toBe(503);
    });
  });
});

