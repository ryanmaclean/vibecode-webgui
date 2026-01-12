/**
 * Page Load Metrics API Tests
 * Tests page load performance tracking
 */

import { NextRequest } from 'next/server';

describe('Page Load Metrics API Route', () => {
  let GET: (request: NextRequest) => Promise<Response>;
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const routeModule = await import('@/app/api/monitoring/page-load/route');
    GET = routeModule.GET;
    POST = routeModule.POST;
  });

  describe('POST /api/monitoring/page-load', () => {
    it('should store valid page load metrics', async () => {
      const metrics = {
        url: '/dashboard',
        timestamp: Date.now(),
        metrics: {
          dns: 20,
          tcp: 30,
          ttfb: 150,
          download: 200,
          domInteractive: 500,
          domComplete: 800,
          loadComplete: 1000
        }
      };

      const request = new NextRequest('http://localhost:3000/api/monitoring/page-load', {
        method: 'POST',
        body: JSON.stringify(metrics)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject metrics without URL', async () => {
      const metrics = {
        timestamp: Date.now(),
        metrics: { dns: 20 }
      };

      const request = new NextRequest('http://localhost:3000/api/monitoring/page-load', {
        method: 'POST',
        body: JSON.stringify(metrics)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid page load data');
    });

    it('should reject metrics without metrics object', async () => {
      const metrics = {
        url: '/dashboard',
        timestamp: Date.now()
      };

      const request = new NextRequest('http://localhost:3000/api/monitoring/page-load', {
        method: 'POST',
        body: JSON.stringify(metrics)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid page load data');
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/page-load', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to store metrics');
    });
  });

  describe('GET /api/monitoring/page-load', () => {
    beforeEach(async () => {
      // Store test metrics
      const metrics = {
        url: '/dashboard',
        timestamp: Date.now(),
        metrics: {
          dns: 20,
          tcp: 30,
          ttfb: 150,
          download: 200,
          domInteractive: 500,
          domComplete: 800,
          loadComplete: 1000
        }
      };

      const request = new NextRequest('http://localhost:3000/api/monitoring/page-load', {
        method: 'POST',
        body: JSON.stringify(metrics)
      });
      await POST(request);
    });

    it('should return all metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/page-load');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBeGreaterThan(0);
      expect(Array.isArray(data.metrics)).toBe(true);
    });

    it('should filter metrics by URL', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/page-load?url=/dashboard');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics.every((m: any) => m.url === '/dashboard')).toBe(true);
    });

    it('should calculate aggregates', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/page-load');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.aggregates).toBeDefined();
      if (data.aggregates && data.aggregates.dns) {
        expect(data.aggregates.dns).toHaveProperty('avg');
        expect(data.aggregates.dns).toHaveProperty('p50');
        expect(data.aggregates.dns).toHaveProperty('p95');
      }
    });

    it('should limit returned metrics to 50', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/page-load');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics.length).toBeLessThanOrEqual(50);
    });
  });
});
