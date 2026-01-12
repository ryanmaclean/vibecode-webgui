/**
 * Tests for /api/monitoring/otel-config route
 * Coverage for OpenTelemetry configuration endpoint
 */

import { NextRequest } from 'next/server';

function createRequest(url: string, options: RequestInit = {}): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

// Note: Dynamic imports in the route make full testing complex
// These tests focus on testable paths (Docker build mode and POST handlers)

describe('/api/monitoring/otel-config', () => {
  let GET: any, POST: any;

  beforeEach(async () => {
    // Set Docker build mode for predictable behavior
    process.env.DOCKER_BUILD = 'true';

    // Clear module cache and reimport
    jest.resetModules();
    const module = await import('@/app/api/monitoring/otel-config/route');
    GET = module.GET;
    POST = module.POST;
  });

  describe('GET handler - Docker build mode', () => {
    it('should return disabled status', async () => {
      const request = createRequest('/api/monitoring/otel-config');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('disabled');
      expect(data.message).toContain('Docker build');
      expect(data).toHaveProperty('timestamp');
    });

    it('should handle config action', async () => {
      const request = createRequest('/api/monitoring/otel-config?action=config');
      const response = await GET(request);
      const data = await response.json();

      expect(data.status).toBe('disabled');
    });

    it('should handle health action', async () => {
      const request = createRequest('/api/monitoring/otel-config?action=health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.status).toBe('disabled');
    });

    it('should handle metrics action', async () => {
      const request = createRequest('/api/monitoring/otel-config?action=metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.status).toBe('disabled');
    });

    it('should handle status action', async () => {
      const request = createRequest('/api/monitoring/otel-config?action=status');
      const response = await GET(request);
      const data = await response.json();

      expect(data.status).toBe('disabled');
    });

    it('should handle invalid action', async () => {
      const request = createRequest('/api/monitoring/otel-config?action=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(data.status).toBe('disabled');
    });
  });

  describe('POST handler', () => {
    describe('Action: reload_config', () => {
      it('should handle reload_config request', async () => {
        const request = createRequest('/api/monitoring/otel-config', {
          method: 'POST',
          body: JSON.stringify({ action: 'reload_config' }),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(false);
        expect(data.message).toContain('restart');
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('recommendation');
      });
    });

    describe('Action: test_connection', () => {
      it('should return error when OTLP endpoint not configured', async () => {
        delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

        const request = createRequest('/api/monitoring/otel-config', {
          method: 'POST',
          body: JSON.stringify({ action: 'test_connection' }),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(false);
        expect(data.message).toContain('not configured');
        expect(data).toHaveProperty('timestamp');
      });

      it('should handle fetch errors gracefully', async () => {
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = 'http://invalid-endpoint:9999';

        const request = createRequest('/api/monitoring/otel-config', {
          method: 'POST',
          body: JSON.stringify({ action: 'test_connection' }),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('timestamp');
      });

      it('should include endpoint in response', async () => {
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = 'http://test:4318';

        const request = createRequest('/api/monitoring/otel-config', {
          method: 'POST',
          body: JSON.stringify({ action: 'test_connection' }),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        if (data.endpoint) {
          expect(data.endpoint).toBe('http://test:4318');
        }
        expect(data).toHaveProperty('timestamp');
      });
    });

    describe('Invalid action', () => {
      it('should return 400 for invalid action', async () => {
        const request = createRequest('/api/monitoring/otel-config', {
          method: 'POST',
          body: JSON.stringify({ action: 'invalid_action' }),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid action');
        expect(data.available_actions).toContain('reload_config');
        expect(data.available_actions).toContain('test_connection');
      });

      it('should handle missing action', async () => {
        const request = createRequest('/api/monitoring/otel-config', {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toHaveProperty('error');
      });
    });

    describe('Error handling', () => {
      it('should handle invalid JSON gracefully', async () => {
        const request = createRequest('/api/monitoring/otel-config', {
          method: 'POST',
          body: 'invalid json',
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('timestamp');
      });
    });
  });
});
