/**
 * Unit tests for Docker Container Runtime
 */

import { DockerRuntime } from '@/lib/container/runtimes/docker-runtime';
import { exec } from 'child_process';
import { promisify } from 'util';

jest.mock('child_process');

const mockExec = promisify(exec) as jest.MockedFunction<typeof promisify>;

describe('DockerRuntime', () => {
  let runtime: DockerRuntime;

  beforeEach(() => {
    jest.clearAllMocks();
    runtime = new DockerRuntime();
  });

  describe('isAvailable', () => {
    it('should return true when Docker is available', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, { stdout: 'Docker version 24.0.0', stderr: '' });
      });

      const result = await runtime.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when Docker is not available', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('Command not found'), { stdout: '', stderr: '' });
      });

      const result = await runtime.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return status when Docker is running', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        if (cmd.includes('--version')) {
          callback(null, { stdout: 'Docker version 24.0.0, build abc123', stderr: '' });
        } else if (cmd.includes('info')) {
          callback(null, {
            stdout: JSON.stringify({
              ServerVersion: '24.0.0',
              Containers: 5,
              Images: 10,
              Driver: 'overlay2',
            }),
            stderr: '',
          });
        }
      });

      const status = await runtime.getStatus();
      
      expect(status.available).toBe(true);
      expect(status.running).toBe(true);
      expect(status.version).toBe('24.0.0');
    });

    it('should return error when Docker daemon is not running', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('Cannot connect to Docker daemon'), { stdout: '', stderr: '' });
      });

      const status = await runtime.getStatus();
      
      expect(status.available).toBe(false);
      expect(status.running).toBe(false);
      expect(status.error).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start a container successfully', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, { stdout: 'abc123def456', stderr: '' });
      });

      const result = await runtime.start('nginx:latest', {
        name: 'test-nginx',
        ports: { 8080: 80 },
        env: { NODE_ENV: 'production' },
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('abc123def456');
      expect(result.name).toBe('test-nginx');
    });

    it('should handle container start failure', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('Failed to start container'), { stdout: '', stderr: '' });
      });

      const result = await runtime.start('nginx:latest');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop a container successfully', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, { stdout: 'abc123', stderr: '' });
      });

      const result = await runtime.stop('abc123');

      expect(result.success).toBe(true);
    });

    it('should handle stop failure', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('Container not found'), { stdout: '', stderr: '' });
      });

      const result = await runtime.stop('abc123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('list', () => {
    it('should list all containers', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        const containers = [
          {
            ID: 'abc123',
            Names: 'nginx',
            Image: 'nginx:latest',
            State: 'running',
            CreatedAt: '2024-01-01T00:00:00Z',
            Ports: '0.0.0.0:8080->80/tcp',
          },
        ];
        
        callback(null, {
          stdout: containers.map(c => JSON.stringify(c)).join('\n'),
          stderr: '',
        });
      });

      const result = await runtime.list();

      expect(result.success).toBe(true);
      expect(result.containers).toHaveLength(1);
      expect(result.containers[0].id).toBe('abc123');
      expect(result.containers[0].name).toBe('nginx');
    });
  });

  describe('exec', () => {
    it('should execute command in container', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(null, { stdout: 'Hello World', stderr: '' });
      });

      const result = await runtime.exec('abc123', ['echo', 'Hello World']);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello World');
    });

    it('should handle exec failure', async () => {
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        const error: any = new Error('Command failed');
        error.code = 127;
        error.stdout = '';
        error.stderr = 'command not found';
        callback(error);
      });

      const result = await runtime.exec('abc123', ['invalid-command']);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(127);
    });
  });
});
