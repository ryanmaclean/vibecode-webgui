/**
 * Performance Monitoring API Route Tests
 * Tests performance metrics and monitoring endpoint
 */

import { NextRequest } from 'next/server';

describe('Performance Monitoring API Route', () => {
  let GET: (request: NextRequest) => Promise<Response>;
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    // Import the route module
    const routeModule = await import('@/app/api/monitoring/performance/route');
    GET = routeModule.GET;
    POST = routeModule.POST;
  });

  describe('GET /api/monitoring/performance', () => {
    describe('report action', () => {
      it('should return performance report with default timeframe', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance?action=report');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe('success');
        expect(data.timeframe).toBe('1h');
        expect(data.metrics).toBeDefined();
        expect(data.metrics).toHaveProperty('responseTime');
        expect(data.metrics).toHaveProperty('throughput');
        expect(data.metrics).toHaveProperty('errorRate');
        expect(data.metrics).toHaveProperty('cpuUsage');
        expect(data.metrics).toHaveProperty('memoryUsage');
        expect(data.recommendations).toBeInstanceOf(Array);
        expect(data.timestamp).toBeDefined();
      });

      it('should accept custom timeframe parameter', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance?action=report&timeframe=24h');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.timeframe).toBe('24h');
      });

      it('should default to report action when no action specified', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.metrics).toBeDefined();
      });

      it('should include recommendations in report', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance?action=report');

        const response = await GET(request);
        const data = await response.json();

        expect(data.recommendations).toBeInstanceOf(Array);
        expect(data.recommendations.length).toBeGreaterThan(0);
      });
    });

    describe('health action', () => {
      it('should return health status', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance?action=health');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('healthy');
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('issues');
        expect(data).toHaveProperty('recommendations');
        expect(typeof data.healthy).toBe('boolean');
        expect(['healthy', 'degraded']).toContain(data.status);
        expect(Array.isArray(data.issues)).toBe(true);
        expect(Array.isArray(data.recommendations)).toBe(true);
        expect(data.timestamp).toBeDefined();
      });

      it('should limit recommendations to top 3', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance?action=health');

        const response = await GET(request);
        const data = await response.json();

        expect(data.recommendations.length).toBeLessThanOrEqual(3);
      });
    });

    describe('error handling', () => {
      it('should return 400 for invalid action', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance?action=invalid');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid action');
        expect(data.available_actions).toContain('report');
        expect(data.available_actions).toContain('health');
      });
    });
  });

  describe('POST /api/monitoring/performance', () => {
    describe('load_test_results type', () => {
      it('should process load test results', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance', {
          method: 'POST',
          body: JSON.stringify({
            type: 'load_test_results',
            data: {
              test_name: 'API Load Test',
              duration: 60,
              requests_per_second: 100,
              avg_response_time: 150
            }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('test_passed');
        expect(typeof data.test_passed).toBe('boolean');
        expect(data.message).toContain('Load test results processed');
        expect(data.timestamp).toBeDefined();
      });
    });

    describe('synthetic_test_results type', () => {
      it('should process Datadog synthetic test results', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance', {
          method: 'POST',
          body: JSON.stringify({
            type: 'synthetic_test_results',
            data: {
              test_id: 'synthetic-123',
              status: 'passed',
              duration: 5000
            }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('test_passed');
        expect(data.message).toContain('Datadog Synthetic test results processed');
      });
    });

    describe('lighthouse_results type', () => {
      it('should process Lighthouse audit results', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance', {
          method: 'POST',
          body: JSON.stringify({
            type: 'lighthouse_results',
            data: {
              performance_score: 95,
              accessibility_score: 100,
              best_practices_score: 92,
              seo_score: 100
            }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('audit_passed');
        expect(data.message).toContain('Lighthouse audit processed');
      });
    });

    describe('web_vitals type', () => {
      it('should record Web Vitals metrics', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance', {
          method: 'POST',
          body: JSON.stringify({
            type: 'web_vitals',
            data: {
              FCP: 1200,
              LCP: 2500,
              FID: 50,
              CLS: 0.1,
              TTFB: 600
            }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Web Vitals metric recorded');
        expect(data.timestamp).toBeDefined();
      });
    });

    describe('api_performance type', () => {
      it('should record API performance metrics', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance', {
          method: 'POST',
          body: JSON.stringify({
            type: 'api_performance',
            data: {
              endpoint: '/api/users',
              method: 'GET',
              responseTime: 125,
              status: 200
            }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('API performance metric recorded');
      });
    });

    describe('resource_performance type', () => {
      it('should record resource loading performance', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance', {
          method: 'POST',
          body: JSON.stringify({
            type: 'resource_performance',
            data: {
              resource: 'main.js',
              load_time: 250,
              size: 512000
            }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Resource performance metric recorded');
      });
    });

    describe('error handling', () => {
      it('should return 400 for invalid type', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance', {
          method: 'POST',
          body: JSON.stringify({
            type: 'invalid_type',
            data: {}
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid performance data type');
        expect(data.available_types).toContain('load_test_results');
        expect(data.available_types).toContain('lighthouse_results');
        expect(data.available_types).toContain('web_vitals');
      });

      it('should handle malformed JSON', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance', {
          method: 'POST',
          body: 'invalid json'
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to process performance data');
        expect(data.message).toBeDefined();
      });

      it('should handle missing body fields', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/performance', {
          method: 'POST',
          body: JSON.stringify({})
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid performance data type');
      });
    });
  });

  describe('edge cases and integration', () => {
    it('should handle multiple concurrent GET requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        GET(new NextRequest('http://localhost:3000/api/monitoring/performance?action=health'))
      );

      const responses = await Promise.all(requests);

      responses.forEach(async (response) => {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('healthy');
      });
    });

    it('should handle various timeframe formats', async () => {
      const timeframes = ['15m', '1h', '6h', '24h', '7d'];

      for (const timeframe of timeframes) {
        const request = new NextRequest(`http://localhost:3000/api/monitoring/performance?action=report&timeframe=${timeframe}`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.timeframe).toBe(timeframe);
      }
    });

    it('should generate consistent timestamp format', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/performance?action=health');

      const response = await GET(request);
      const data = await response.json();

      // Verify ISO 8601 format
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verify it's a valid date
      const date = new Date(data.timestamp);
      expect(date.getTime()).toBeGreaterThan(0);
    });
  });
});
