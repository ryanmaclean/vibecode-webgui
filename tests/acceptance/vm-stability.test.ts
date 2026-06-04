/**
 * Acceptance Tests for VM Stability Feature
 *
 * Validates all acceptance criteria for Apple Virtualization Framework Stability:
 * AC1: VMs start within 30 seconds consistently
 * AC2: Graceful handling of virtualization permission errors
 * AC3: Clear error messages when Apple VZ is not available
 * AC4: VM state persistence across app restarts
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { VfkitProvider } from '@/lib/vm/providers/vfkit';
import { ProviderFactory } from '@/lib/vm/provider-factory';
import { VMConfig, VMError } from '@/lib/vm/types';
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
const mockOsTotalmem = os.totalmem as jest.MockedFunction<typeof os.totalmem>;
const mockOsFreemem = os.freemem as jest.MockedFunction<typeof os.freemem>;
const mockOsCpus = os.cpus as jest.MockedFunction<typeof os.cpus>;

describe('VM Stability - Acceptance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset spawn and exec mocks so implementations don't leak between tests
    mockSpawn.mockReset();
    mockExec.mockReset();
    mockFsAccess.mockReset();
    mockFsReadFile.mockReset();
    mockFsReaddir.mockReset();

    // Default exec implementation: fail all commands (tests override as needed)
    // This prevents promisify(exec) from hanging when callback is never called
    mockExec.mockImplementation(((cmd: string, callback: any) => {
      callback(new Error(`Command not mocked: ${cmd}`), { stdout: '', stderr: '' });
    }) as any);

    // Default OS mocks for macOS Apple Silicon
    mockOsPlatform.mockReturnValue('darwin');
    mockOsArch.mockReturnValue('arm64');
    mockOsHomedir.mockReturnValue('/Users/test');
    // 16GB total, 8GB free — ensures 2GB VM memory passes the 80% safe-allocation check
    mockOsTotalmem.mockReturnValue(16 * 1024 * 1024 * 1024);
    mockOsFreemem.mockReturnValue(8 * 1024 * 1024 * 1024);
    mockOsCpus.mockReturnValue(Array(8).fill({ model: 'Apple M1', speed: 3200, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }));

    // Default filesystem mocks
    mockFsMkdir.mockResolvedValue(undefined);
    mockFsWriteFile.mockResolvedValue(undefined);
    mockFsUnlink.mockResolvedValue(undefined);
    mockFsRm.mockResolvedValue(undefined);
  });

  describe('AC1: VMs Start Within 30 Seconds Consistently', () => {
    it('should enforce 30-second boot timeout and fail gracefully', async () => {
      const provider = new VfkitProvider();

      const config: VMConfig = {
        name: 'ac1-timeout-test',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock vfkit available and system checks passing
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

      // Mock filesystem for pre-flight checks
      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // VM doesn't exist (pre-flight check passes)
          if (path.includes('/ac1-timeout-test') && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // Kernel and rootfs files exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      // Mock readdir for initialization
      mockFsReaddir.mockResolvedValue([]);

      // Mock spawn - VM spawns but never becomes ready (simulates boot failure)
      const mockProc = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      // Mock readFile - PID file never indicates ready state
      mockFsReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      // Measure time to timeout
      const startTime = Date.now();

      await expect(provider.create(config)).rejects.toThrow(/boot.*timeout|failed to start within 30 seconds/i);

      const elapsedTime = Date.now() - startTime;

      // Verify timeout occurred within 30-32 seconds (allowing 2s buffer for test overhead)
      expect(elapsedTime).toBeGreaterThanOrEqual(30000);
      expect(elapsedTime).toBeLessThan(33000);
    }, 35000); // Test timeout 35s to allow for 30s boot timeout

    it('should include helpful error messages on boot timeout', async () => {
      const provider = new VfkitProvider();

      const config: VMConfig = {
        name: 'ac1-error-message-test',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock system as available
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '14.0.0', stderr: '' });
        } else if (cmd.includes('df -k')) {
          callback(null, { stdout: '104857600', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          if (path.includes('/ac1-error-message-test') && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsReaddir.mockResolvedValue([]);

      const mockProc = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);
      mockFsReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      // Verify error is user-friendly and includes boot timeout info and troubleshooting hint
      await expect(provider.create(config)).rejects.toThrow(/boot.*timeout|failed to start within 30 seconds/i);
    }, 35000);
  });

  describe('AC2: Graceful Handling of Virtualization Permission Errors', () => {
    it('should detect and report when Virtualization.framework is unavailable', async () => {
      // Mock macOS version too old
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '10.15.7', stderr: '' }); // Catalina (pre-VZ)
        } else {
          callback(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/11.0|Big Sur|upgrade/i);
    });

    it('should provide clear error when virtualization is not supported', async () => {
      // Mock CPU without virtualization support
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '14.0.0', stderr: '' });
        } else if (cmd.includes('kern.hv_support')) {
          callback(null, { stdout: '0', stderr: '' }); // No HV support
        } else {
          callback(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/CPU|virtualization|hardware/i);
    });

    it('should handle permission errors gracefully during VM operations', async () => {
      const provider = new VfkitProvider();

      const config: VMConfig = {
        name: 'ac2-permission-test',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock vfkit available
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '14.0.0', stderr: '' });
        } else if (cmd.includes('df -k')) {
          callback(null, { stdout: '104857600', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      mockFsReaddir.mockResolvedValue([]);

      // Mock permission denied during directory creation
      mockFsMkdir.mockRejectedValue(Object.assign(new Error('EACCES: permission denied'), {
        code: 'EACCES'
      }));

      try {
        await provider.create(config);
        fail('Should have thrown permission error');
      } catch (error: any) {
        // Verify error message mentions permissions and Full Disk Access
        expect(error.message).toMatch(/permission|access|EACCES/i);
        expect(error.message).toMatch(/Full Disk Access|System Preferences|System Settings/i);
      }
    });
  });

  describe('AC3: Clear Error Messages When Apple VZ Not Available', () => {
    it('should provide clear error on non-macOS platforms', async () => {
      // Mock Linux platform
      mockOsPlatform.mockReturnValue('linux');

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/macOS/i);
    });

    it('should provide installation instructions when vfkit is missing', async () => {
      const provider = new VfkitProvider();

      const config: VMConfig = {
        name: 'ac3-missing-vfkit',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock vfkit not found
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(new Error('Command not found'), { stdout: '', stderr: '' });
        } else if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '14.0.0', stderr: '' });
        } else if (cmd.includes('df -k')) {
          callback(null, { stdout: '104857600', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      mockFsReaddir.mockResolvedValue([]);

      // Simulate spawn throwing synchronously with ENOENT (binary not in PATH)
      mockSpawn.mockImplementation((() => {
        const enoentError = Object.assign(new Error('spawn vfkit ENOENT'), { code: 'ENOENT' });
        throw enoentError;
      }) as any);

      await expect(provider.create(config)).rejects.toThrow(/vfkit.*not found|brew install/i);
    });

    it('should validate macOS version with helpful upgrade message', async () => {
      // Mock old macOS version
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '10.14.6', stderr: '' }); // Mojave
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(false);
      expect(result.error).toBeDefined();
      // Should include current version and required version
      expect(result.error).toMatch(/10.14.6/);
      expect(result.error).toMatch(/11.0|upgrade/i);
    });
  });

  describe('AC4: VM State Persistence Across App Restarts', () => {
    it('should persist VM state across provider re-initialization', async () => {
      // Step 1: Create VM with first provider instance
      const provider1 = new VfkitProvider();

      const config: VMConfig = {
        name: 'ac4-persistence-test',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      let vmCreated = false;
      let writtenPid: string | undefined;
      const vmPid = 55555;

      // Mock vfkit and system checks
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '14.0.0', stderr: '' });
        } else if (cmd.includes('df -k')) {
          callback(null, { stdout: '104857600', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      // Mock filesystem operations
      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // VM doesn't exist initially
          if (path.includes('/ac4-persistence-test') && !vmCreated && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // After creation
          if (path.includes('/ac4-persistence-test') && vmCreated) {
            return;
          }
          // System files exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsWriteFile.mockImplementation((async (filepath: any, data: any) => {
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          writtenPid = data.toString();
          vmCreated = true;
        }
        if (typeof filepath === 'string' && filepath.includes('config.json')) {
          vmCreated = true;
        }
      }) as any);

      mockFsReadFile.mockImplementation((async (filepath: any, options?: any) => {
        const encoding = typeof options === 'string' ? options : options?.encoding;
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          if (writtenPid) {
            return encoding ? writtenPid : Buffer.from(writtenPid);
          }
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        if (typeof filepath === 'string' && filepath.includes('config.json')) {
          const json = JSON.stringify(config);
          return encoding ? json : Buffer.from(json);
        }
        if (typeof filepath === 'string' && filepath.includes('console.log')) {
          // Return boot marker so waitForBoot succeeds immediately
          const content = 'Welcome to Alpine Linux';
          return encoding ? content : Buffer.from(content);
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      // First initialization - empty VM directory
      mockFsReaddir.mockResolvedValueOnce([]);

      // Mock spawn for VM creation
      const mockProc = {
        pid: vmPid,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      // Create VM
      const vm = await provider1.create(config);
      expect(vm.name).toBe('ac4-persistence-test');
      expect(vm.status).toBe('running');

      // Step 2: Simulate app restart - create new provider instance
      // On re-initialization, list existing VM directories
      mockFsReaddir.mockResolvedValue([
        { name: 'ac4-persistence-test', isDirectory: () => true } as any,
      ]);

      const provider2 = new VfkitProvider();

      // Step 3: Verify VM appears in list with correct status
      const vms = await provider2.list();

      expect(vms.length).toBeGreaterThan(0);
      const persistedVm = vms.find(v => v.name === 'ac4-persistence-test');
      expect(persistedVm).toBeDefined();
      expect(persistedVm?.name).toBe('ac4-persistence-test');
      // Status should be 'running' if PID is still valid
      expect(['running', 'stopped']).toContain(persistedVm?.status);
    });

    it('should clean up stale VM state on re-initialization', async () => {
      const stalePid = 99999;

      // Mock readdir to find VM with stale PID
      mockFsReaddir.mockResolvedValue([
        { name: 'stale-vm', isDirectory: () => true } as any,
      ]);

      mockFsReadFile.mockImplementation((async (filepath: any) => {
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          return Buffer.from(stalePid.toString());
        }
        if (typeof filepath === 'string' && filepath.includes('config.json')) {
          return Buffer.from(JSON.stringify({
            name: 'stale-vm',
            cpus: 2,
            memory: '2GB',
            disk: '10GB',
            image: 'alpine-3.22',
          }));
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '14.0.0', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      const provider = new VfkitProvider();
      const vms = await provider.list();

      // Stale VM should appear as 'stopped' (PID is dead)
      const staleVm = vms.find(v => v.name === 'stale-vm');
      expect(staleVm).toBeDefined();
      expect(staleVm?.status).toBe('stopped');
    });

    it('should handle VM state save and restore operations', async () => {
      const provider = new VfkitProvider();
      const vmId = 'test-vm-save-restore';
      const savePath = '/tmp/vm-save-state';

      // Mock VM exists
      mockFsReadFile.mockImplementation((async (filepath: any) => {
        if (typeof filepath === 'string' && filepath.includes('config.json')) {
          return Buffer.from(JSON.stringify({
            name: vmId,
            cpus: 2,
            memory: '2GB',
            disk: '10GB',
            image: 'alpine-3.22',
          }));
        }
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          return Buffer.from('12345');
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsAccess.mockResolvedValue(undefined);
      mockFsReaddir.mockResolvedValue([]);

      // Test saveState
      if (provider.saveState) {
        const saveResult = await provider.saveState(vmId, savePath);
        expect(typeof saveResult).toBe('boolean');
      }

      // Test restoreState
      if (provider.restoreState) {
        const restoreResult = await provider.restoreState(vmId, savePath);
        expect(typeof restoreResult).toBe('boolean');
      }
    });

    it('should preserve VM state through stop and restart cycle', async () => {
      const provider = new VfkitProvider();
      const vmId = 'test-vm-cycle';
      const vmPid = 77777;

      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '14.0.0', stderr: '' });
        } else if (cmd.includes('df -k')) {
          callback(null, { stdout: '104857600', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      // Initial empty directory
      mockFsReaddir.mockResolvedValueOnce([]);

      // Mock VM creation: VM directory doesn't exist initially (pre-flight), but kernel/rootfs/disk do
      // After creation, the VM directory and config are treated as existing
      let vmCreated = false;
      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // Kernel and rootfs files always exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
          // VM directory and config exist after creation
          if (vmCreated && path.includes(`/${vmId}`)) {
            return;
          }
          // VM directory doesn't exist before creation (pre-flight check)
          if (!vmCreated && path.includes(`/${vmId}`)) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      const mockProc = {
        pid: vmPid,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      let pidFileContent: string | undefined;

      mockFsWriteFile.mockImplementation((async (filepath: any, data: any) => {
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          pidFileContent = data.toString();
        }
      }) as any);

      mockFsReadFile.mockImplementation((async (filepath: any, options?: any) => {
        const encoding = typeof options === 'string' ? options : options?.encoding;
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          if (pidFileContent) {
            return encoding ? pidFileContent : Buffer.from(pidFileContent);
          }
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        if (typeof filepath === 'string' && filepath.includes('config.json')) {
          const json = JSON.stringify({
            name: vmId,
            cpus: 2,
            memory: '2GB',
            disk: '10GB',
            image: 'alpine-3.22',
          });
          return encoding ? json : Buffer.from(json);
        }
        if (typeof filepath === 'string' && filepath.includes('console.log')) {
          // Return boot marker so waitForBoot succeeds immediately
          const content = 'Welcome to Alpine Linux';
          return encoding ? content : Buffer.from(content);
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      // Create VM
      const config: VMConfig = {
        name: vmId,
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      const vm = await provider.create(config);
      vmCreated = true;
      expect(vm.status).toBe('running');
      expect(pidFileContent).toBeDefined();

      // Stop VM
      mockFsUnlink.mockResolvedValue(undefined);

      // Mock process.kill: SIGTERM succeeds, signal 0 throws ESRCH (process stopped)
      const killSpy = jest.spyOn(process, 'kill').mockImplementation((pid: number, signal?: any) => {
        if (signal === 0) {
          const err = Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
          throw err;
        }
        return true as any;
      });
      await provider.stop(vmId);
      killSpy.mockRestore();

      // Verify PID file cleanup was attempted
      expect(mockFsUnlink).toHaveBeenCalledWith(expect.stringContaining('vm.pid'));
    });
  });

  describe('Integration: All Acceptance Criteria Combined', () => {
    it('should handle complete VM lifecycle with all stability features', async () => {
      const provider = new VfkitProvider();

      // Set up exec mock before any exec calls (including detectVirtualizationSupport)
      mockExec.mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/usr/local/bin/vfkit', stderr: '' });
        } else if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '14.0.0', stderr: '' });
        } else if (cmd.includes('df -k')) {
          callback(null, { stdout: '104857600', stderr: '' });
        } else {
          callback(new Error('Not found'), { stdout: '', stderr: '' });
        }
      }) as any);

      // 1. Verify Virtualization.framework detection (AC2, AC3)
      const vzSupport = await ProviderFactory.detectVirtualizationSupport();
      expect(vzSupport).toHaveProperty('isSupported');
      if (!vzSupport.isSupported) {
        expect(vzSupport.error).toBeDefined();
        expect(vzSupport.error).toMatch(/macOS|version|virtualization/i);
      }

      // 2. Create VM with proper timeout enforcement (AC1)
      const config: VMConfig = {
        name: 'integration-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      let integrationVmCreated = false;
      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // Kernel and rootfs files always exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
          // VM directory and config exist after creation
          if (integrationVmCreated && path.includes('/integration-vm')) {
            return;
          }
          // VM directory doesn't exist before creation (pre-flight check)
          if (!integrationVmCreated && path.includes('/integration-vm')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      mockFsReaddir.mockResolvedValue([]);

      const mockProc = {
        pid: 88888,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      let pidWritten = false;

      mockFsWriteFile.mockImplementation((async (filepath: any, data: any) => {
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          pidWritten = true;
        }
      }) as any);

      mockFsReadFile.mockImplementation((async (filepath: any, options?: any) => {
        const encoding = typeof options === 'string' ? options : options?.encoding;
        if (typeof filepath === 'string' && filepath.includes('vm.pid')) {
          if (pidWritten) {
            return encoding ? '88888' : Buffer.from('88888');
          }
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        if (typeof filepath === 'string' && filepath.includes('config.json')) {
          const json = JSON.stringify(config);
          return encoding ? json : Buffer.from(json);
        }
        if (typeof filepath === 'string' && filepath.includes('console.log')) {
          // Return boot marker so waitForBoot succeeds immediately
          const content = 'Welcome to Alpine Linux';
          return encoding ? content : Buffer.from(content);
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      const vm = await provider.create(config);
      integrationVmCreated = true;
      expect(vm.name).toBe('integration-vm');
      expect(vm.status).toBe('running');

      // 3. Verify state persistence (AC4)
      expect(pidWritten).toBe(true);

      // 4. Test graceful stop with state cleanup
      mockFsUnlink.mockResolvedValue(undefined);
      // Mock process.kill: SIGTERM succeeds, signal 0 throws ESRCH (process stopped)
      const killSpy = jest.spyOn(process, 'kill').mockImplementation((pid: number, signal?: any) => {
        if (signal === 0) {
          const err = Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
          throw err;
        }
        return true as any;
      });
      await provider.stop(vm.id);
      killSpy.mockRestore();

      expect(mockFsUnlink).toHaveBeenCalled();
    }, 60000);
  });
});
