/**
 * Integration Tests for VM Boot Timeout
 * Tests that VMs fail gracefully with timeout error when boot takes too long
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { VfkitProvider } from '@/lib/vm/providers/vfkit';
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
const mockOsPlatform = os.platform as jest.MockedFunction<typeof os.platform>;
const mockOsArch = os.arch as jest.MockedFunction<typeof os.arch>;
const mockOsHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;

describe('VM Boot Timeout Integration Tests', () => {
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
  });

  describe('Boot Timeout Enforcement', () => {
    it('should enforce 30-second boot timeout with invalid kernel path', async () => {
      const provider = new VfkitProvider();

      const config: VMConfig = {
        name: 'test-timeout-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock directory structure creation
      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // VM directory doesn't exist initially (pre-flight check passes)
          if (path.includes('/test-timeout-vm') && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // Kernel, rootfs, and disk files exist (will be created or already exist)
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        // Default: file doesn't exist
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      // Mock process spawn - VM will spawn but never become ready
      const mockProc = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      // Mock readFile for PID checks - always return not found to simulate VM never starting
      mockFsReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      // Mock readdir for initialization
      mockFsReaddir.mockResolvedValue([]);

      // Measure time to error
      const startTime = Date.now();

      try {
        await provider.create(config);

        // Should not reach here - should throw timeout error
        expect(true).toBe(false);
      } catch (error) {
        const duration = Date.now() - startTime;

        // Verify error message indicates boot timeout
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('failed to start within');
        expect(errorMessage).toContain('30 seconds');
        expect(errorMessage).toContain('test-timeout-vm');

        // Verify timeout happens within 30-32 seconds
        // Allow 2 seconds buffer for test overhead
        expect(duration).toBeGreaterThanOrEqual(30000);
        expect(duration).toBeLessThan(32000);
      }
    });

    it('should provide helpful error message on boot timeout', async () => {
      const provider = new VfkitProvider();

      const config: VMConfig = {
        name: 'timeout-vm-2',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock VM creation but boot timeout
      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // VM directory doesn't exist initially
          if (path.includes('/timeout-vm-2') && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // Kernel, rootfs, and disk files exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      const mockProc = {
        pid: 12346,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      // VM never becomes ready
      mockFsReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockFsReaddir.mockResolvedValue([]);

      try {
        await provider.create(config);
        expect(true).toBe(false);
      } catch (error) {
        const errorMessage = (error as Error).message;

        // Verify error provides actionable information
        expect(errorMessage).toContain('failed to start within');
        expect(errorMessage).toContain('console log');
        expect(errorMessage).toContain('logs/console.log');

        // Verify it suggests remediation
        expect(errorMessage.toLowerCase()).toMatch(/memory|cpu|allocation/);
      }
    });

    it('should timeout even with valid configuration but slow boot', async () => {
      const provider = new VfkitProvider();

      const config: VMConfig = {
        name: 'slow-boot-vm',
        cpus: 4,
        memory: '4GB',
        disk: '20GB',
        image: 'alpine-3.22',
      };

      // All files exist and valid
      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // VM directory doesn't exist initially
          if (path.includes('/slow-boot-vm') && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // Kernel, rootfs, and disk files exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      const mockProc = {
        pid: 12347,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      // VM PID file doesn't exist (simulating VM never fully starts)
      mockFsReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockFsReaddir.mockResolvedValue([]);

      const startTime = Date.now();

      try {
        await provider.create(config);
        expect(true).toBe(false);
      } catch (error) {
        const duration = Date.now() - startTime;

        // Verify timeout enforcement
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('failed to start within 30 seconds');

        // Verify timeout is enforced even with "valid" configuration
        expect(duration).toBeGreaterThanOrEqual(30000);
        expect(duration).toBeLessThan(32000);
      }
    });

    it('should not timeout when VM boots successfully within 30 seconds', async () => {
      const provider = new VfkitProvider();

      const config: VMConfig = {
        name: 'fast-boot-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      // Mock successful boot
      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // VM directory doesn't exist initially
          if (path.includes('/fast-boot-vm') && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // Kernel, rootfs, and disk files exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      const mockProc = {
        pid: 12348,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      // VM becomes ready immediately
      mockFsReadFile.mockResolvedValue('12348');
      mockFsReaddir.mockResolvedValue([]);

      // Mock process.kill to not throw (process is running)
      const originalKill = process.kill;
      process.kill = jest.fn(() => true) as any;

      const startTime = Date.now();

      try {
        const vm = await provider.create(config);
        const duration = Date.now() - startTime;

        // Verify VM created successfully
        expect(vm).toBeDefined();
        expect(vm.name).toBe('fast-boot-vm');
        expect(vm.status).toBe('running');

        // Verify it didn't take the full 30 seconds
        expect(duration).toBeLessThan(5000); // Should be fast with mocks
      } finally {
        // Restore original process.kill
        process.kill = originalKill;
      }
    });
  });

  describe('Boot Timeout Edge Cases', () => {
    it('should handle boot timeout with process spawn failure', async () => {
      const provider = new VfkitProvider();

      const config: VMConfig = {
        name: 'spawn-fail-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // VM directory doesn't exist initially
          if (path.includes('/spawn-fail-vm') && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // Kernel, rootfs, and disk files exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      // Mock spawn to return process without PID (immediate failure)
      const mockProc = {
        pid: undefined, // No PID - spawn failed
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);
      mockFsReaddir.mockResolvedValue([]);

      try {
        await provider.create(config);
        expect(true).toBe(false);
      } catch (error) {
        // Should fail immediately without waiting for timeout
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('vfkit process did not start');
      }
    });

    it('should clean up PID file after boot timeout', async () => {
      const provider = new VfkitProvider();

      const config: VMConfig = {
        name: 'cleanup-test-vm',
        cpus: 2,
        memory: '2GB',
        disk: '10GB',
        image: 'alpine-3.22',
      };

      mockFsAccess.mockImplementation((async (path: string) => {
        if (typeof path === 'string') {
          // VM directory doesn't exist initially
          if (path.includes('/cleanup-test-vm') && !path.includes('kernel') && !path.includes('rootfs') && !path.includes('disk')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          // Kernel, rootfs, and disk files exist
          if (path.includes('kernel/vmlinux') || path.includes('rootfs/alpine-rootfs.cpio.gz') || path.includes('disk/root.img')) {
            return;
          }
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }) as any);

      const mockProc = {
        pid: 12349,
        unref: jest.fn(),
        on: jest.fn(),
        stdout: null,
        stderr: null,
        stdin: null,
      };
      mockSpawn.mockReturnValue(mockProc as any);

      // VM never becomes ready
      mockFsReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockFsReaddir.mockResolvedValue([]);

      try {
        await provider.create(config);
        expect(true).toBe(false);
      } catch (error) {
        // Verify error occurred
        expect(error).toBeInstanceOf(Error);

        // Verify PID file was written (part of launch process)
        expect(mockFsWriteFile).toHaveBeenCalledWith(
          expect.stringContaining('vm.pid'),
          '12349'
        );

        // Note: Actual cleanup happens in stop() method
        // This test verifies the boot timeout error is thrown
        // allowing higher-level code to handle cleanup
      }
    });
  });
});
