/**
 * Unit tests for Docker Status API Route
 * Tests Docker runtime detection and status reporting
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/docker/status/route';

// Mock Docker detection utilities
jest.mock('@/lib/docker/detection', () => ({
  detectDockerRuntime: jest.fn(),
  getDockerStatusReport: jest.fn(),
  startColima: jest.fn(),
  DockerType: {
    DOCKER_DESKTOP: 'docker-desktop',
    COLIMA: 'colima',
    PODMAN: 'podman',
    NONE: 'none'
  }
}));

// Helper function to create a mock NextRequest
function createMockRequest(url: string, method: string, body?: any): NextRequest {
  const options: any = {
    method,
    headers: {
      'content-type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return new NextRequest(url, options);
}

describe('/api/docker/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getMocks = () => {
    const { detectDockerRuntime, getDockerStatusReport, startColima } = require('@/lib/docker/detection');
    return { detectDockerRuntime, getDockerStatusReport, startColima };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/docker/status', () => {
    const mockDockerStatus = {
      dockerType: 'docker-desktop',
      running: true,
      version: '24.0.0',
      platform: 'darwin'
    };

    it('should detect Docker runtime successfully', async () => {
      const { detectDockerRuntime } = getMocks();
      detectDockerRuntime.mockResolvedValue(mockDockerStatus);

      const request = createMockRequest('http://localhost:3000/api/docker/status', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockDockerStatus);
    });

    it('should return detailed report when requested', async () => {
      const { getDockerStatusReport } = getMocks();
      const mockDetailedReport = {
        runtime: mockDockerStatus,
        containers: { running: 5, stopped: 2 },
        images: 10,
        volumes: 3
      };

      getDockerStatusReport.mockResolvedValue(mockDetailedReport);

      const request = createMockRequest('http://localhost:3000/api/docker/status?detailed=true', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockDetailedReport);
      expect(getDockerStatusReport).toHaveBeenCalled();
    });

    it('should handle detection errors gracefully', async () => {
      const { detectDockerRuntime } = getMocks();
      detectDockerRuntime.mockRejectedValue(new Error('Detection failed'));

      const request = createMockRequest('http://localhost:3000/api/docker/status', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to detect Docker runtime');
    });

    it('should detect Docker Desktop', async () => {
      const { detectDockerRuntime } = getMocks();
      detectDockerRuntime.mockResolvedValue({
        dockerType: 'docker-desktop',
        running: true,
        version: '24.0.0'
      });

      const request = createMockRequest('http://localhost:3000/api/docker/status', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.dockerType).toBe('docker-desktop');
      expect(data.data.running).toBe(true);
    });

    it('should detect Colima', async () => {
      const { detectDockerRuntime } = getMocks();
      detectDockerRuntime.mockResolvedValue({
        dockerType: 'colima',
        running: false,
        version: '0.5.0'
      });

      const request = createMockRequest('http://localhost:3000/api/docker/status', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.dockerType).toBe('colima');
      expect(data.data.running).toBe(false);
    });

    it('should handle when no Docker runtime is found', async () => {
      const { detectDockerRuntime } = getMocks();
      detectDockerRuntime.mockResolvedValue({
        dockerType: 'none',
        running: false,
        version: null
      });

      const request = createMockRequest('http://localhost:3000/api/docker/status', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.dockerType).toBe('none');
      expect(data.data.running).toBe(false);
    });
  });

  describe('POST /api/docker/status', () => {
    it('should start Colima successfully', async () => {
      const { startColima } = getMocks();
      startColima.mockResolvedValue({
        success: true,
        message: 'Colima started successfully'
      });

      const request = createMockRequest('http://localhost:3000/api/docker/status', 'POST', {
        action: 'start-colima'
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Colima started successfully');
    });

    it('should handle Colima start failure', async () => {
      const { startColima } = getMocks();
      startColima.mockResolvedValue({
        success: false,
        message: 'Colima is not installed'
      });

      const request = createMockRequest('http://localhost:3000/api/docker/status', 'POST', {
        action: 'start-colima'
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Colima is not installed');
    });

    it('should return status when action is status', async () => {
      const { detectDockerRuntime } = getMocks();
      detectDockerRuntime.mockResolvedValue({
        dockerType: 'docker-desktop',
        running: true
      });

      const request = createMockRequest('http://localhost:3000/api/docker/status', 'POST', {
        action: 'status'
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.dockerType).toBe('docker-desktop');
    });

    it('should return info when action is info', async () => {
      const { getDockerStatusReport } = getMocks();
      getDockerStatusReport.mockResolvedValue({
        runtime: { dockerType: 'docker-desktop', running: true },
        containers: { running: 3 }
      });

      const request = createMockRequest('http://localhost:3000/api/docker/status', 'POST', {
        action: 'info'
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.runtime).toBeDefined();
    });

    it('should reject invalid action', async () => {
      const request = createMockRequest('http://localhost:3000/api/docker/status', 'POST', {
        action: 'invalid-action'
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should validate request schema', async () => {
      const request = createMockRequest('http://localhost:3000/api/docker/status', 'POST', {
        // Missing action field
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid request parameters');
    });

    it('should handle internal errors', async () => {
      const { startColima } = getMocks();
      startColima.mockRejectedValue(new Error('Unexpected error'));

      const request = createMockRequest('http://localhost:3000/api/docker/status', 'POST', {
        action: 'start-colima'
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to process action');
    });
  });
});
