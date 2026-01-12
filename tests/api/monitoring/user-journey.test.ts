/**
 * Tests for /api/monitoring/user-journey route
 * Coverage for user journey tracking endpoint
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/monitoring/user-journey/route';

function createRequest(url: string, options: RequestInit = {}): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('/api/monitoring/user-journey', () => {
  describe('POST handler', () => {
    it('should accept valid journey event', async () => {
      const event = {
        journey: 'signup_flow',
        timestamp: Date.now(),
        url: '/signup',
        metadata: { step: 1 }
      };

      const request = createRequest('/api/monitoring/user-journey', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should accept event without metadata', async () => {
      const event = {
        journey: 'page_view',
        timestamp: Date.now(),
        url: '/dashboard'
      };

      const request = createRequest('/api/monitoring/user-journey', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should reject event without journey', async () => {
      const event = {
        timestamp: Date.now(),
        url: '/test'
      };

      const request = createRequest('/api/monitoring/user-journey', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid journey event');
    });

    it('should reject event without timestamp', async () => {
      const event = {
        journey: 'test',
        url: '/test'
      };

      const request = createRequest('/api/monitoring/user-journey', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid journey event');
    });

    it('should handle invalid JSON', async () => {
      const request = createRequest('/api/monitoring/user-journey', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to store event');
    });

    it('should store multiple events', async () => {
      const events = [
        { journey: 'test1', timestamp: Date.now(), url: '/test1' },
        { journey: 'test2', timestamp: Date.now(), url: '/test2' },
        { journey: 'test3', timestamp: Date.now(), url: '/test3' }
      ];

      for (const event of events) {
        const request = createRequest('/api/monitoring/user-journey', {
          method: 'POST',
          body: JSON.stringify(event),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();
        expect(data.success).toBe(true);
      }
    });
  });

  describe('GET handler', () => {
    beforeEach(async () => {
      // Add some test events
      const events = [
        { journey: 'onboarding', timestamp: Date.now() - 10000, url: '/step1' },
        { journey: 'onboarding', timestamp: Date.now() - 5000, url: '/step2' },
        { journey: 'purchase', timestamp: Date.now(), url: '/checkout' }
      ];

      for (const event of events) {
        const request = createRequest('/api/monitoring/user-journey', {
          method: 'POST',
          body: JSON.stringify(event),
          headers: { 'Content-Type': 'application/json' }
        });
        await POST(request);
      }
    });

    it('should retrieve all events', async () => {
      const request = createRequest('/api/monitoring/user-journey');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('events');
      expect(data).toHaveProperty('statistics');
      expect(data.count).toBeGreaterThan(0);
    });

    it('should filter events by journey', async () => {
      const request = createRequest('/api/monitoring/user-journey?journey=onboarding');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events.every((e: any) => e.journey === 'onboarding')).toBe(true);
    });

    it('should filter events by time', async () => {
      const since = Date.now() - 6000;
      const request = createRequest(`/api/monitoring/user-journey?since=${since}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events.every((e: any) => e.timestamp >= since)).toBe(true);
    });

    it('should calculate journey statistics', async () => {
      const request = createRequest('/api/monitoring/user-journey');
      const response = await GET(request);
      const data = await response.json();

      expect(data.statistics).toBeDefined();
      expect(data.statistics).toHaveProperty('totalEvents');
      expect(data.statistics).toHaveProperty('uniqueJourneys');
      expect(data.statistics).toHaveProperty('uniqueUrls');
      expect(data.statistics).toHaveProperty('topJourneys');
      expect(data.statistics).toHaveProperty('topUrls');
    });

    it('should return statistics for empty result set', async () => {
      const request = createRequest('/api/monitoring/user-journey?journey=nonexistent');
      const response = await GET(request);
      const data = await response.json();

      expect(data.count).toBe(0);
      expect(data.statistics).toBeNull();
    });

    it('should limit events to last 100', async () => {
      const request = createRequest('/api/monitoring/user-journey');
      const response = await GET(request);
      const data = await response.json();

      expect(data.events.length).toBeLessThanOrEqual(100);
    });

    it('should handle errors gracefully', async () => {
      // Test with invalid query params
      const request = createRequest('/api/monitoring/user-journey?since=invalid');
      const response = await GET(request);

      // Should still return valid response (NaN filtering will exclude events)
      expect(response.status).toBe(200);
    });
  });

  describe('Statistics calculation', () => {
    it('should calculate top journeys', async () => {
      // Add multiple events for different journeys
      const journeys = ['flow1', 'flow1', 'flow1', 'flow2', 'flow2', 'flow3'];

      for (const journey of journeys) {
        const event = { journey, timestamp: Date.now(), url: '/test' };
        const request = createRequest('/api/monitoring/user-journey', {
          method: 'POST',
          body: JSON.stringify(event),
          headers: { 'Content-Type': 'application/json' }
        });
        await POST(request);
      }

      const request = createRequest('/api/monitoring/user-journey');
      const response = await GET(request);
      const data = await response.json();

      expect(data.statistics.topJourneys).toBeDefined();
      expect(Array.isArray(data.statistics.topJourneys)).toBe(true);
      expect(data.statistics.topJourneys.length).toBeGreaterThan(0);
      // Verify structure of top journey
      expect(data.statistics.topJourneys[0]).toHaveProperty('name');
      expect(data.statistics.topJourneys[0]).toHaveProperty('count');
    });

    it('should calculate top URLs', async () => {
      const request = createRequest('/api/monitoring/user-journey');
      const response = await GET(request);
      const data = await response.json();

      if (data.statistics) {
        expect(data.statistics.topUrls).toBeDefined();
        expect(Array.isArray(data.statistics.topUrls)).toBe(true);
      }
    });
  });
});
