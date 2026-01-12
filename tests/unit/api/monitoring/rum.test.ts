/**
 * RUM API Route Tests
 * Tests Real User Monitoring endpoint functionality
 */

import { NextRequest } from 'next/server';

// Mock the datadog-env module before importing the route
jest.mock('@/lib/monitoring/datadog-env', () => ({
  getRUMPublicConfig: jest.fn(() => ({
    applicationId: 'test-app-id',
    clientToken: 'test-client-token',
    site: 'datadoghq.com',
    env: 'test',
    version: '1.0.0'
  }))
}));

describe('RUM API Route', () => {
  let GET: (request: NextRequest) => Promise<Response>;
  let POST: (request: NextRequest) => Promise<Response>;
  let getRUMPublicConfig: jest.Mock;

  beforeEach(async () => {
    // Import the route module
    const routeModule = await import('@/app/api/monitoring/rum/route');
    GET = routeModule.GET;
    POST = routeModule.POST;

    // Get the mocked function
    const datadogEnvModule = await import('@/lib/monitoring/datadog-env');
    getRUMPublicConfig = datadogEnvModule.getRUMPublicConfig as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/monitoring/rum', () => {
    describe('config action', () => {
      it('should return RUM configuration with valid credentials', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum?action=config');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toMatchObject({
          status: 'success',
          rum: {
            enabled: true,
            applicationId: 'test-app-id',
            site: 'datadoghq.com',
            service: 'vibecode-webgui',
            env: 'test',
            version: '1.0.0',
            features: {
              sessionReplay: true,
              userInteractions: true,
              resources: true,
              longTasks: true,
              webVitals: true,
              errorTracking: true
            },
            sampling: {
              sessionSampleRate: 100,
              sessionReplaySampleRate: expect.any(Number)
            }
          }
        });
        expect(data.timestamp).toBeDefined();
        expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
      });

      it('should return disabled config when credentials are missing', async () => {
        getRUMPublicConfig.mockReturnValueOnce({
          applicationId: '',
          clientToken: '',
          site: 'datadoghq.com',
          env: 'test',
          version: '1.0.0'
        });

        const request = new NextRequest('http://localhost:3000/api/monitoring/rum?action=config');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.rum.enabled).toBe(false);
        expect(data.rum.applicationId).toBe('');
      });

      it('should default to config action when no action specified', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('rum');
        expect(data.status).toBe('success');
      });
    });

    describe('health action', () => {
      it('should return healthy status with valid configuration', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum?action=health');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toMatchObject({
          healthy: true,
          status: 'configured',
          configuration: {
            hasApplicationId: true,
            hasClientToken: true,
            site: 'datadoghq.com'
          },
          features: {
            sessionReplay: true,
            userTracking: true,
            performanceMonitoring: true,
            errorTracking: true
          }
        });
        expect(data.timestamp).toBeDefined();
      });

      it('should return unhealthy status when config is missing', async () => {
        getRUMPublicConfig.mockReturnValueOnce({
          applicationId: '',
          clientToken: '',
          site: 'datadoghq.com',
          env: 'test',
          version: '1.0.0'
        });

        const request = new NextRequest('http://localhost:3000/api/monitoring/rum?action=health');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.healthy).toBe(false);
        expect(data.status).toBe('missing-config');
        expect(data.configuration.hasApplicationId).toBe(false);
        expect(data.configuration.hasClientToken).toBe(false);
      });
    });

    describe('features action', () => {
      it('should return all available RUM features', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum?action=features');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.features).toHaveProperty('session-replay');
        expect(data.features).toHaveProperty('user-interactions');
        expect(data.features).toHaveProperty('web-vitals');
        expect(data.features).toHaveProperty('error-tracking');
        expect(data.features).toHaveProperty('ai-tracking');
        expect(data.features).toHaveProperty('workspace-tracking');
        expect(data.features).toHaveProperty('code-editor-tracking');
        expect(data.features).toHaveProperty('terminal-tracking');

        // Verify feature structure
        Object.values(data.features).forEach((feature: any) => {
          expect(feature).toHaveProperty('enabled');
          expect(feature).toHaveProperty('description');
          expect(typeof feature.enabled).toBe('boolean');
          expect(typeof feature.description).toBe('string');
        });
      });
    });

    describe('error handling', () => {
      it('should return 400 for invalid action', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum?action=invalid');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid action');
        expect(data.available_actions).toEqual(['config', 'health', 'features']);
      });

      it('should return 500 when getRUMPublicConfig throws error', async () => {
        getRUMPublicConfig.mockImplementationOnce(() => {
          throw new Error('Config load failed');
        });

        const request = new NextRequest('http://localhost:3000/api/monitoring/rum?action=config');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to retrieve RUM data');
        expect(data.message).toBe('Config load failed');
        expect(data.timestamp).toBeDefined();
      });
    });
  });

  describe('POST /api/monitoring/rum', () => {
    describe('track_conversion action', () => {
      it('should track conversion successfully', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum', {
          method: 'POST',
          body: JSON.stringify({
            action: 'track_conversion',
            data: {
              conversion_type: 'signup',
              value: 100
            }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Conversion tracked successfully');
        expect(data.timestamp).toBeDefined();
      });
    });

    describe('track_feature_usage action', () => {
      it('should track feature usage successfully', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum', {
          method: 'POST',
          body: JSON.stringify({
            action: 'track_feature_usage',
            data: {
              feature: 'ai-assistant',
              usage_count: 5
            }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Feature usage tracked');
      });
    });

    describe('track_user_journey action', () => {
      it('should track user journey step successfully', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum', {
          method: 'POST',
          body: JSON.stringify({
            action: 'track_user_journey',
            data: {
              step: 'onboarding-complete',
              duration: 120
            }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('User journey step tracked');
      });
    });

    describe('track_performance action', () => {
      it('should track custom performance metrics', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum', {
          method: 'POST',
          body: JSON.stringify({
            action: 'track_performance',
            data: {
              metric: 'code_compile_time',
              value: 1250
            }
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Performance metric tracked');
      });
    });

    describe('error handling', () => {
      it('should return 400 for invalid action', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum', {
          method: 'POST',
          body: JSON.stringify({
            action: 'invalid_action',
            data: {}
          })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid action');
        expect(data.available_actions).toContain('track_conversion');
        expect(data.available_actions).toContain('track_feature_usage');
      });

      it('should handle malformed JSON gracefully', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum', {
          method: 'POST',
          body: 'invalid json'
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to process RUM tracking');
        expect(data.message).toBeDefined();
      });

      it('should handle missing body', async () => {
        const request = new NextRequest('http://localhost:3000/api/monitoring/rum', {
          method: 'POST',
          body: JSON.stringify({})
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid action');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle partial RUM config gracefully', async () => {
      getRUMPublicConfig.mockReturnValueOnce({
        applicationId: 'test-app',
        clientToken: '',
        site: null,
        env: null,
        version: null
      });

      const request = new NextRequest('http://localhost:3000/api/monitoring/rum?action=config');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rum.enabled).toBe(false);
      expect(data.rum.site).toBe('datadoghq.com'); // Default fallback
      expect(data.rum.env).toBe('development'); // Default fallback
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        GET(new NextRequest('http://localhost:3000/api/monitoring/rum?action=health'))
      );

      const responses = await Promise.all(requests);

      responses.forEach(async (response) => {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.healthy).toBe(true);
      });
    });
  });
});
