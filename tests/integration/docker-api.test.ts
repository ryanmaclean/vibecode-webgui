/**
 * Docker API Integration Tests
 */

import { GET, POST } from '@/app/api/docker/status/route';
import * as dockerDetection from '@/lib/docker/detection';

// Mock the docker detection module
jest.mock('@/lib/docker/detection');

const mockDetectDockerRuntime = dockerDetection.detectDockerRuntime as jest.MockedFunction<
  typeof dockerDetection.detectDockerRuntime
>;
const mockGetDockerStatusReport = dockerDetection.getDockerStatusReport as jest.MockedFunction<
  typeof dockerDetection.getDockerStatusReport
>;
const mockStartColima = dockerDetection.startColima as jest.MockedFunction<
  typeof dockerDetection.startColima
>;

describe('Docker Status API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/docker/status', () => {
    it('should return basic Docker status', async () => {
      mockDetectDockerRuntime.mockResolvedValue({
        dockerType: dockerDetection.DockerType.DockerDesktop,
        running: true,
        version: '24.0.7',
        socketPath: '/var/run/docker.sock',
      });

      const request = new Request('http://localhost:3000/api/docker/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.dockerType).toBe('DockerDesktop');
      expect(data.data.running).toBe(true);
      expect(data.data.version).toBe('24.0.7');
    });

    it('should return detailed status when requested', async () => {
      mockGetDockerStatusReport.mockResolvedValue({
        runtime: {
          dockerType: dockerDetection.DockerType.Colima,
          running: true,
          version: '24.0.7',
          socketPath: '/Users/user/.colima/default/docker.sock',
          contextName: 'colima',
        },
        installed: true,
        daemonStatus: { accessible: true },
        contexts: [
          {
            name: 'colima',
            current: true,
            dockerEndpoint: 'unix:///Users/user/.colima/default/docker.sock',
          },
        ],
      });

      const request = new Request('http://localhost:3000/api/docker/status?detailed=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.runtime.dockerType).toBe('Colima');
      expect(data.data.installed).toBe(true);
      expect(data.data.contexts).toHaveLength(1);
    });

    it('should handle detection errors gracefully', async () => {
      mockDetectDockerRuntime.mockRejectedValue(new Error('Detection failed'));

      const request = new Request('http://localhost:3000/api/docker/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to detect Docker runtime');
    });

    it('should return NotInstalled when no runtime found', async () => {
      mockDetectDockerRuntime.mockResolvedValue({
        dockerType: dockerDetection.DockerType.NotInstalled,
        running: false,
      });

      const request = new Request('http://localhost:3000/api/docker/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.dockerType).toBe('NotInstalled');
      expect(data.data.running).toBe(false);
    });
  });

  describe('POST /api/docker/status/start', () => {
    it('should start Colima successfully', async () => {
      mockStartColima.mockResolvedValue({
        success: true,
        message: 'Colima started successfully',
      });

      const request = new Request('http://localhost:3000/api/docker/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-colima' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Colima started successfully');
    });

    it('should handle Colima start failure', async () => {
      mockStartColima.mockResolvedValue({
        success: false,
        message: 'Colima not installed',
      });

      const request = new Request('http://localhost:3000/api/docker/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-colima' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Colima not installed');
    });

    it('should reject invalid actions', async () => {
      const request = new Request('http://localhost:3000/api/docker/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalid-action' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid action');
    });

    it('should handle exceptions gracefully', async () => {
      mockStartColima.mockRejectedValue(new Error('Unexpected error'));

      const request = new Request('http://localhost:3000/api/docker/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-colima' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to process action');
    });
  });
});
