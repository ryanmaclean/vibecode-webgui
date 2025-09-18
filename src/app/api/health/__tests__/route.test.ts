/**
 * Unit tests for Health Check API Route
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';

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

describe('/api/health', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Create a mock NextRequest
    mockRequest = {
      url: 'http://localhost:3000/api/health',
      method: 'GET',
      headers: new Headers(),
      nextUrl: new URL('http://localhost:3000/api/health')
    } as NextRequest;

    // Reset environment variables in a type-safe way
    Reflect.set(process.env, 'NODE_ENV', 'test');
    Reflect.set(process.env, 'npm_package_version', '1.0.0');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status with basic information', async () => {
      try {
        const response = await GET();
        console.log('Response status:', response.status);
        
        let data;
        let responseText;
        try {
          responseText = await response.text();
          console.log('Response text:', responseText);
          data = JSON.parse(responseText);
          console.log('Response data:', data);
        } catch (parseError) {
          console.log('Parse error:', parseError);
          console.log('Raw response text:', responseText);
        }

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
        responseTime: expect.stringMatching(/^\d+ms$/)
      });
      } catch (error) {
        console.log('Test error:', error);
        throw error;
      }
    });

    it('should include timestamp in ISO format', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include uptime as a number', async () => {
      const response = await GET();
      const data = await response.json();

      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThan(0);
    });

    it('should use default version when npm_package_version is not set', async () => {
      Reflect.deleteProperty(process.env, 'npm_package_version');
      
      const response = await GET();
      const data = await response.json();

      expect(data.version).toBe('1.0.0');
    });

    it('should use default environment when NODE_ENV is not set', async () => {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
      
      const response = await GET();
      const data = await response.json();

      expect(data.environment).toBe('development');
    });

    it('should include performance metrics', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.performance).toEqual({
        responseTime: expect.any(Number),
        memoryUsage: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number)
        }),
        cpuUsage: expect.any(Number)
      });
    });

    it('should have response time greater than 0', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.performance.responseTime).toBeGreaterThan(0);
    });

    it('should include memory usage information', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.performance.memoryUsage.rss).toBeGreaterThan(0);
      expect(data.performance.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(data.performance.memoryUsage.heapUsed).toBeGreaterThan(0);
    });
  });
});
