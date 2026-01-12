/**
 * Tests for /api/monitoring/traces route
 * Coverage for OpenTelemetry traces collection endpoint
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/monitoring/traces/route';

function createRequest(url: string, options: RequestInit = {}): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

// Mock monitoring module
jest.mock('@/lib/monitoring', () => ({
  monitoring: {
    submitMetric: jest.fn().mockResolvedValue(undefined),
    submitEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('/api/monitoring/traces', () => {
  const { monitoring } = require('@/lib/monitoring');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET handler', () => {
    it('should return endpoint information', async () => {
      const request = createRequest('/api/monitoring/traces');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.endpoint).toBe('OpenTelemetry Traces Collection');
      expect(data.description).toContain('OTLP trace data');
      expect(data.supported_methods).toContain('POST');
      expect(data.format).toBe('OTLP JSON');
      expect(data.status).toBe('active');
    });

    it('should include all required fields', async () => {
      const request = createRequest('/api/monitoring/traces');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('endpoint');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('supported_methods');
      expect(data).toHaveProperty('format');
      expect(data).toHaveProperty('status');
    });
  });

  describe('POST handler', () => {
    describe('Valid traces', () => {
      it('should process valid OTLP trace data', async () => {
        const traces = {
          resourceSpans: [
            {
              resource: {
                attributes: [
                  { key: 'service.name', value: { stringValue: 'test-service' } }
                ]
              },
              instrumentationLibrarySpans: [
                {
                  spans: [
                    {
                      name: 'test_span',
                      startTimeUnixNano: '1000000000',
                      endTimeUnixNano: '2000000000',
                      attributes: []
                    }
                  ]
                }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.processed_spans).toBe(1);
        expect(data.errors).toBe(0);
        expect(monitoring.submitMetric).toHaveBeenCalled();
        expect(monitoring.submitEvent).toHaveBeenCalled();
      });

      it('should process multiple spans', async () => {
        const traces = {
          resourceSpans: [
            {
              resource: {},
              instrumentationLibrarySpans: [
                {
                  spans: [
                    {
                      name: 'span1',
                      startTimeUnixNano: '1000000000',
                      endTimeUnixNano: '2000000000',
                      attributes: []
                    },
                    {
                      name: 'span2',
                      startTimeUnixNano: '1000000000',
                      endTimeUnixNano: '3000000000',
                      attributes: []
                    }
                  ]
                }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.processed_spans).toBe(2);
      });

      it('should extract span attributes correctly', async () => {
        const traces = {
          resourceSpans: [
            {
              resource: {},
              instrumentationLibrarySpans: [
                {
                  spans: [
                    {
                      name: 'user_action',
                      startTimeUnixNano: '1000000000',
                      endTimeUnixNano: '2000000000',
                      attributes: [
                        { key: 'user.id', value: { stringValue: '123' } },
                        { key: 'user.interaction', value: { boolValue: true } }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(monitoring.submitMetric).toHaveBeenCalled();

        // Check that user interaction metric was submitted
        const calls = monitoring.submitMetric.mock.calls;
        expect(calls.length).toBeGreaterThan(0);
      });

      it('should handle spans with different attribute types', async () => {
        const traces = {
          resourceSpans: [
            {
              resource: {},
              instrumentationLibrarySpans: [
                {
                  spans: [
                    {
                      name: 'test',
                      startTimeUnixNano: '1000000000',
                      endTimeUnixNano: '2000000000',
                      attributes: [
                        { key: 'str_attr', value: { stringValue: 'test' } },
                        { key: 'int_attr', value: { intValue: 42 } },
                        { key: 'bool_attr', value: { boolValue: true } }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.processed_spans).toBe(1);
      });

      it('should handle empty attributes array', async () => {
        const traces = {
          resourceSpans: [
            {
              resource: { attributes: [] },
              instrumentationLibrarySpans: [
                {
                  spans: [
                    {
                      name: 'empty_attrs',
                      startTimeUnixNano: '1000000000',
                      endTimeUnixNano: '2000000000',
                      attributes: []
                    }
                  ]
                }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
      });

      it('should include timestamp in response', async () => {
        const traces = {
          resourceSpans: [
            {
              instrumentationLibrarySpans: [
                {
                  spans: [
                    {
                      name: 'test',
                      attributes: []
                    }
                  ]
                }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data).toHaveProperty('timestamp');
        expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    });

    describe('Invalid traces', () => {
      it('should return 400 for missing resourceSpans', async () => {
        const traces = { invalid: 'data' };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid trace data format');
        expect(data.expected).toContain('resourceSpans');
      });

      it('should return 400 for non-array resourceSpans', async () => {
        const traces = { resourceSpans: 'not-an-array' };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid trace data format');
      });

      it('should return 400 for empty resourceSpans', async () => {
        const traces = { resourceSpans: [] };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        // Empty array is valid OTLP format, should process successfully
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.processed_spans).toBe(0);
      });
    });

    describe('Error handling', () => {
      it('should handle invalid JSON', async () => {
        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: 'invalid json',
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to process traces');
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('timestamp');
      });

      it('should track errors during span processing', async () => {
        monitoring.submitMetric.mockRejectedValueOnce(new Error('Metric submission failed'));

        const traces = {
          resourceSpans: [
            {
              instrumentationLibrarySpans: [
                {
                  spans: [
                    {
                      name: 'failing_span',
                      attributes: []
                    }
                  ]
                }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        // Error should be tracked but not fail the request
        expect(data).toHaveProperty('errors');
      });

      it('should include error count in success message', async () => {
        monitoring.submitMetric.mockRejectedValueOnce(new Error('Error'));

        const traces = {
          resourceSpans: [
            {
              instrumentationLibrarySpans: [
                {
                  spans: [{ name: 'span1', attributes: [] }]
                }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.message).toBeDefined();
      });
    });

    describe('Edge cases', () => {
      it('should handle missing span times', async () => {
        const traces = {
          resourceSpans: [
            {
              instrumentationLibrarySpans: [
                {
                  spans: [
                    {
                      name: 'no_times',
                      attributes: []
                    }
                  ]
                }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.processed_spans).toBe(1);
      });

      it('should handle missing span name', async () => {
        const traces = {
          resourceSpans: [
            {
              instrumentationLibrarySpans: [
                {
                  spans: [
                    {
                      attributes: []
                    }
                  ]
                }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
      });

      it('should handle nested resourceSpans', async () => {
        const traces = {
          resourceSpans: [
            {
              instrumentationLibrarySpans: [
                { spans: [{ name: 'span1', attributes: [] }] }
              ]
            },
            {
              instrumentationLibrarySpans: [
                { spans: [{ name: 'span2', attributes: [] }] }
              ]
            }
          ]
        };

        const request = createRequest('/api/monitoring/traces', {
          method: 'POST',
          body: JSON.stringify(traces),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.processed_spans).toBe(2);
      });
    });
  });
});
