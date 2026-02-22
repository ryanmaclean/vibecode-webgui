/**
 * Integration Tests for VM State Persistence Across Restarts
 * Tests that VMs maintain state correctly when the provider is re-initialized
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { VfkitProvider } from '@/lib/vm/providers/vfkit';
import { VMConfig } from '@/lib/vm/types';
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

describe('VM State Persistence Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default OS mocks for macOS
    mockOsPlatform.mockReturnValue('darwin');
    mockOsArch.mockReturnValue('arm64');
    mockOsHomedir.mockReturnValue('/Users/test');

    // Mock vfkit available
    mockExec.mockImplementation(((cmd: string, callback: any) => {
      if (cmd.includes('which vfkit')) {
        callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
      } else if (cmd.includes('sw_vers')) {
        callback(null, { stdout: '14.0.0', stderr: '' });
      } else if (cmd.includes('df -k')) {
        callback(null, { stdout: '104857600', stderr: '' }); // 100GB available
      } else {
        callback(new Error('Command not found'), { stdout: '', stderr: '' });
      }
    }) as any);

    // Default filesystem mocks
    mockFsMkdir.mockResolvedValue(undefined);
    mockFsWriteFile.mockResolvedValue(undefined);
    mockFsUnlink.mockResolvedValue(undefined);
    mockFsRm.mockResolvedValue(undefined);
  });

  describe('State Persistence Across Restarts', () => {
    it('should restore running VM after provider re-initialization', async () => {
      // Step 1: Create and start VM with first provider instance
      const provider1 = new VfkitProvider();

      const config: VMConfig = {
        name: 'persistence-test-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock filesystem for VM creation
      let vmCreated = false;
      let pidWritten = false;
      let writtenPid: string | undefined;

      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // VM directory doesn't exist initially
          if (path.includes('/persistence-test-vm') && !vmCreated && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // After creation, VM directory exists
          if (path.includes('/persistence-test-vm') && vmCreated) {
            return;
          }
          // Kernel, rootfs, and disk files exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsWriteFile.mockImplementation((async (filepath: any, data: any) => {
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          pidWritten = true;
          writtenPid = data.toString();
        }
        vmCreated = true;
      }) as any);

      // Mock readdir for initialization - no VMs initially
      mockFsReaddir.mockResolvedValue([]);

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

      // Mock PID file read - VM is running
      mockFsReadFile.mockImplementation((async (filepath: any) => {
        if (typeof filepath === 'string') {
          if (filepath.includes('vm.pid') && pidWritten) {
            return writtenPid || '12345';
          }
          if (filepath.includes('config.json')) {
            return JSON.stringify(config);
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      // Mock process.kill to not throw (process is running)
      const originalKill = process.kill;
      const mockKill = jest.fn(() => true);
      process.kill = mockKill as any;

      // Create VM
      const vm = await provider1.create(config);

      // Step 2: Record VM ID and PID
      expect(vm).toBeDefined();
      expect(vm.id).toBe('persistence-test-vm');
      expect(vm.status).toBe('running');
      expect(mockSpawn).toHaveBeenCalled();
      expect(pidWritten).toBe(true);
      expect(writtenPid).toBe('12345');

      // Step 3: Simulate app restart - create new provider instance
      // Mock readdir to return our VM directory
      mockFsReaddir.mockResolvedValue([
        { name: 'persistence-test-vm', isDirectory: () => true } as any,
      ]);

      const provider2 = new VfkitProvider();

      // Step 4: Call list() - verify VM appears with 'running' status
      const vms = await provider2.list();

      expect(vms).toBeDefined();
      expect(vms.length).toBe(1);
      expect(vms[0].id).toBe('persistence-test-vm');
      expect(vms[0].name).toBe('persistence-test-vm');
      expect(vms[0].status).toBe('running');
      expect(vms[0].provider).toBe('vfkit');

      // Verify PID was checked (process.kill with signal 0)
      expect(mockKill).toHaveBeenCalledWith(12345, 0);

      // Step 5: Call stop(vmId) - verify VM stops cleanly
      // Reset mock to track stop call
      mockKill.mockClear();

      await provider2.stop('persistence-test-vm');

      // Verify SIGTERM was sent to stop the VM
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');

      // Verify PID file was cleaned up
      expect(mockFsUnlink).toHaveBeenCalledWith(
        expect.stringContaining('vm.pid')
      );

      // Restore original process.kill
      process.kill = originalKill;
    });

    it('should clean up stale PID files on re-initialization', async () => {
      const config: VMConfig = {
        name: 'stale-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock filesystem - VM directory exists with stale PID file
      mockFsReaddir.mockResolvedValue([
        { name: 'stale-vm', isDirectory: () => true } as any,
      ]);

      mockFsReadFile.mockImplementation((async (filepath: any) => {
        if (typeof filepath === 'string') {
          if (filepath.includes('vm.pid')) {
            return '99999'; // Stale PID that doesn't exist
          }
          if (filepath.includes('config.json')) {
            return JSON.stringify(config);
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsAccess.mockResolvedValue(undefined);
      mockFsUnlink.mockResolvedValue(undefined);

      // Mock process.kill to throw for stale PID (process doesn't exist)
      const originalKill = process.kill;
      const mockKill = jest.fn(() => {
        throw new Error('ESRCH: No such process');
      });
      process.kill = mockKill as any;

      // Initialize provider - should clean up stale PID file
      const provider = new VfkitProvider();
      await provider.initialize();

      // Verify PID was checked
      expect(mockKill).toHaveBeenCalledWith(99999, 0);

      // Verify stale PID file was cleaned up
      expect(mockFsUnlink).toHaveBeenCalledWith(
        expect.stringContaining('vm.pid')
      );

      // Restore original process.kill
      process.kill = originalKill;
    });

    it('should handle multiple VMs with different states', async () => {
      const runningVMConfig: VMConfig = {
        name: 'running-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      const stoppedVMConfig: VMConfig = {
        name: 'stopped-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock filesystem - two VM directories exist
      mockFsReaddir.mockResolvedValue([
        { name: 'running-vm', isDirectory: () => true } as any,
        { name: 'stopped-vm', isDirectory: () => true } as any,
      ]);

      mockFsReadFile.mockImplementation((async (filepath: any) => {
        if (typeof filepath === 'string') {
          // Running VM has valid PID file
          if (filepath.includes('running-vm/vm.pid')) {
            return '11111';
          }
          // Stopped VM has no PID file
          if (filepath.includes('stopped-vm/vm.pid')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // Config files
          if (filepath.includes('running-vm/config.json')) {
            return JSON.stringify(runningVMConfig);
          }
          if (filepath.includes('stopped-vm/config.json')) {
            return JSON.stringify(stoppedVMConfig);
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsAccess.mockResolvedValue(undefined);

      // Mock process.kill - running VM's PID exists
      const originalKill = process.kill;
      const mockKill = jest.fn((pid: number) => {
        if (pid === 11111) {
          return true; // Process exists
        }
        throw new Error('ESRCH: No such process');
      });
      process.kill = mockKill as any;

      // Initialize provider and list VMs
      const provider = new VfkitProvider();
      const vms = await provider.list();

      // Verify both VMs are listed with correct status
      expect(vms).toBeDefined();
      expect(vms.length).toBe(2);

      const runningVM = vms.find(vm => vm.id === 'running-vm');
      const stoppedVM = vms.find(vm => vm.id === 'stopped-vm');

      expect(runningVM).toBeDefined();
      expect(runningVM?.status).toBe('running');

      expect(stoppedVM).toBeDefined();
      expect(stoppedVM?.status).toBe('stopped');

      // Restore original process.kill
      process.kill = originalKill;
    });

    it('should handle re-initialization when no VMs exist', async () => {
      // Mock empty VM directory
      mockFsReaddir.mockResolvedValue([]);
      mockFsAccess.mockResolvedValue(undefined);

      const provider = new VfkitProvider();
      await provider.initialize();

      const vms = await provider.list();

      expect(vms).toBeDefined();
      expect(vms.length).toBe(0);
    });

    it('should handle re-initialization when VM directory does not exist', async () => {
      // Mock VM directory doesn't exist
      mockFsReaddir.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const provider = new VfkitProvider();
      await provider.initialize();

      const vms = await provider.list();

      expect(vms).toBeDefined();
      expect(vms.length).toBe(0);
    });

    it('should validate PID on every list() call', async () => {
      const config: VMConfig = {
        name: 'validate-test-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock VM directory exists
      mockFsReaddir.mockResolvedValue([
        { name: 'validate-test-vm', isDirectory: () => true } as any,
      ]);

      let pidExists = true;

      mockFsReadFile.mockImplementation((async (filepath: any) => {
        if (typeof filepath === 'string') {
          if (filepath.includes('vm.pid')) {
            if (pidExists) {
              return '22222';
            } else {
              throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            }
          }
          if (filepath.includes('config.json')) {
            return JSON.stringify(config);
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsAccess.mockResolvedValue(undefined);

      // Mock process.kill - process exists initially
      const originalKill = process.kill;
      const mockKill = jest.fn((pid: number, signal: any) => {
        if (signal === 0 && pidExists) {
          return true;
        }
        throw new Error('ESRCH: No such process');
      });
      process.kill = mockKill as any;

      const provider = new VfkitProvider();

      // First list() - VM is running
      let vms = await provider.list();
      expect(vms.length).toBe(1);
      expect(vms[0].status).toBe('running');

      // Simulate process dies
      pidExists = false;
      mockKill.mockClear();

      // Second list() - VM should now be stopped
      vms = await provider.list();
      expect(vms.length).toBe(1);
      expect(vms[0].status).toBe('stopped');

      // Restore original process.kill
      process.kill = originalKill;
    });

    it('should handle invalid PID file content', async () => {
      const config: VMConfig = {
        name: 'invalid-pid-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock VM directory exists with invalid PID file
      mockFsReaddir.mockResolvedValue([
        { name: 'invalid-pid-vm', isDirectory: () => true } as any,
      ]);

      mockFsReadFile.mockImplementation((async (filepath: any) => {
        if (typeof filepath === 'string') {
          if (filepath.includes('vm.pid')) {
            return 'not-a-number'; // Invalid PID
          }
          if (filepath.includes('config.json')) {
            return JSON.stringify(config);
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsAccess.mockResolvedValue(undefined);
      mockFsUnlink.mockResolvedValue(undefined);

      // Initialize provider - should clean up invalid PID file
      const provider = new VfkitProvider();
      await provider.initialize();

      // Verify invalid PID file was cleaned up
      expect(mockFsUnlink).toHaveBeenCalledWith(
        expect.stringContaining('vm.pid')
      );
    });

    it('should skip VM directories with missing config.json', async () => {
      // Mock VM directory exists but config.json is missing
      mockFsReaddir.mockResolvedValue([
        { name: 'incomplete-vm', isDirectory: () => true } as any,
      ]);

      mockFsReadFile.mockImplementation((async (filepath: any) => {
        if (typeof filepath === 'string') {
          if (filepath.includes('config.json')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsAccess.mockResolvedValue(undefined);

      const provider = new VfkitProvider();
      const vms = await provider.list();

      // Should return empty list, skipping the invalid VM
      expect(vms).toBeDefined();
      expect(vms.length).toBe(0);
    });
  });

  describe('End-to-End VM Lifecycle with Restart', () => {
    it('should complete full VM lifecycle with provider restart', async () => {
      const config: VMConfig = {
        name: 'lifecycle-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      let vmCreated = false;
      let pidWritten = false;
      let writtenPid: string | undefined;
      let pidCleaned = false;

      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // VM directory doesn't exist initially
          if (path.includes('/lifecycle-vm') && !vmCreated && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // After creation, VM directory exists
          if (path.includes('/lifecycle-vm') && vmCreated) {
            return;
          }
          // Kernel, rootfs, and disk files exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsWriteFile.mockImplementation((async (filepath: any, data: any) => {
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          pidWritten = true;
          writtenPid = data.toString();
          pidCleaned = false;
        }
        vmCreated = true;
      }) as any);

      mockFsUnlink.mockImplementation((async (filepath: any) => {
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          pidCleaned = true;
          pidWritten = false;
        }
      }) as any);

      // Mock readdir to return VM directory after creation
      mockFsReaddir.mockImplementation((async () => {
        if (vmCreated) {
          return [{ name: 'lifecycle-vm', isDirectory: () => true } as any];
        }
        return [];
      }) as any);

      mockFsReadFile.mockImplementation((async (filepath: any) => {
        if (typeof filepath === 'string') {
          if (filepath.includes('vm.pid') && pidWritten && !pidCleaned) {
            return writtenPid || '33333';
          }
          if (filepath.includes('config.json')) {
            return JSON.stringify(config);
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      const mockProc = {
        pid: 33333,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      const originalKill = process.kill;
      const mockKill = jest.fn((pid: number, signal: any) => {
        if (signal === 'SIGTERM') {
          // Stop the VM
          pidCleaned = true;
          return true;
        }
        if (signal === 0 && pidWritten && !pidCleaned) {
          return true; // Process exists
        }
        throw new Error('ESRCH: No such process');
      });
      process.kill = mockKill as any;

      // 1. Create VM
      const provider1 = new VfkitProvider();
      const vm = await provider1.create(config);
      expect(vm.status).toBe('running');

      // 2. Simulate restart - new provider instance
      const provider2 = new VfkitProvider();
      let vms = await provider2.list();
      expect(vms.length).toBe(1);
      expect(vms[0].status).toBe('running');

      // 3. Stop VM
      await provider2.stop('lifecycle-vm');
      expect(mockKill).toHaveBeenCalledWith(33333, 'SIGTERM');
      expect(pidCleaned).toBe(true);

      // 4. Simulate another restart - VM should be stopped
      const provider3 = new VfkitProvider();
      vms = await provider3.list();
      expect(vms.length).toBe(1);
      expect(vms[0].status).toBe('stopped');

      // Restore original process.kill
      process.kill = originalKill;
    });
  });
});
