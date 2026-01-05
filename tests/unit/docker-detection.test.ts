/**
 * Docker Detection Service Tests
 */

import { exec } from 'child_process';
import { existsSync } from 'fs';
import {
  detectDockerRuntime,
  isDockerInstalled,
  getDockerDaemonStatus,
  listDockerContexts,
  startColima,
  DockerType,
} from '@/lib/docker/detection';

// Mock Node.js modules
jest.mock('child_process');
jest.mock('fs');

const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('Docker Detection Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectDockerRuntime', () => {
    it('should detect Docker Desktop when running', async () => {
      mockExistsSync.mockReturnValue(true);

      // Mock docker version command
      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('docker version')) {
          callback(null, { stdout: '24.0.7', stderr: '' });
        } else if (cmd.includes('docker context show')) {
          callback(null, { stdout: 'default', stderr: '' });
        }
        return {} as any;
      });

      const status = await detectDockerRuntime();

      expect(status.dockerType).toBe(DockerType.DockerDesktop);
      expect(status.running).toBe(true);
      expect(status.version).toBe('24.0.7');
    });

    it('should detect Colima when running', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.includes('.colima');
      });

      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('docker version')) {
          callback(null, { stdout: '24.0.7', stderr: '' });
        } else if (cmd.includes('docker context show')) {
          callback(null, { stdout: 'colima', stderr: '' });
        }
        return {} as any;
      });

      const status = await detectDockerRuntime();

      expect(status.dockerType).toBe(DockerType.Colima);
      expect(status.running).toBe(true);
      expect(status.contextName).toBe('colima');
    });

    it('should detect Podman when running', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        // Only return true for Podman socket, not Docker/Colima sockets
        return path.includes('podman');
      });

      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('podman version')) {
          callback(null, { stdout: '4.9.0', stderr: '' });
        } else if (cmd.includes('docker')) {
          // Docker commands fail
          callback(new Error('not found'), { stdout: '', stderr: 'not found' });
        }
        return {} as any;
      });

      const status = await detectDockerRuntime();

      expect(status.dockerType).toBe(DockerType.Podman);
      expect(status.running).toBe(true);
      expect(status.version).toBe('4.9.0');
    });

    it('should return NotInstalled when no runtime is available', async () => {
      mockExistsSync.mockReturnValue(false);

      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('Command not found'), { stdout: '', stderr: 'not found' });
        return {} as any;
      });

      const status = await detectDockerRuntime();

      expect(status.dockerType).toBe(DockerType.NotInstalled);
      expect(status.running).toBe(false);
    });

    it('should handle socket file not existing', async () => {
      mockExistsSync.mockReturnValue(false);

      const status = await detectDockerRuntime();

      expect(status.running).toBe(false);
    });
  });

  describe('isDockerInstalled', () => {
    it('should return true when docker is installed', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('which docker')) {
          callback(null, { stdout: '/usr/local/bin/docker', stderr: '' });
        }
        return {} as any;
      });

      const installed = await isDockerInstalled();

      expect(installed).toBe(true);
    });

    it('should return true when colima is installed', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('which docker')) {
          callback(new Error('not found'), { stdout: '', stderr: 'not found' });
        } else if (cmd.includes('which colima')) {
          callback(null, { stdout: '/usr/local/bin/colima', stderr: '' });
        }
        return {} as any;
      });

      const installed = await isDockerInstalled();

      expect(installed).toBe(true);
    });

    it('should return false when nothing is installed', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('not found'), { stdout: '', stderr: 'not found' });
        return {} as any;
      });

      const installed = await isDockerInstalled();

      expect(installed).toBe(false);
    });
  });

  describe('getDockerDaemonStatus', () => {
    it('should return accessible when daemon is running', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('docker info')) {
          callback(null, { stdout: 'Server Version: 24.0.7', stderr: '' });
        }
        return {} as any;
      });

      const status = await getDockerDaemonStatus();

      expect(status.accessible).toBe(true);
      expect(status.error).toBeUndefined();
    });

    it('should return error when daemon is not accessible', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('docker info')) {
          callback(new Error('Cannot connect to Docker daemon'), {
            stdout: '',
            stderr: 'Cannot connect to Docker daemon',
          });
        }
        return {} as any;
      });

      const status = await getDockerDaemonStatus();

      expect(status.accessible).toBe(false);
      expect(status.error).toBeDefined();
    });
  });

  describe('listDockerContexts', () => {
    it('should parse docker context list correctly', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('docker context ls')) {
          const output = 'default|true|unix:///var/run/docker.sock\ncolima|false|unix:///Users/user/.colima/default/docker.sock';
          callback(null, { stdout: output, stderr: '' });
        }
        return {} as any;
      });

      const contexts = await listDockerContexts();

      expect(contexts).toHaveLength(2);
      expect(contexts[0]).toEqual({
        name: 'default',
        current: true,
        dockerEndpoint: 'unix:///var/run/docker.sock',
      });
      expect(contexts[1]).toEqual({
        name: 'colima',
        current: false,
        dockerEndpoint: 'unix:///Users/user/.colima/default/docker.sock',
      });
    });

    it('should return empty array on error', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('docker not found'), { stdout: '', stderr: 'not found' });
        return {} as any;
      });

      const contexts = await listDockerContexts();

      expect(contexts).toEqual([]);
    });
  });

  describe('startColima', () => {
    it('should start Colima successfully', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('which colima')) {
          callback(null, { stdout: '/usr/local/bin/colima', stderr: '' });
        } else if (cmd.includes('colima start')) {
          callback(null, { stdout: 'INFO[0000] starting colima', stderr: '' });
        }
        return {} as any;
      });

      const result = await startColima();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Colima started successfully');
    });

    it('should fail when Colima is not installed', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('colima: command not found'), { stdout: '', stderr: 'not found' });
        return {} as any;
      });

      const result = await startColima();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should handle start failure', async () => {
      mockExec.mockImplementation((cmd, callback: any) => {
        if (cmd.includes('which colima')) {
          callback(null, { stdout: '/usr/local/bin/colima', stderr: '' });
        } else if (cmd.includes('colima start')) {
          callback(new Error('failed to start'), { stdout: '', stderr: 'error starting' });
        }
        return {} as any;
      });

      const result = await startColima();

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed to start');
    });
  });
});
