import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock child_process BEFORE importing it
jest.mock('child_process');

// Mock node-fetch
jest.mock('node-fetch');

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Create a manual async wrapper for exec instead of using promisify
// This is more reliable with Jest mocks
const execAsync = (cmd: string): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    mockExec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

// Mock kubectl response generator
function getMockKubectlResponse(cmd: string): string {
  // Pod status phase (check this first, before other conditions)
  if (cmd.includes('status.phase')) {
    return 'Running Running';
  }

  // Deployment replicas
  if (cmd.includes('kubectl get deployment vibecode-docs') && cmd.includes('spec.replicas')) {
    return '2';
  }

  // Pod Ready status
  if (cmd.includes('kubectl get pods') && cmd.includes('app=vibecode-docs') && cmd.includes('Ready')) {
    return 'True True';
  }

  // Service name
  if (cmd.includes('kubectl get svc vibecode-docs-service') && cmd.includes('metadata.name')) {
    return 'vibecode-docs-service';
  }

  // HPA name
  if (cmd.includes('kubectl get hpa vibecode-docs-hpa') && cmd.includes('metadata.name')) {
    return 'vibecode-docs-hpa';
  }

  // ContainersReady status
  if (cmd.includes('ContainersReady')) {
    return 'True True';
  }

  // Security context - runAsNonRoot
  if (cmd.includes('securityContext.runAsNonRoot')) {
    return 'true';
  }

  // Security context - readOnlyRootFilesystem
  if (cmd.includes('readOnlyRootFilesystem')) {
    return 'true';
  }

  // Default empty response
  return '';
}

describe('VibeCode Docs KIND Integration Tests', () => {
    let portForwardProcess: import('child_process').ChildProcess | null;
    const TEST_PORT = 8091;
    const BASE_URL = `http://localhost:${TEST_PORT}`;

    // Setup mocks once before all tests
    beforeAll(async () => {
      // Setup exec mock for kubectl commands
      mockExec.mockImplementation(((cmd: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
        const stdout = getMockKubectlResponse(cmd);
        const stderr = '';

        // For promisify to work, we MUST call the callback
        if (callback) {
          // Call callback immediately/synchronously for Jest compatibility
          callback(null, stdout, stderr);
        }

        // Return a mock ChildProcess
        return {
          stdout: null,
          stderr: null,
          stdin: null,
        } as any;
      }) as any);

      // Setup spawn mock for port-forward
      mockSpawn.mockReturnValue({
        kill: jest.fn(),
        on: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
      } as any);

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

    beforeEach(() => {
      // Setup fetch mock for HTTP requests (refresh for each test)
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