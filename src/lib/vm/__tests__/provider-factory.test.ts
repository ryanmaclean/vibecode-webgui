/**
 * Unit tests for Provider Factory
 * Tests VM provider detection and Virtualization.framework capability detection
 */

import { ProviderFactory } from '../provider-factory';
import { exec } from 'child_process';
import * as os from 'os';

// Mock dependencies
jest.mock('child_process');
jest.mock('@/lib/logger');
jest.mock('fs/promises');

const mockExec = exec as unknown as jest.Mock;

describe('ProviderFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectVirtualizationSupport', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      });
    });

    it('should return unsupported on non-macOS platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(false);
      expect(result.error).toContain('only available on macOS');
    });

    it('should return unsupported on macOS < 11.0', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });

      mockExec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '10.15.7\n', stderr: '' });
        }
      });

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(false);
      expect(result.error).toContain('requires macOS 11.0 or later');
      expect(result.error).toContain('10.15.7');
    });

    it('should return unsupported if CPU does not support virtualization', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });

      mockExec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '12.0.0\n', stderr: '' });
        } else if (cmd.includes('sysctl')) {
          callback(null, { stdout: '0\n', stderr: '' });
        }
      });

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(false);
      expect(result.error).toContain('CPU does not support hardware virtualization');
    });

    it('should return supported on macOS 11+ with virtualization support', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });

      mockExec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '11.0.0\n', stderr: '' });
        } else if (cmd.includes('sysctl')) {
          callback(null, { stdout: '1\n', stderr: '' });
        } else if (cmd.includes('which vfkit')) {
          callback(new Error('not found'), { stdout: '', stderr: '' });
        }
      });

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return supported on macOS 12+', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });

      mockExec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '12.5.0\n', stderr: '' });
        } else if (cmd.includes('sysctl')) {
          callback(null, { stdout: '1\n', stderr: '' });
        } else if (cmd.includes('which vfkit')) {
          callback(null, { stdout: '/opt/homebrew/bin/vfkit\n', stderr: '' });
        } else if (cmd.includes('vfkit --version')) {
          callback(null, { stdout: 'vfkit 0.5.0\n', stderr: '' });
        }
      });

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle version detection errors gracefully', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });

      mockExec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(new Error('sw_vers failed'), { stdout: '', stderr: 'error' });
        }
      });

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(false);
      expect(result.error).toContain('Unable to detect macOS version');
    });

    it('should continue if sysctl check fails', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });

      mockExec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '11.0.0\n', stderr: '' });
        } else if (cmd.includes('sysctl')) {
          // Simulate sysctl failure (older macOS)
          callback(new Error('sysctl failed'), { stdout: '', stderr: 'error' });
        } else if (cmd.includes('which vfkit')) {
          callback(new Error('not found'), { stdout: '', stderr: '' });
        }
      });

      const result = await ProviderFactory.detectVirtualizationSupport();

      // Should still succeed since sysctl failure is not fatal
      expect(result.isSupported).toBe(true);
    });

    it('should detect macOS 13+', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });

      mockExec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '13.2.0\n', stderr: '' });
        } else if (cmd.includes('sysctl')) {
          callback(null, { stdout: '1\n', stderr: '' });
        } else if (cmd.includes('which vfkit')) {
          callback(new Error('not found'), { stdout: '', stderr: '' });
        }
      });

      const result = await ProviderFactory.detectVirtualizationSupport();

      expect(result.isSupported).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('getSystemInfo', () => {
    it('should detect Apple Silicon correctly', async () => {
      const platformSpy = jest.spyOn(os, 'platform').mockReturnValue('darwin');
      const archSpy = jest.spyOn(os, 'arch').mockReturnValue('arm64');

      mockExec.mockImplementation((cmd: string, callback: any) => {
        callback(new Error('not found'), { stdout: '', stderr: '' });
      });

      const sysInfo = await ProviderFactory.getSystemInfo();

      expect(sysInfo.os).toBe('darwin');
      expect(sysInfo.arch).toBe('arm64');
      expect(sysInfo.isAppleSilicon).toBe(true);

      platformSpy.mockRestore();
      archSpy.mockRestore();
    });

    it('should detect Intel Mac correctly', async () => {
      const platformSpy = jest.spyOn(os, 'platform').mockReturnValue('darwin');
      const archSpy = jest.spyOn(os, 'arch').mockReturnValue('x64');

      mockExec.mockImplementation((cmd: string, callback: any) => {
        callback(new Error('not found'), { stdout: '', stderr: '' });
      });

      const sysInfo = await ProviderFactory.getSystemInfo();

      expect(sysInfo.os).toBe('darwin');
      expect(sysInfo.arch).toBe('x86_64');
      expect(sysInfo.isAppleSilicon).toBe(false);

      platformSpy.mockRestore();
      archSpy.mockRestore();
    });
  });
});
