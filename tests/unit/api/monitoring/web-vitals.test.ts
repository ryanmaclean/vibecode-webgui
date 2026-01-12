/**
 * Web Vitals Monitoring API Tests
 * Tests Core Web Vitals collection endpoint
 */

import { NextRequest } from 'next/server';

describe('Web Vitals API Route', () => {
  let GET: (request: NextRequest) => Promise<Response>;
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    // Import the route module
    const routeModule = await import('@/app/api/monitoring/web-vitals/route');
    GET = routeModule.GET;
    POST = routeModule.POST;
  });

  describe('POST /api/monitoring/web-vitals', () => {
    it('should store valid web vital metric', async () => {
      const metric = {
        name: 'LCP',
        value: 2500,
        rating: 'good' as const,
        id: 'v1-12345',
        navigationType: 'navigate'
      };

      const request = new NextRequest('http://localhost:3000/api/monitoring/web-vitals', {
        method: 'POST',
        body: JSON.stringify(metric)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject metric without name', async () => {
      const metric = {
        value: 2500,
        rating: 'good',
        id: 'v1-12345'
      };

      const request = new NextRequest('http://localhost:3000/api/monitoring/web-vitals', {
        method: 'POST',
        body: JSON.stringify(metric)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid metric data');
    });

    it('should reject metric without value', async () => {
      const metric = {
        name: 'LCP',
        rating: 'good',
        id: 'v1-12345'
      };

      const request = new NextRequest('http://localhost:3000/api/monitoring/web-vitals', {
        method: 'POST',
        body: JSON.stringify(metric)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid metric data');
    });

    it('should store multiple Core Web Vitals metrics', async () => {
      const metrics = [
        { name: 'LCP', value: 2500, rating: 'good', id: 'v1-1' },
        { name: 'FID', value: 50, rating: 'good', id: 'v1-2' },
        { name: 'CLS', value: 0.1, rating: 'good', id: 'v1-3' },
        { name: 'FCP', value: 1800, rating: 'good', id: 'v1-4' },
        { name: 'TTFB', value: 600, rating: 'good', id: 'v1-5' }
      ];

      for (const metric of metrics) {
        const request = new NextRequest('http://localhost:3000/api/monitoring/web-vitals', {
          method: 'POST',
          body: JSON.stringify(metric)
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/web-vitals', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to store metric');
    });
  });

  describe('GET /api/monitoring/web-vitals', () => {
    beforeEach(async () => {
      // Store some test metrics
      const metrics = [
        { name: 'LCP', value: 2500, rating: 'good', id: 'v1-1' },
        { name: 'LCP', value: 3000, rating: 'needs-improvement', id: 'v1-2' },
        { name: 'FID', value: 50, rating: 'good', id: 'v1-3' }
      ];

      for (const metric of metrics) {
        const request = new NextRequest('http://localhost:3000/api/monitoring/web-vitals', {
          method: 'POST',
          body: JSON.stringify(metric)
        });
        await POST(request);
      }
    });

    it('should return all metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/web-vitals');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBeGreaterThan(0);
      expect(Array.isArray(data.metrics)).toBe(true);
    });

    it('should filter metrics by name', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/web-vitals?name=LCP');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics.every((m: any) => m.name === 'LCP')).toBe(true);
    });

    it('should calculate aggregates for metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/web-vitals?name=LCP');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.aggregates).toBeDefined();
      if (data.aggregates && data.aggregates.LCP) {
        expect(data.aggregates.LCP).toHaveProperty('count');
        expect(data.aggregates.LCP).toHaveProperty('avg');
        expect(data.aggregates.LCP).toHaveProperty('p50');
        expect(data.aggregates.LCP).toHaveProperty('p95');
      }
    });

    it('should limit returned metrics to 100', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/web-vitals');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics.length).toBeLessThanOrEqual(100);
    });
  });
});
