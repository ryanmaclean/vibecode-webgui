import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

describe('VibeCode Docs KIND Integration Tests', () => {
  let portForwardProcess: any;
  const TEST_PORT = 8091;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  beforeAll(async () => {
    // Verify deployment is ready
    const { stdout: podStatus } = await execAsync(
      'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[*].status.phase}"'
    );
    expect(podStatus).toContain('Running');

    // Start port forwarding for tests
    const { spawn } = require('child_process');
    portForwardProcess = spawn('kubectl', [
      'port-forward',
      '-n', 'vibecode',
      'svc/vibecode-docs-service',
      `${TEST_PORT}:80`
    ]);

    // Wait for port forward to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
  }, 30000);

  afterAll(async () => {
    // Clean up port forwarding
    if (portForwardProcess) {
      portForwardProcess.kill();
    }
  });

  describe('Basic Service Health', () => {
    test('should respond to HTTP requests', async () => {
      const response = await fetch(BASE_URL);
      expect(response.status).toBe(200);
    });

    test('should serve Astro/Starlight content', async () => {
      const response = await fetch(BASE_URL);
      const content = await response.text();
      
      expect(content).toContain('VibeCode Platform');
      expect(content).toContain('astro-');
      expect(content).toContain('starlight');
    });

    test('health endpoint should work', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect(response.status).toBe(200);
      
      const content = await response.text();
      expect(content).toContain('healthy');
    });
  });

  describe('Kubernetes Resources', () => {
    test('deployment should have correct replicas', async () => {
      const { stdout } = await execAsync(
        'kubectl get deployment vibecode-docs -n vibecode -o jsonpath="{.status.readyReplicas}"'
      );
      expect(parseInt(stdout)).toBe(2);
    });

    test('pods should be healthy', async () => {
      const { stdout } = await execAsync(
        'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[*].status.conditions[?(@.type==\\"Ready\\")].status}"'
      );
      expect(stdout).toBe('True True');
    });

    test('service should exist and be accessible', async () => {
      const { stdout } = await execAsync(
        'kubectl get svc vibecode-docs-service -n vibecode -o jsonpath="{.spec.ports[0].port}"'
      );
      expect(stdout).toBe('80');
    });

    test('HPA should be configured', async () => {
      const { stdout } = await execAsync(
        'kubectl get hpa vibecode-docs-hpa -n vibecode -o jsonpath="{.spec.maxReplicas}"'
      );
      expect(parseInt(stdout)).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Container Health Checks', () => {
    test('liveness probes should be passing', async () => {
      const { stdout } = await execAsync(
        'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[*].status.conditions[?(@.type==\\"Ready\\")].status}"'
      );
      expect(stdout).not.toContain('False');
    });

    test('readiness probes should be passing', async () => {
      const { stdout } = await execAsync(
        'kubectl describe pods -n vibecode -l app=vibecode-docs | grep "Readiness probe failed" | wc -l'
      );
      expect(parseInt(stdout.trim())).toBe(0);
    });
  });

  describe('Security Context', () => {
    test('containers should run as non-root', async () => {
      const { stdout } = await execAsync(
        'kubectl get pods -n vibecode -l app=vibecode-docs -o jsonpath="{.items[0].spec.containers[0].securityContext.runAsUser}"'
      );
      expect(stdout).toBe('1001');
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
    });

    test('should handle concurrent requests', async () => {
      const requests = Array(10).fill(0).map(() => fetch(BASE_URL));
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Static Asset Serving', () => {
    test('should serve CSS assets with correct headers', async () => {
      // First get the main page to find CSS links
      const mainResponse = await fetch(BASE_URL);
      const content = await mainResponse.text();
      
      // Look for CSS links
      const cssMatch = content.match(/href="([^"]*\.css[^"]*)"/);
      if (cssMatch) {
        const cssUrl = cssMatch[1].startsWith('http') ? cssMatch[1] : `${BASE_URL}${cssMatch[1]}`;
        const cssResponse = await fetch(cssUrl);
        
        expect(cssResponse.status).toBe(200);
        expect(cssResponse.headers.get('content-type')).toContain('css');
      }
    });

    test('should serve JavaScript assets', async () => {
      const mainResponse = await fetch(BASE_URL);
      const content = await mainResponse.text();
      
      // Look for JS links
      const jsMatch = content.match(/src="([^"]*\.js[^"]*)"/);
      if (jsMatch) {
        const jsUrl = jsMatch[1].startsWith('http') ? jsMatch[1] : `${BASE_URL}${jsMatch[1]}`;
        const jsResponse = await fetch(jsUrl);
        
        expect(jsResponse.status).toBe(200);
      }
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent pages', async () => {
      const response = await fetch(`${BASE_URL}/non-existent-page`);
      expect(response.status).toBe(404);
    });

    test('should serve custom 404 page', async () => {
      const response = await fetch(`${BASE_URL}/non-existent-page`);
      const content = await response.text();
      expect(content).toContain('404');
    });
  });
});