/**
 * Unit tests for Native VM Provider
 * Tests the NativeVMProvider implementation
 */

import { NativeVMProvider } from '../native-vm';
import { VMConfig, VMStatus } from '../../types';
import * as fs from 'fs/promises';
import { ChildProcess } from 'child_process';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('child_process');
jest.mock('@/lib/logger');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockChildProcess = require('child_process');

describe('NativeVMProvider', () => {
  let provider: NativeVMProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new NativeVMProvider();
  });

  describe('detect', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    it('should return false on non-macOS platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });

      const result = await provider.detect();
      expect(result).toBe(false);
    });

    it('should return false on macOS < 12.0', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });

      const { exec } = require('child_process');
      exec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '11.7.0\n', stderr: '' });
        }
      });

      const result = await provider.detect();
      expect(result).toBe(false);
    });

    it('should return false if Swift binary does not exist', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });

      const { exec } = require('child_process');
      exec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '12.0.0\n', stderr: '' });
        }
      });

      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await provider.detect();
      expect(result).toBe(false);
    });

    it('should return true on macOS 12+ with Swift binary', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });

      const { exec } = require('child_process');
      exec.mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('sw_vers')) {
          callback(null, { stdout: '12.5.0\n', stderr: '' });
        }
      });

      mockFs.access.mockResolvedValue(undefined);

      const result = await provider.detect();
      expect(result).toBe(true);
    });
  });

  describe('create', () => {
    const testConfig: VMConfig = {
      name: 'test-vm',
      cpus: 2,
      memory: '4GB',
      disk: '20GB',
      image: 'alpine-3.22',
      arch: 'arm64'
    };

    beforeEach(() => {
      // Mock successful directory creation
      mockFs.mkdir.mockResolvedValue(undefined);

      // Mock successful file operations
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.open.mockResolvedValue({
        truncate: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      } as any);

      // Mock exec for kernel download (already exists)
      const { exec } = require('child_process');
      exec.mockImplementation((cmd: string, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      // Mock spawn for Swift process
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        once: jest.fn(),
        kill: jest.fn(),
        killed: false,
        pid: 12345
      } as any;

      mockChildProcess.spawn.mockReturnValue(mockProc);
    });

    it('should create VM directory structure', async () => {
      // Override waitForVMReady to return immediately
      const waitForVMReadySpy = jest.spyOn(
        provider as any,
        'waitForVMReady'
      ).mockResolvedValue(undefined);

      await provider.create(testConfig);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('test-vm/kernel'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('test-vm/disk'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('test-vm/logs'),
        { recursive: true }
      );

      waitForVMReadySpy.mockRestore();
    });

    it('should save VM configuration', async () => {
      const waitForVMReadySpy = jest.spyOn(
        provider as any,
        'waitForVMReady'
      ).mockResolvedValue(undefined);

      await provider.create(testConfig);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.stringContaining(testConfig.name)
      );

      waitForVMReadySpy.mockRestore();
    });

    it('should launch Swift VM process with correct arguments', async () => {
      const waitForVMReadySpy = jest.spyOn(
        provider as any,
        'waitForVMReady'
      ).mockResolvedValue(undefined);

      await provider.create(testConfig);

      expect(mockChildProcess.spawn).toHaveBeenCalledWith(
        expect.stringContaining('vibecode-vm'),
        expect.arrayContaining([
          '--vm-id', 'test-vm',
          '--cpus', '2',
          '--memory', '4'
        ]),
        expect.any(Object)
      );

      waitForVMReadySpy.mockRestore();
    });

    it('should return VM object with correct properties', async () => {
      const waitForVMReadySpy = jest.spyOn(
        provider as any,
        'waitForVMReady'
      ).mockResolvedValue(undefined);

      const vm = await provider.create(testConfig);

      expect(vm).toMatchObject({
        id: 'test-vm',
        name: 'test-vm',
        provider: 'native-vm',
        status: 'running',
        ports: []
      });

      waitForVMReadySpy.mockRestore();
    });
  });

  describe('status', () => {
    it('should return stopped if VM process not found', async () => {
      const status = await provider.status('non-existent-vm');
      expect(status).toBe('stopped');
    });

    it('should return running for active VM process', async () => {
      // Create a mock process
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        killed: false
      } as any;

      (provider as any).processes.set('test-vm', mockProc);

      // Mock sendRequest to return running status
      jest.spyOn(provider as any, 'sendRequest').mockResolvedValue({
        status: 'running'
      });

      const status = await provider.status('test-vm');
      expect(status).toBe('running');
    });
  });

  describe('stop', () => {
    it('should gracefully stop VM and remove from processes', async () => {
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        once: jest.fn((event: string, callback: any) => {
          if (event === 'exit') {
            setTimeout(callback, 10);
          }
        }),
        kill: jest.fn(),
        killed: false
      } as any;

      (provider as any).processes.set('test-vm', mockProc);

      jest.spyOn(provider as any, 'sendRequest').mockResolvedValue({});

      await provider.stop('test-vm');

      expect((provider as any).processes.has('test-vm')).toBe(false);
    });

    it('should force kill VM if graceful shutdown times out', async () => {
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        once: jest.fn(),
        kill: jest.fn(),
        killed: false
      } as any;

      (provider as any).processes.set('test-vm', mockProc);

      // Mock sendRequest to reject (simulating a communication failure)
      jest.spyOn(provider as any, 'sendRequest').mockRejectedValue(
        new Error('Communication timeout')
      );

      // stop() should throw after force killing
      await expect(provider.stop('test-vm')).rejects.toThrow('Communication timeout');

      expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('list', () => {
    it('should return empty array if VM directory does not exist', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);

      const vms = await provider.list();
      expect(vms).toEqual([]);
    });

    it('should list all VMs with their configurations', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([
        { name: 'vm1', isDirectory: () => true },
        { name: 'vm2', isDirectory: () => true }
      ] as any);

      mockFs.readFile.mockImplementation((path: any) => {
        if (path.includes('vm1')) {
          return Promise.resolve(JSON.stringify({
            name: 'vm1',
            cpus: 2,
            memory: '4GB',
            disk: '20GB',
            image: 'alpine-3.22',
            ports: []
          }));
        }
        if (path.includes('vm2')) {
          return Promise.resolve(JSON.stringify({
            name: 'vm2',
            cpus: 4,
            memory: '8GB',
            disk: '40GB',
            image: 'alpine-3.22',
            ports: []
          }));
        }
        return Promise.reject(new Error('File not found'));
      });

      jest.spyOn(provider, 'status').mockResolvedValue('stopped' as VMStatus);

      const vms = await provider.list();
      expect(vms).toHaveLength(2);
      expect(vms[0].name).toBe('vm1');
      expect(vms[1].name).toBe('vm2');
    });
  });

  describe('JSON-RPC communication', () => {
    it('should send JSON-RPC request with correct format', async () => {
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn()
      } as any;

      const sendRequest = (provider as any).sendRequest.bind(provider);

      // Call sendRequest
      const promise = sendRequest(mockProc, 'vm.status', { vmId: 'test' });

      // Simulate response
      const pendingRequests = (provider as any).pendingRequests;
      const [[requestId, request]] = Array.from(pendingRequests.entries());

      // Verify request format
      expect(mockProc.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"jsonrpc":"2.0"')
      );
      expect(mockProc.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"method":"vm.status"')
      );

      // Complete the promise
      request.resolve({ status: 'running' });
      const result = await promise;

      expect(result).toEqual({ status: 'running' });
    });

    it('should handle JSON-RPC errors', async () => {
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn()
      } as any;

      const sendRequest = (provider as any).sendRequest.bind(provider);
      const promise = sendRequest(mockProc, 'vm.invalid', {});

      const pendingRequests = (provider as any).pendingRequests;
      const [[requestId, request]] = Array.from(pendingRequests.entries());

      // Simulate error response
      request.reject(new Error('Method not found'));

      await expect(promise).rejects.toThrow('Method not found');
    });
  });

  describe('utility methods', () => {
    it('should parse memory string to GB correctly', () => {
      const parseMemoryToGB = (provider as any).parseMemoryToGB.bind(provider);

      expect(parseMemoryToGB('4GB')).toBe(4);
      expect(parseMemoryToGB('2048MB')).toBe(2);
      expect(parseMemoryToGB('8')).toBeCloseTo(0.008, 3);
    });

    it('should parse size string to GB correctly', () => {
      const parseSizeToGB = (provider as any).parseSizeToGB.bind(provider);

      expect(parseSizeToGB('20GB')).toBe(20);
      expect(parseSizeToGB('1TB')).toBe(1024);
      expect(parseSizeToGB('512MB')).toBe(0.5);
    });

    it('should map Swift status to VMStatus correctly', () => {
      const mapSwiftStatus = (provider as any).mapSwiftStatus.bind(provider);

      expect(mapSwiftStatus('running')).toBe('running');
      expect(mapSwiftStatus('stopped')).toBe('stopped');
      expect(mapSwiftStatus('stopping')).toBe('stopping');
      expect(mapSwiftStatus('error')).toBe('error');
      expect(mapSwiftStatus('unknown')).toBe('unknown');
    });
  });
});
