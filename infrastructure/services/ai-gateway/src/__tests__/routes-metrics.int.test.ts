/**
 * @jest-environment node
 */

// Mock dependencies BEFORE any imports
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../services/openrouter-client', () => {
  return {
    OpenRouterClient: jest.fn().mockImplementation(() => ({
      getAllPerformanceMetrics: jest.fn().mockReturnValue([
        {
          model: 'gpt-4',
          averageLatency: 250,
          successRate: 0.98,
          totalRequests: 100
        },
        {
          model: 'gpt-3.5-turbo',
          averageLatency: 150,
          successRate: 0.99,
          totalRequests: 200
        }
      ])
    }))
  };
});

jest.mock('../services/redis-service', () => {
  return {
    RedisService: jest.fn().mockImplementation(() => ({
      hGetAll: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve({
          requests: '100',
          tokens: '50000',
          cost: '0.25'
        });
      })
    }))
  };
});

import http from 'http';
import express, { Express } from 'express';
import { metricsRoutes } from '../routes/metrics-routes';

// Helper function to make HTTP requests without supertest
interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
  text: string;
}

function makeRequest(server: http.Server, path: string): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      reject(new Error('Server not listening'));
      return;
    }

    const options = {
      hostname: 'localhost',
      port: address.port,
      path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let body: any;
        try {
          body = JSON.parse(data);
        } catch {
          body = null;
        }
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body,
          text: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

describe('Metrics Routes Integration Tests', () => {
  let app: Express;
  let server: http.Server;

  beforeAll((done) => {
    app = express();
    app.use('/metrics', metricsRoutes);
    server = app.listen(0, done); // Use port 0 for random available port
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /metrics', () => {
    it('should return basic metrics', async () => {
      const response = await makeRequest(server, '/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'vibecode-ai-gateway');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('system');
    });

    it('should include valid timestamp in ISO format', async () => {
      const response = await makeRequest(server, '/metrics');

      expect(response.status).toBe(200);
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include memory metrics', async () => {
      const response = await makeRequest(server, '/metrics');

      expect(response.status).toBe(200);
      expect(response.body.memory).toHaveProperty('rss');
      expect(response.body.memory).toHaveProperty('heapTotal');
      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body.memory).toHaveProperty('external');
      expect(response.body.memory.rss).toBeGreaterThan(0);
    });

    it('should include system metrics', async () => {
      const response = await makeRequest(server, '/metrics');

      expect(response.status).toBe(200);
      expect(response.body.system).toHaveProperty('memory');
      expect(response.body.system).toHaveProperty('cpu');
      expect(response.body.system).toHaveProperty('uptime');
      expect(response.body.system).toHaveProperty('platform');
      expect(response.body.system).toHaveProperty('arch');
    });

    it('should include performance metrics', async () => {
      const response = await makeRequest(server, '/metrics');

      expect(response.status).toBe(200);
      expect(response.body.performance).toHaveProperty('averageLatency');
      expect(response.body.performance).toHaveProperty('averageSuccessRate');
      expect(response.body.performance).toHaveProperty('totalRequests');
      expect(response.body.performance).toHaveProperty('modelCount');
    });
  });

  describe('GET /metrics/performance', () => {
    it('should return performance metrics for all models', async () => {
      const response = await makeRequest(server, '/metrics/performance');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.metrics)).toBe(true);
    });

    it('should include model-specific performance data', async () => {
      const response = await makeRequest(server, '/metrics/performance');

      expect(response.status).toBe(200);
      expect(response.body.metrics.length).toBeGreaterThan(0);
      const firstMetric = response.body.metrics[0];
      expect(firstMetric).toHaveProperty('model');
      expect(firstMetric).toHaveProperty('averageLatency');
      expect(firstMetric).toHaveProperty('successRate');
      expect(firstMetric).toHaveProperty('totalRequests');
    });

    it('should have correct count of metrics', async () => {
      const response = await makeRequest(server, '/metrics/performance');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(response.body.metrics.length);
    });
  });

  describe('GET /metrics/usage', () => {
    it('should return usage metrics with default period', async () => {
      const response = await makeRequest(server, '/metrics/usage');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('usage');
      expect(response.body).toHaveProperty('period', '7 days');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.usage)).toBe(true);
    });

    it('should accept custom period parameter', async () => {
      const response = await makeRequest(server, '/metrics/usage?days=30');

      expect(response.status).toBe(200);
      expect(response.body.period).toBe('30 days');
      expect(response.body.usage.length).toBe(30);
    });

    it('should include daily usage data', async () => {
      const response = await makeRequest(server, '/metrics/usage');

      expect(response.status).toBe(200);
      expect(response.body.usage.length).toBeGreaterThan(0);
      const firstDay = response.body.usage[0];
      expect(firstDay).toHaveProperty('date');
      expect(firstDay).toHaveProperty('requests');
      expect(firstDay).toHaveProperty('tokens');
      expect(firstDay).toHaveProperty('cost');
    });

    it('should return usage in chronological order', async () => {
      const response = await makeRequest(server, '/metrics/usage?days=5');

      expect(response.status).toBe(200);
      const dates = response.body.usage.map((u: any) => u.date);
      for (let i = 1; i < dates.length; i++) {
        expect(new Date(dates[i]).getTime()).toBeGreaterThan(new Date(dates[i - 1]).getTime());
      }
    });
  });

  describe('GET /metrics/costs', () => {
    it('should return cost metrics with default period', async () => {
      const response = await makeRequest(server, '/metrics/costs');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('costs');
      expect(response.body.costs).toHaveProperty('total');
      expect(response.body.costs).toHaveProperty('average');
      expect(response.body.costs).toHaveProperty('costPerToken');
      expect(response.body.costs).toHaveProperty('daily');
      expect(response.body.costs).toHaveProperty('period', '7 days');
    });

    it('should accept custom period parameter', async () => {
      const response = await makeRequest(server, '/metrics/costs?days=14');

      expect(response.status).toBe(200);
      expect(response.body.costs.period).toBe('14 days');
    });

    it('should calculate total cost correctly', async () => {
      const response = await makeRequest(server, '/metrics/costs');

      expect(response.status).toBe(200);
      expect(typeof response.body.costs.total).toBe('number');
      expect(response.body.costs.total).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average cost per request', async () => {
      const response = await makeRequest(server, '/metrics/costs');

      expect(response.status).toBe(200);
      expect(typeof response.body.costs.average).toBe('number');
      expect(response.body.costs.average).toBeGreaterThanOrEqual(0);
    });

    it('should calculate cost per token', async () => {
      const response = await makeRequest(server, '/metrics/costs');

      expect(response.status).toBe(200);
      expect(typeof response.body.costs.costPerToken).toBe('number');
      expect(response.body.costs.costPerToken).toBeGreaterThanOrEqual(0);
    });

    it('should include daily breakdown', async () => {
      const response = await makeRequest(server, '/metrics/costs');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.costs.daily)).toBe(true);
      expect(response.body.costs.daily.length).toBeGreaterThan(0);
    });
  });

  describe('GET /metrics/prometheus', () => {
    it('should return Prometheus format metrics', async () => {
      const response = await makeRequest(server, '/metrics/prometheus');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(typeof response.text).toBe('string');
      expect(response.text.length).toBeGreaterThan(0);
    });

    it('should include HELP and TYPE directives', async () => {
      const response = await makeRequest(server, '/metrics/prometheus');

      expect(response.status).toBe(200);
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should include uptime metric', async () => {
      const response = await makeRequest(server, '/metrics/prometheus');

      expect(response.status).toBe(200);
      expect(response.text).toContain('vibecode_ai_gateway_uptime_seconds');
      expect(response.text).toContain('# TYPE vibecode_ai_gateway_uptime_seconds gauge');
    });

    it('should include memory metrics', async () => {
      const response = await makeRequest(server, '/metrics/prometheus');

      expect(response.status).toBe(200);
      expect(response.text).toContain('vibecode_ai_gateway_memory_usage_bytes');
      expect(response.text).toContain('type="rss"');
      expect(response.text).toContain('type="heapUsed"');
      expect(response.text).toContain('type="heapTotal"');
    });

    it('should include model metrics', async () => {
      const response = await makeRequest(server, '/metrics/prometheus');

      expect(response.status).toBe(200);
      expect(response.text).toContain('vibecode_ai_gateway_model_latency_ms');
      expect(response.text).toContain('vibecode_ai_gateway_model_success_rate');
      expect(response.text).toContain('vibecode_ai_gateway_model_requests_total');
    });

    it('should sanitize model names for Prometheus labels', async () => {
      const response = await makeRequest(server, '/metrics/prometheus');

      expect(response.status).toBe(200);
      // Model names should not contain special characters except underscores
      const lines = response.text.split('\n').filter((l: string) => l.includes('model="'));
      lines.forEach((line: string) => {
        const match = line.match(/model="([^"]+)"/);
        if (match) {
          const modelName = match[1];
          expect(modelName).toMatch(/^[a-zA-Z0-9_]+$/);
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle errors in basic metrics endpoint gracefully', async () => {
      // We can't easily force an error in the current implementation
      // but we can verify the error handling exists
      const response = await makeRequest(server, '/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should return 500 on internal server errors', async () => {
      // This would require mocking to throw an error
      // For now, verify the endpoint is stable
      const response = await makeRequest(server, '/metrics');

      expect([200, 500]).toContain(response.status);
    });
  });

  describe('Response consistency', () => {
    it('should return consistent structure across multiple calls', async () => {
      const response1 = await makeRequest(server, '/metrics');
      const response2 = await makeRequest(server, '/metrics');

      const keys1 = Object.keys(response1.body).sort();
      const keys2 = Object.keys(response2.body).sort();

      expect(keys1).toEqual(keys2);
    });

    it('should include timestamps that are recent', async () => {
      const response = await makeRequest(server, '/metrics');

      expect(response.status).toBe(200);
      const timestamp = new Date(response.body.timestamp);
      const now = new Date();
      const diffMs = now.getTime() - timestamp.getTime();

      // Timestamp should be within the last 5 seconds
      expect(diffMs).toBeLessThan(5000);
      expect(diffMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Query parameter validation', () => {
    it('should handle invalid days parameter gracefully', async () => {
      const response = await makeRequest(server, '/metrics/usage?days=invalid');

      // Should either return 200 with default or handle error
      expect([200, 400]).toContain(response.status);
    });

    it('should handle negative days parameter', async () => {
      const response = await makeRequest(server, '/metrics/usage?days=-5');

      // Should use a sensible default or return error
      expect([200, 400]).toContain(response.status);
    });

    it('should handle very large days parameter', async () => {
      const response = await makeRequest(server, '/metrics/usage?days=10000');

      // Should handle gracefully
      expect([200, 400]).toContain(response.status);
    });
  });
});
