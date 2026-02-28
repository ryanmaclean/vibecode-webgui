/**
 * Docker API Client Tests
 */

import {
  getDockerStatus,
  getDockerStatusReport,
  startColima,
  isDockerRunning,
  getDockerStatusMessage,
} from '@/lib/docker/client';
import type {
  DockerStatusResponse,
  DockerStatusReportResponse,
  DockerActionResponse,
} from '@/types/docker';
import { DockerType } from '@/types/docker';

describe('Docker API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDockerStatus', () => {
    it('should fetch Docker status successfully', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.DockerDesktop,
          version: '24.0.7',
          running: true,
          socketPath: '/var/run/docker.sock',
          contextName: 'default',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatus();

      expect(global.fetch).toHaveBeenCalledWith('/api/docker/status');
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.data?.dockerType).toBe(DockerType.DockerDesktop);
      expect(result.data?.running).toBe(true);
    });

    it('should handle Colima status', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.Colima,
          version: '0.6.8',
          running: true,
          contextName: 'colima',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatus();

      expect(result.success).toBe(true);
      expect(result.data?.dockerType).toBe(DockerType.Colima);
    });

    it('should handle Podman status', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.Podman,
          version: '4.9.0',
          running: true,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatus();

      expect(result.success).toBe(true);
      expect(result.data?.dockerType).toBe(DockerType.Podman);
    });

    it('should handle Docker not running', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.DockerDesktop,
          running: false,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatus();

      expect(result.success).toBe(true);
      expect(result.data?.running).toBe(false);
    });

    it('should handle fetch errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await getDockerStatus();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle generic errors', async () => {
      global.fetch = jest.fn().mockRejectedValue('Unknown error');

      const result = await getDockerStatus();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch Docker status');
    });
  });

  describe('getDockerStatusReport', () => {
    it('should fetch detailed Docker status report successfully', async () => {
      const mockResponse: DockerStatusReportResponse = {
        success: true,
        data: {
          runtime: {
            dockerType: DockerType.DockerDesktop,
            version: '24.0.7',
            running: true,
            socketPath: '/var/run/docker.sock',
            contextName: 'default',
          },
          installed: true,
          daemonStatus: {
            accessible: true,
          },
          contexts: [
            {
              name: 'default',
              current: true,
              dockerEndpoint: 'unix:///var/run/docker.sock',
            },
          ],
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusReport();

      expect(global.fetch).toHaveBeenCalledWith('/api/docker/status?detailed=true');
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.data?.installed).toBe(true);
      expect(result.data?.daemonStatus.accessible).toBe(true);
      expect(result.data?.contexts).toHaveLength(1);
    });

    it('should handle daemon not accessible', async () => {
      const mockResponse: DockerStatusReportResponse = {
        success: true,
        data: {
          runtime: {
            dockerType: DockerType.DockerDesktop,
            running: false,
          },
          installed: true,
          daemonStatus: {
            accessible: false,
            error: 'Cannot connect to Docker daemon',
          },
          contexts: [],
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusReport();

      expect(result.success).toBe(true);
      expect(result.data?.daemonStatus.accessible).toBe(false);
      expect(result.data?.daemonStatus.error).toBeDefined();
    });

    it('should handle multiple contexts', async () => {
      const mockResponse: DockerStatusReportResponse = {
        success: true,
        data: {
          runtime: {
            dockerType: DockerType.Colima,
            version: '0.6.8',
            running: true,
            contextName: 'colima',
          },
          installed: true,
          daemonStatus: {
            accessible: true,
          },
          contexts: [
            {
              name: 'default',
              current: false,
              dockerEndpoint: 'unix:///var/run/docker.sock',
            },
            {
              name: 'colima',
              current: true,
              dockerEndpoint: 'unix:///Users/user/.colima/default/docker.sock',
            },
          ],
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusReport();

      expect(result.success).toBe(true);
      expect(result.data?.contexts).toHaveLength(2);
      expect(result.data?.contexts[1].current).toBe(true);
    });

    it('should handle fetch errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await getDockerStatusReport();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('should handle generic errors', async () => {
      global.fetch = jest.fn().mockRejectedValue('Unknown error');

      const result = await getDockerStatusReport();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch Docker status report');
    });
  });

  describe('startColima', () => {
    it('should start Colima successfully', async () => {
      const mockResponse: DockerActionResponse = {
        success: true,
        message: 'Colima started successfully',
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await startColima();

      expect(global.fetch).toHaveBeenCalledWith('/api/docker/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start-colima' }),
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Colima started successfully');
    });

    it('should handle Colima not installed', async () => {
      const mockResponse: DockerActionResponse = {
        success: false,
        error: 'Colima is not installed',
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await startColima();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle start failure', async () => {
      const mockResponse: DockerActionResponse = {
        success: false,
        error: 'Failed to start Colima',
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await startColima();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to start Colima');
    });

    it('should handle fetch errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await startColima();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should handle generic errors', async () => {
      global.fetch = jest.fn().mockRejectedValue('Unknown error');

      const result = await startColima();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to start Colima');
    });
  });

  describe('isDockerRunning', () => {
    it('should return true when Docker is running', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.DockerDesktop,
          version: '24.0.7',
          running: true,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await isDockerRunning();

      expect(result).toBe(true);
    });

    it('should return false when Docker is not running', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.DockerDesktop,
          running: false,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await isDockerRunning();

      expect(result).toBe(false);
    });

    it('should return false when status fetch fails', async () => {
      const mockResponse: DockerStatusResponse = {
        success: false,
        error: 'Failed to fetch status',
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await isDockerRunning();

      expect(result).toBe(false);
    });

    it('should return false when data is undefined', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await isDockerRunning();

      expect(result).toBe(false);
    });

    it('should return false on fetch error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await isDockerRunning();

      expect(result).toBe(false);
    });
  });

  describe('getDockerStatusMessage', () => {
    it('should return running message for Docker Desktop', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.DockerDesktop,
          version: '24.0.7',
          running: true,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('Docker Desktop 24.0.7 is running');
    });

    it('should return running message for Colima', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.Colima,
          version: '0.6.8',
          running: true,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('Colima 0.6.8 is running');
    });

    it('should return running message for Podman', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.Podman,
          version: '4.9.0',
          running: true,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('Podman 4.9.0 is running');
    });

    it('should handle running without version', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.DockerDesktop,
          running: true,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('Docker Desktop  is running');
    });

    it('should return not running message for Docker Desktop', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.DockerDesktop,
          running: false,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('Docker Desktop is installed but not running');
    });

    it('should return not running message for Colima', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.Colima,
          running: false,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('Colima is installed but not running');
    });

    it('should return not running message for Podman', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.Podman,
          running: false,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('Podman is installed but not running');
    });

    it('should handle NotInstalled type', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: DockerType.NotInstalled,
          running: false,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('No container runtime detected');
    });

    it('should handle unknown docker type when running', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
        data: {
          dockerType: 'Unknown' as DockerType,
          running: true,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('Container runtime is running');
    });

    it('should handle request failure', async () => {
      const mockResponse: DockerStatusResponse = {
        success: false,
        error: 'API error',
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('Unable to check Docker status');
    });

    it('should handle missing data', async () => {
      const mockResponse: DockerStatusResponse = {
        success: true,
      };

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => mockResponse,
      } as Response);

      const result = await getDockerStatusMessage();

      expect(result).toBe('No Docker information available');
    });

    it('should handle fetch error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await getDockerStatusMessage();

      expect(result).toBe('Unable to check Docker status');
    });
  });
});
