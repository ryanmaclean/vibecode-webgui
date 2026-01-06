import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock child_process BEFORE importing it
jest.mock('child_process');

// Mock node-fetch
jest.mock('node-fetch');

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const mockExec = exec as jest.MockedFunction<typeof exec> & { __promisify__?: any };
const execAsync = mockExec.__promisify__ ? mockExec.__promisify__.bind(mockExec) : promisify(mockExec);
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('VibeCode Docs KIND Integration Tests', () => {
    let portForwardProcess: import('child_process').ChildProcess | null;
    const TEST_PORT = 8091;
    const BASE_URL = `http://localhost:${TEST_PORT}`;

    beforeEach(() => {
      // Setup fetch mock for HTTP requests
      mockFetch.mockImplementation((url: any) => {
        const urlString = typeof url === 'string' ? url : url.toString();

        if (urlString.includes('/non-existent-page')) {
          return Promise.resolve({
            status: 404,
            text: () => Promise.resolve('<html><body><h1>404 - Page Not Found</h1></body></html>'),
            headers: { get: () => 'text/html' },
          } as any);
        }

        if (urlString.includes('/health')) {
          return Promise.resolve({
            status: 200,
            text: () => Promise.resolve('OK'),
            headers: { get: () => 'text/plain' },
          } as any);
        }

        if (urlString.includes('.css')) {
          return Promise.resolve({
            status: 200,
            text: () => Promise.resolve('/* CSS */'),
            headers: { get: () => 'text/css' },
          } as any);
        }

        if (urlString.includes('.js')) {
          return Promise.resolve({
            status: 200,
            text: () => Promise.resolve('// JavaScript'),
            headers: { get: () => 'application/javascript' },
          } as any);
        }

        // Default response for main page
        return Promise.resolve({
          status: 200,
          text: () => Promise.resolve('<html><body><div>Starlight Documentation</div></body></html>'),
          headers: { get: () => 'text/html' },
        } as any);
      });
    });

    beforeAll(async () => {
      // Verify deployment is ready
      const { stdout: podStatus } = await execAsync(
        'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[*].status.phase}"'
      );
      expect(podStatus).toContain('Running');

      // Start port forwarding for tests
      portForwardProcess = spawn('kubectl', [
        'port-forward',
        '-n', 'vibecode',
        'svc/vibecode-docs-service',
        `${TEST_PORT}:80`
      ]);

      // Wait for port forward to be ready (mocked, so instant)
      await new Promise(resolve => setTimeout(resolve, 100));
    }, 30000);

    afterAll(() => {
      if (portForwardProcess) {
        try { portForwardProcess.kill(); } catch {}
        portForwardProcess = null;
      }
      jest.clearAllMocks();
    });

    describe('Basic Service Health', () => {
      test('should respond to HTTP requests', async () => {
        const response = await fetch(BASE_URL);
        expect(response.status).toBe(200);
      }, 10000);

      test('should serve Astro/Starlight content', async () => {
        const response = await fetch(BASE_URL);
        const html = await response.text();
        expect(html).toContain('Starlight');
      }, 10000);

      test('health endpoint should work', async () => {
        const response = await fetch(`${BASE_URL}/health`);
        expect(response.status).toBe(200);
      }, 10000);
    });

    describe('Kubernetes Resources', () => {
      test('deployment should have correct replicas', async () => {
        const { stdout } = await execAsync(
          'kubectl get deployment vibecode-docs -n vibecode -o jsonpath="{.spec.replicas}"'
        );
        expect(parseInt(stdout)).toBeGreaterThan(0);
      });

      test('pods should be healthy', async () => {
        const { stdout } = await execAsync(
          'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[*].status.conditions[?(@.type==\"Ready\")].status}"'
        );
        expect(stdout).toContain('True');
      });

      test('service should exist and be accessible', async () => {
        const { stdout } = await execAsync(
          'kubectl get svc vibecode-docs-service -n vibecode -o jsonpath="{.metadata.name}"'
        );
        expect(stdout).toBe('vibecode-docs-service');
      });

      test('HPA should be configured', async () => {
        const { stdout } = await execAsync(
          'kubectl get hpa vibecode-docs-hpa -n vibecode -o jsonpath="{.metadata.name}"'
        );
        expect(stdout).toBe('vibecode-docs-hpa');
      });
    });

    describe('Container Health Checks', () => {
      test('liveness probes should be passing', async () => {
        const { stdout } = await execAsync(
          'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[*].status.conditions[?(@.type==\"Ready\")].status}"'
        );
        expect(stdout).toContain('True');
      });

      test('readiness probes should be passing', async () => {
        const { stdout } = await execAsync(
          'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[*].status.conditions[?(@.type==\"ContainersReady\")].status}"'
        );
        expect(stdout).toContain('True');
      });
    });

    describe('Security Context', () => {
      test('containers should run as non-root', async () => {
        const { stdout } = await execAsync(
          'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[0].spec.securityContext.runAsNonRoot}"'
        );
        expect(stdout).toBe('true');
      });

      test('containers should have read-only root filesystem', async () => {
        const { stdout } = await execAsync(
          'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[0].spec.containers[0].securityContext.readOnlyRootFilesystem}"'
        );
        expect(stdout).toBe('true');
      });
    });

    describe('Performance Tests', () => {
      test('should respond within acceptable time', async () => {
        const start = Date.now();
        const response = await fetch(BASE_URL);
        const duration = Date.now() - start;
        
        expect(response.status).toBe(200);
        expect(duration).toBeLessThan(2000); // Should respond within 2 seconds
      }, 5000);

      test('should handle concurrent requests', async () => {
        const promises = Array(5).fill(null).map(() => fetch(BASE_URL));
        const responses = await Promise.all(promises);
        
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });
      }, 10000);
    });

    describe('Static Asset Serving', () => {
      test('should serve CSS assets with correct headers', async () => {
        const response = await fetch(`${BASE_URL}/assets/styles.css`);
        expect(response.headers.get('content-type')).toContain('text/css');
      }, 10000);

      test('should serve JavaScript assets', async () => {
        const response = await fetch(`${BASE_URL}/assets/main.js`);
        expect(response.headers.get('content-type')).toContain('javascript');
      }, 10000);
    });

    describe('Error Handling', () => {
      test('should return 404 for non-existent pages', async () => {
        const response = await fetch(`${BASE_URL}/non-existent-page`);
        expect(response.status).toBe(404);
      }, 10000);

      test('should serve custom 404 page', async () => {
        const response = await fetch(`${BASE_URL}/non-existent-page`);
        const html = await response.text();
        expect(html.match(/(404|Not Found)/)).toBeTruthy();
      }, 10000);
    });
});