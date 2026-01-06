/**
 * Integration Tests for VM Providers
 * Tests VM creation and management with mocked provider APIs
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProviderFactory } from '@/lib/vm/provider-factory';
import { VfkitProvider } from '@/lib/vm/providers/vfkit';
import { LimaProvider } from '@/lib/vm/providers/lima';
import { DockerProvider } from '@/lib/vm/providers/docker';
import { VMProvider, VMConfig } from '@/lib/vm/types';
import * as child_process from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('os');

const mockExec = child_process.exec as jest.MockedFunction<typeof child_process.exec>;
const mockSpawn = child_process.spawn as jest.MockedFunction<typeof child_process.spawn>;
const mockFsAccess = fs.access as jest.MockedFunction<typeof fs.access>;
const mockFsReaddir = fs.readdir as jest.MockedFunction<typeof fs.readdir>;
const mockFsReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockFsWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
const mockFsMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
const mockFsRm = fs.rm as jest.MockedFunction<typeof fs.rm>;
const mockFsUnlink = fs.unlink as jest.MockedFunction<typeof fs.unlink>;
const mockOsPlatform = os.platform as jest.MockedFunction<typeof os.platform>;
const mockOsArch = os.arch as jest.MockedFunction<typeof os.arch>;
const mockOsHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;

describe('VM Provider Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default OS mocks
    mockOsPlatform.mockReturnValue('darwin');
    mockOsArch.mockReturnValue('arm64');
    mockOsHomedir.mockReturnValue('/Users/test');
  });

  describe('Provider Detection', () => {
    it('should detect system information', async () => {
      // Mock command checks
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else if (cmd.includes('which limactl')) {
          callback(null, { stdout: '/usr/local/bin/limactl', stderr: '' });
        } else {
          callback(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const sysInfo = await ProviderFactory.getSystemInfo();

      expect(sysInfo).toHaveProperty('os');
      expect(sysInfo).toHaveProperty('arch');
      expect(sysInfo).toHaveProperty('availableProviders');
      expect(sysInfo).toHaveProperty('recommendedProvider');

      expect(sysInfo.os).toBe('darwin');
      expect(sysInfo.arch).toBe('arm64');
      expect(sysInfo.isAppleSilicon).toBe(true);
    });

    it('should detect at least one provider', async () => {
      // Mock vfkit available
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const sysInfo = await ProviderFactory.getSystemInfo();
      expect(sysInfo.availableProviders.length).toBeGreaterThan(0);
      expect(sysInfo.availableProviders).toContain('vfkit');
    });

    it('should recommend vfkit on Apple Silicon', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const sysInfo = await ProviderFactory.getSystemInfo();
      expect(sysInfo.recommendedProvider).toBe('vfkit');
    });

    it('should recommend lima when vfkit not available', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which limactl')) {
          callback(null, { stdout: '/usr/local/bin/limactl', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const sysInfo = await ProviderFactory.getSystemInfo();
      expect(sysInfo.recommendedProvider).toBe('lima');
    });
  });

  describe('vfkit Provider', () => {
    let provider: VfkitProvider;

    beforeEach(() => {
      provider = new VfkitProvider();

      // Mock filesystem operations
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      mockFsReadFile.mockResolvedValue('');
      mockFsAccess.mockResolvedValue(undefined);
    });

    it('should detect vfkit availability', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        }
      }) as any);

      const canDetect = await provider.detect();
      expect(canDetect).toBe(true);
    });

    it('should list existing vfkit VMs', async () => {
      // Mock VM directory structure
      mockFsReaddir.mockResolvedValue([
        { name: 'test-vm-1', isDirectory: () => true } as any,
        { name: 'test-vm-2', isDirectory: () => true } as any,
      ]);

      const vmConfig = {
        name: 'test-vm-1',
        cpus: 2,
        memory: '2GB',
        ports: [{ guest: 22, host: 2222 }],
      };

      mockFsReadFile.mockResolvedValue(JSON.stringify(vmConfig));

      const vms = await provider.list();

      expect(vms.length).toBe(2);
      vms.forEach(vm => {
        expect(vm).toHaveProperty('id');
        expect(vm).toHaveProperty('name');
        expect(vm).toHaveProperty('provider', 'vfkit');
        expect(vm).toHaveProperty('status');
      });
    });

    it('should create a VM with proper configuration', async () => {
      const config: VMConfig = {
        name: 'test-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock kernel already exists
      mockFsAccess.mockResolvedValue(undefined);

      // Mock spawn for vfkit process
      const mockProc = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      const vm = await provider.create(config);

      expect(vm.name).toBe('test-vm');
      expect(vm.provider).toBe('vfkit');
      expect(vm.status).toBe('running');
      expect(mockSpawn).toHaveBeenCalledWith('vfkit', expect.arrayContaining([
        '--cpus', '2',
        '--memory', expect.any(String),
      ]), expect.any(Object));
    });

    it('should start an existing VM', async () => {
      const vmConfig = {
        name: 'test-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      mockFsReadFile.mockResolvedValue(JSON.stringify(vmConfig));
      mockFsAccess.mockResolvedValue(undefined);

      const mockProc = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      await provider.start('test-vm');

      expect(mockSpawn).toHaveBeenCalledWith('vfkit', expect.any(Array), expect.any(Object));
    });

    it('should stop a running VM', async () => {
      mockFsReadFile.mockResolvedValue('12345');

      // Mock process.kill
      const originalKill = process.kill;
      const mockKill = jest.fn();
      process.kill = mockKill;

      await provider.stop('test-vm');

      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(mockFsUnlink).toHaveBeenCalled();

      // Restore
      process.kill = originalKill;
    });

    it('should destroy a VM and its resources', async () => {
      mockFsReadFile.mockResolvedValue('12345');

      // Mock process.kill
      const originalKill = process.kill;
      const mockKill = jest.fn();
      process.kill = mockKill;

      await provider.destroy('test-vm');

      expect(mockFsRm).toHaveBeenCalledWith(
        expect.stringContaining('test-vm'),
        { recursive: true, force: true }
      );

      // Restore
      process.kill = originalKill;
    });

    it('should execute commands in VM', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        callback(null, { stdout: 'Hello from VM', stderr: '' });
      }) as any);

      const result = await provider.exec('test-vm', 'echo "Hello from VM"');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello from VM');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should get VM status', async () => {
      mockFsReadFile.mockResolvedValue('12345');

      // Mock process is running
      const originalKill = process.kill;
      const mockKill = jest.fn();
      process.kill = mockKill;

      const status = await provider.status('test-vm');

      expect(status).toBe('running');

      // Restore
      process.kill = originalKill;
    });
  });

  describe('Lima Provider', () => {
    let provider: LimaProvider;

    beforeEach(() => {
      provider = new LimaProvider();
      mockFsWriteFile.mockResolvedValue(undefined);
    });

    it('should detect Lima availability', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which limactl')) {
          callback(null, { stdout: '/usr/local/bin/limactl', stderr: '' });
        }
      }) as any);

      const canDetect = await provider.detect();
      expect(canDetect).toBe(true);
    });

    it('should list existing Lima VMs', async () => {
      const limaVMs = [
        { name: 'default', status: 'Running', created: '2024-01-01T00:00:00Z' },
        { name: 'test-vm', status: 'Stopped', created: '2024-01-02T00:00:00Z' },
      ];

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('limactl list --json')) {
          callback(null, { stdout: JSON.stringify(limaVMs), stderr: '' });
        }
      }) as any);

      const vms = await provider.list();

      expect(vms.length).toBe(2);
      expect(vms[0].name).toBe('default');
      expect(vms[0].status).toBe('running');
      expect(vms[1].name).toBe('test-vm');
      expect(vms[1].status).toBe('stopped');
    });

    it('should handle empty VM list', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('limactl list --json')) {
          callback(null, { stdout: '', stderr: '' });
        }
      }) as any);

      const vms = await provider.list();
      expect(vms).toEqual([]);
    });

    it('should create a Lima VM', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        callback(null, { stdout: 'Created VM successfully', stderr: '' });
      }) as any);

      const config: VMConfig = {
        name: 'test-lima',
        cpus: 4,
        memory: '4GB',
        disk: '20GB',
        image: 'alpine-3.22',
        ports: [{ guest: 22, host: 2222 }],
      };

      const vm = await provider.create(config);

      expect(vm.name).toBe('test-lima');
      expect(vm.provider).toBe('lima');
      expect(vm.status).toBe('running');
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('limactl create'),
        expect.any(Function)
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('limactl start'),
        expect.any(Function)
      );
    });

    it('should start a Lima VM', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        callback(null, { stdout: 'Started', stderr: '' });
      }) as any);

      await provider.start('test-vm');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('limactl start test-vm'),
        expect.any(Function)
      );
    });

    it('should stop a Lima VM', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        callback(null, { stdout: 'Stopped', stderr: '' });
      }) as any);

      await provider.stop('test-vm');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('limactl stop test-vm'),
        expect.any(Function)
      );
    });

    it('should destroy a Lima VM', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        callback(null, { stdout: 'Deleted', stderr: '' });
      }) as any);

      await provider.destroy('test-vm');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('limactl delete test-vm'),
        expect.any(Function)
      );
    });

    it('should execute commands in Lima VM', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('limactl shell')) {
          callback(null, { stdout: 'Command output', stderr: '' });
        }
      }) as any);

      const result = await provider.exec('test-vm', 'ls -la');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Command output');
    });

    it('should get Lima VM status', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('limactl list') && cmd.includes('--json')) {
          const vmData = [{ name: 'test-vm', status: 'Running' }];
          callback(null, { stdout: JSON.stringify(vmData), stderr: '' });
        }
      }) as any);

      const status = await provider.status('test-vm');
      expect(status).toBe('running');
    });
  });

  describe('Docker Provider', () => {
    let provider: DockerProvider;

    beforeEach(() => {
      provider = new DockerProvider();
    });

    it('should detect Docker availability', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker --version')) {
          callback(null, { stdout: 'Docker version 24.0.0', stderr: '' });
        }
      }) as any);

      const canDetect = await provider.detect();
      expect(canDetect).toBe(true);
    });

    it('should list Docker containers', async () => {
      const dockerOutput = [
        'abc123|test-container-1|Up 2 hours|0.0.0.0:8080->80/tcp',
        'def456|test-container-2|Exited (0) 1 hour ago|',
      ].join('\n');

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker ps -a')) {
          callback(null, { stdout: dockerOutput, stderr: '' });
        }
      }) as any);

      const containers = await provider.list();

      expect(containers.length).toBe(2);
      expect(containers[0].name).toBe('test-container-1');
      expect(containers[0].status).toBe('running');
      expect(containers[1].name).toBe('test-container-2');
      expect(containers[1].status).toBe('stopped');
    });

    it('should create a Docker container', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker run')) {
          callback(null, { stdout: 'abc123def456', stderr: '' });
        }
      }) as any);

      const config: VMConfig = {
        name: 'test-docker',
        cpus: 2,
        memory: '1GB',
        disk: '5GB',
        image: 'alpine-3.22',
        ports: [{ guest: 80, host: 8080 }],
        env: { NODE_ENV: 'production' },
      };

      const container = await provider.create(config);

      expect(container.name).toBe('test-docker');
      expect(container.provider).toBe('docker');
      expect(container.status).toBe('running');
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('docker run'),
        expect.any(Function)
      );
    });

    it('should start a Docker container', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        callback(null, { stdout: 'test-container', stderr: '' });
      }) as any);

      await provider.start('test-container');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('docker start test-container'),
        expect.any(Function)
      );
    });

    it('should stop a Docker container', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        callback(null, { stdout: 'test-container', stderr: '' });
      }) as any);

      await provider.stop('test-container');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('docker stop test-container'),
        expect.any(Function)
      );
    });

    it('should destroy a Docker container', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        callback(null, { stdout: 'test-container', stderr: '' });
      }) as any);

      await provider.destroy('test-container');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('docker rm test-container'),
        expect.any(Function)
      );
    });

    it('should execute commands in Docker container', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker exec')) {
          callback(null, { stdout: 'Hello from Docker', stderr: '' });
        }
      }) as any);

      const result = await provider.exec('test-container', 'echo "Hello from Docker"');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello from Docker');
    });

    it('should get Docker container status', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker inspect')) {
          callback(null, { stdout: 'running', stderr: '' });
        }
      }) as any);

      const status = await provider.status('test-container');
      expect(status).toBe('running');
    });

    it('should work with remote Docker host', async () => {
      const remoteProvider = new DockerProvider({ remoteHost: 'user@remote.host' });

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('ssh user@remote.host')) {
          callback(null, { stdout: 'Docker version 24.0.0', stderr: '' });
        }
      }) as any);

      const canDetect = await remoteProvider.detect();
      expect(canDetect).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('ssh user@remote.host'),
        expect.any(Function)
      );
    });
  });

  describe('VM Provider Factory', () => {
    it('should auto-detect best provider for macOS Apple Silicon', async () => {
      mockOsPlatform.mockReturnValue('darwin');
      mockOsArch.mockReturnValue('arm64');
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const provider = await ProviderFactory.detectProvider();
      expect(provider.name).toBe('vfkit');
    });

    it('should fall back to Lima when vfkit unavailable', async () => {
      mockOsPlatform.mockReturnValue('darwin');
      mockOsArch.mockReturnValue('arm64');
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which limactl')) {
          callback(null, { stdout: '/usr/local/bin/limactl', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const provider = await ProviderFactory.detectProvider();
      expect(provider.name).toBe('lima');
    });

    it('should get specific provider by name', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        callback(null, { stdout: '/usr/local/bin/limactl', stderr: '' });
      }) as any);

      const provider = await ProviderFactory.getProvider('lima');
      expect(provider.name).toBe('lima');
    });

    it('should throw error for unknown provider', async () => {
      await expect(ProviderFactory.getProvider('unknown-provider')).rejects.toThrow(
        'Unknown provider: unknown-provider'
      );
    });
  });

  describe('VM Lifecycle Management', () => {
    let provider: DockerProvider;

    beforeEach(() => {
      provider = new DockerProvider();
    });

    it('should complete full VM lifecycle', async () => {
      let containerState = 'not-created';

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker run')) {
          containerState = 'running';
          callback(null, { stdout: 'abc123', stderr: '' });
        } else if (cmd.includes('docker stop')) {
          containerState = 'stopped';
          callback(null, { stdout: 'test-vm', stderr: '' });
        } else if (cmd.includes('docker start')) {
          containerState = 'running';
          callback(null, { stdout: 'test-vm', stderr: '' });
        } else if (cmd.includes('docker rm')) {
          containerState = 'destroyed';
          callback(null, { stdout: 'test-vm', stderr: '' });
        } else if (cmd.includes('docker inspect')) {
          callback(null, { stdout: containerState === 'running' ? 'running' : 'exited', stderr: '' });
        }
      }) as any);

      const config: VMConfig = {
        name: 'lifecycle-test',
        cpus: 1,
        memory: '512MB',
        disk: '1GB',
        image: 'alpine-3.22',
      };

      // Create
      const vm = await provider.create(config);
      expect(vm.status).toBe('running');

      // Stop
      await provider.stop(vm.id);
      const stoppedStatus = await provider.status(vm.id);
      expect(stoppedStatus).toBe('stopped');

      // Restart
      await provider.start(vm.id);
      const runningStatus = await provider.status(vm.id);
      expect(runningStatus).toBe('running');

      // Destroy
      await provider.destroy(vm.id);
      expect(containerState).toBe('destroyed');
    });
  });
});
