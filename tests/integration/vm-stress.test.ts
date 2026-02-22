/**
 * VM Lifecycle Stress Tests
 * Tests VM creation, management, and cleanup under load conditions
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProviderFactory } from '@/lib/vm/provider-factory';
import { VfkitProvider } from '@/lib/vm/providers/vfkit';
import { LimaProvider } from '@/lib/vm/providers/lima';
import { DockerProvider } from '@/lib/vm/providers/docker';
import { VMProvider, VMConfig, VM } from '@/lib/vm/types';
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

describe('VM Lifecycle Stress Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default OS mocks
    mockOsPlatform.mockReturnValue('darwin');
    mockOsArch.mockReturnValue('arm64');
    mockOsHomedir.mockReturnValue('/Users/test');
  });

  describe('Rapid VM Creation and Destruction', () => {
    let provider: DockerProvider;

    beforeEach(() => {
      provider = new DockerProvider();
    });

    it('should handle rapid sequential VM creation', async () => {
      const vmCount = 10;
      const createdVMs: VM[] = [];

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker run')) {
          const vmId = `container-${createdVMs.length}`;
          callback(null, { stdout: vmId, stderr: '' });
        }
      }) as any);

      for (let i = 0; i < vmCount; i++) {
        const config: VMConfig = {
          name: `stress-vm-${i}`,
          cpus: 1,
          memory: '512MB',
          disk: '1GB',
          image: 'alpine-3.22',
        };

        const vm = await provider.create(config);
        createdVMs.push(vm);
        expect(vm.status).toBe('running');
      }

      expect(createdVMs.length).toBe(vmCount);
      expect(mockExec).toHaveBeenCalledTimes(vmCount);
    });

    it('should handle rapid sequential VM destruction', async () => {
      const vmCount = 10;
      const vmIds = Array.from({ length: vmCount }, (_, i) => `stress-vm-${i}`);

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker rm')) {
          callback(null, { stdout: 'removed', stderr: '' });
        }
      }) as any);

      for (const vmId of vmIds) {
        await provider.destroy(vmId);
      }

      expect(mockExec).toHaveBeenCalledTimes(vmCount);
    });

    it('should handle create-destroy cycles', async () => {
      const cycles = 5;

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker run')) {
          callback(null, { stdout: 'container-id', stderr: '' });
        } else if (cmd.includes('docker rm')) {
          callback(null, { stdout: 'removed', stderr: '' });
        }
      }) as any);

      for (let i = 0; i < cycles; i++) {
        const config: VMConfig = {
          name: `cycle-vm-${i}`,
          cpus: 1,
          memory: '512MB',
          disk: '1GB',
          image: 'alpine-3.22',
        };

        const vm = await provider.create(config);
        expect(vm.status).toBe('running');

        await provider.destroy(vm.id);
      }

      expect(mockExec).toHaveBeenCalledTimes(cycles * 2);
    });
  });

  describe('Concurrent VM Operations', () => {
    let provider: DockerProvider;

    beforeEach(() => {
      provider = new DockerProvider();
    });

    it('should handle concurrent VM creation', async () => {
      const vmCount = 5;
      let createCounter = 0;

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker run')) {
          const vmId = `concurrent-${createCounter++}`;
          callback(null, { stdout: vmId, stderr: '' });
        }
      }) as any);

      const configs: VMConfig[] = Array.from({ length: vmCount }, (_, i) => ({
        name: `concurrent-vm-${i}`,
        cpus: 1,
        memory: '512MB',
        disk: '1GB',
        image: 'alpine-3.22',
      }));

      const promises = configs.map(config => provider.create(config));
      const vms = await Promise.all(promises);

      expect(vms.length).toBe(vmCount);
      vms.forEach(vm => {
        expect(vm.status).toBe('running');
      });
    });

    it('should handle concurrent VM destruction', async () => {
      const vmCount = 5;
      const vmIds = Array.from({ length: vmCount }, (_, i) => `vm-${i}`);

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker rm')) {
          callback(null, { stdout: 'removed', stderr: '' });
        }
      }) as any);

      const promises = vmIds.map(id => provider.destroy(id));
      await Promise.all(promises);

      expect(mockExec).toHaveBeenCalledTimes(vmCount);
    });

    it('should handle mixed concurrent operations', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker run')) {
          callback(null, { stdout: 'new-vm-id', stderr: '' });
        } else if (cmd.includes('docker stop')) {
          callback(null, { stdout: 'stopped', stderr: '' });
        } else if (cmd.includes('docker start')) {
          callback(null, { stdout: 'started', stderr: '' });
        } else if (cmd.includes('docker rm')) {
          callback(null, { stdout: 'removed', stderr: '' });
        } else if (cmd.includes('docker inspect')) {
          callback(null, { stdout: 'running', stderr: '' });
        }
      }) as any);

      const config: VMConfig = {
        name: 'mixed-test-vm',
        cpus: 1,
        memory: '512MB',
        disk: '1GB',
        image: 'alpine-3.22',
      };

      const operations = [
        provider.create(config),
        provider.start('existing-vm-1'),
        provider.stop('existing-vm-2'),
        provider.status('existing-vm-3'),
        provider.destroy('old-vm'),
      ];

      await Promise.all(operations);
      expect(mockExec).toHaveBeenCalled();
    });
  });

  describe('Resource Limits and Recovery', () => {
    let provider: DockerProvider;

    beforeEach(() => {
      provider = new DockerProvider();
    });

    it('should handle VM creation failures gracefully', async () => {
      let attemptCount = 0;

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker run')) {
          attemptCount++;
          if (attemptCount <= 3) {
            callback(new Error('Resource limit exceeded'), { stdout: '', stderr: 'Error: insufficient memory' });
          } else {
            callback(null, { stdout: 'success-vm-id', stderr: '' });
          }
        }
      }) as any);

      const config: VMConfig = {
        name: 'recovery-test',
        cpus: 1,
        memory: '512MB',
        disk: '1GB',
        image: 'alpine-3.22',
      };

      let lastError: Error | null = null;
      for (let i = 0; i < 5; i++) {
        try {
          await provider.create(config);
          break;
        } catch (error) {
          lastError = error as Error;
        }
      }

      expect(attemptCount).toBeGreaterThan(3);
    });

    it('should handle partial failure in batch operations', async () => {
      let createCount = 0;

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker run')) {
          createCount++;
          if (createCount === 3) {
            callback(new Error('Failed to create VM'), { stdout: '', stderr: 'Error' });
          } else {
            callback(null, { stdout: `vm-${createCount}`, stderr: '' });
          }
        }
      }) as any);

      const configs: VMConfig[] = Array.from({ length: 5 }, (_, i) => ({
        name: `batch-vm-${i}`,
        cpus: 1,
        memory: '512MB',
        disk: '1GB',
        image: 'alpine-3.22',
      }));

      const results = await Promise.allSettled(
        configs.map(config => provider.create(config))
      );

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(4);
      expect(failed.length).toBe(1);
    });
  });

  describe('State Management Under Load', () => {
    let provider: DockerProvider;

    beforeEach(() => {
      provider = new DockerProvider();
    });

    it('should maintain correct VM states during rapid transitions', async () => {
      let vmState = 'stopped';

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker run')) {
          vmState = 'running';
          callback(null, { stdout: 'test-vm-id', stderr: '' });
        } else if (cmd.includes('docker stop')) {
          vmState = 'stopped';
          callback(null, { stdout: 'stopped', stderr: '' });
        } else if (cmd.includes('docker start')) {
          vmState = 'running';
          callback(null, { stdout: 'started', stderr: '' });
        } else if (cmd.includes('docker inspect')) {
          callback(null, { stdout: vmState === 'running' ? 'running' : 'exited', stderr: '' });
        }
      }) as any);

      const config: VMConfig = {
        name: 'state-test-vm',
        cpus: 1,
        memory: '512MB',
        disk: '1GB',
        image: 'alpine-3.22',
      };

      const vm = await provider.create(config);
      expect(vm.status).toBe('running');

      for (let i = 0; i < 5; i++) {
        await provider.stop(vm.id);
        const stoppedStatus = await provider.status(vm.id);
        expect(stoppedStatus).toBe('stopped');

        await provider.start(vm.id);
        const runningStatus = await provider.status(vm.id);
        expect(runningStatus).toBe('running');
      }
    });

    it('should handle concurrent status checks', async () => {
      const vmIds = ['vm-1', 'vm-2', 'vm-3', 'vm-4', 'vm-5'];

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker inspect')) {
          callback(null, { stdout: 'running', stderr: '' });
        }
      }) as any);

      const statusChecks = vmIds.map(id => provider.status(id));
      const statuses = await Promise.all(statusChecks);

      expect(statuses.length).toBe(vmIds.length);
      statuses.forEach(status => {
        expect(status).toBe('running');
      });
    });
  });

  describe('vfkit Provider Stress Tests', () => {
    let provider: VfkitProvider;

    beforeEach(() => {
      provider = new VfkitProvider();

      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);
      mockFsReadFile.mockResolvedValue('');
      mockFsAccess.mockResolvedValue(undefined);
      mockFsRm.mockResolvedValue(undefined);
    });

    it('should handle multiple vfkit VM creations', async () => {
      const vmCount = 3;
      const vms: VM[] = [];

      const mockProc = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      for (let i = 0; i < vmCount; i++) {
        const config: VMConfig = {
          name: `vfkit-stress-${i}`,
          cpus: 2,
          memory: '2GB',
          disk: '10GB',
          image: 'alpine-3.22',
        };

        const vm = await provider.create(config);
        vms.push(vm);
        expect(vm.provider).toBe('vfkit');
        expect(vm.status).toBe('running');
      }

      expect(vms.length).toBe(vmCount);
      expect(mockSpawn).toHaveBeenCalledTimes(vmCount);
    });

    it('should handle rapid vfkit VM cleanup', async () => {
      const vmCount = 3;
      const vmIds = Array.from({ length: vmCount }, (_, i) => `vfkit-vm-${i}`);

      mockFsReadFile.mockResolvedValue('12345');

      const originalKill = process.kill;
      const mockKill = jest.fn();
      process.kill = mockKill;

      for (const vmId of vmIds) {
        await provider.destroy(vmId);
      }

      expect(mockFsRm).toHaveBeenCalledTimes(vmCount);

      process.kill = originalKill;
    });
  });

  describe('Lima Provider Stress Tests', () => {
    let provider: LimaProvider;

    beforeEach(() => {
      provider = new LimaProvider();
      mockFsWriteFile.mockResolvedValue(undefined);
    });

    it('should handle multiple lima VM operations', async () => {
      let createCount = 0;

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('limactl create')) {
          callback(null, { stdout: 'Created', stderr: '' });
        } else if (cmd.includes('limactl start')) {
          createCount++;
          callback(null, { stdout: 'Started', stderr: '' });
        } else if (cmd.includes('limactl delete')) {
          callback(null, { stdout: 'Deleted', stderr: '' });
        }
      }) as any);

      const configs: VMConfig[] = Array.from({ length: 3 }, (_, i) => ({
        name: `lima-stress-${i}`,
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      }));

      const vms = await Promise.all(
        configs.map(config => provider.create(config))
      );

      expect(vms.length).toBe(3);
      expect(createCount).toBe(3);

      await Promise.all(
        vms.map(vm => provider.destroy(vm.id))
      );
    });

    it('should handle concurrent lima operations', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('limactl start')) {
          callback(null, { stdout: 'Started', stderr: '' });
        } else if (cmd.includes('limactl stop')) {
          callback(null, { stdout: 'Stopped', stderr: '' });
        } else if (cmd.includes('limactl list') && cmd.includes('--json')) {
          callback(null, { stdout: JSON.stringify([{ name: 'test', status: 'Running' }]), stderr: '' });
        }
      }) as any);

      const operations = [
        provider.start('vm-1'),
        provider.stop('vm-2'),
        provider.status('vm-3'),
      ];

      await Promise.all(operations);
      expect(mockExec).toHaveBeenCalled();
    });
  });

  describe('Provider Factory Under Load', () => {
    it('should handle concurrent provider detection', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else if (cmd.includes('which limactl')) {
          callback(null, { stdout: '/usr/local/bin/limactl', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const detections = Array.from({ length: 5 }, () =>
        ProviderFactory.getSystemInfo()
      );

      const results = await Promise.all(detections);

      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result).toHaveProperty('os');
        expect(result).toHaveProperty('arch');
        expect(result).toHaveProperty('availableProviders');
      });
    });
  });

  describe('Memory and Resource Management', () => {
    let provider: DockerProvider;

    beforeEach(() => {
      provider = new DockerProvider();
    });

    it('should handle large VM configuration', async () => {
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker run')) {
          callback(null, { stdout: 'large-vm-id', stderr: '' });
        }
      }) as any);

      const config: VMConfig = {
        name: 'large-vm',
        cpus: 8,
        memory: '16GB',
        disk: '100GB',
        image: 'ubuntu-24.04',
        ports: Array.from({ length: 10 }, (_, i) => ({
          guest: 8000 + i,
          host: 9000 + i,
        })),
        env: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`VAR_${i}`, `value_${i}`])
        ),
      };

      const vm = await provider.create(config);
      expect(vm.status).toBe('running');
      expect(mockExec).toHaveBeenCalled();
    });

    it('should handle VM listing with many VMs', async () => {
      const vmCount = 50;
      const dockerOutput = Array.from({ length: vmCount }, (_, i) =>
        `vm-${i}|test-vm-${i}|Up ${i} hours|`
      ).join('\n');

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('docker ps -a')) {
          callback(null, { stdout: dockerOutput, stderr: '' });
        }
      }) as any);

      const vms = await provider.list();

      expect(vms.length).toBe(vmCount);
      vms.forEach((vm, index) => {
        expect(vm.name).toBe(`test-vm-${index}`);
      });
    });
  });
});
