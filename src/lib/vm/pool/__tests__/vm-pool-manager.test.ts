/**
 * VM Pool Manager Tests
 * Tests for multi-VM lifecycle management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VMPoolManager, resetPoolManager } from '../vm-pool-manager';
import { resetPortManager } from '../../ports/port-manager';
import { resetProfilesService } from '../../profiles/vm-profiles';
import type { VMInstance, CreateVMOptions } from '@/types/multi-vm';

// Mock the provider factory
vi.mock('../../provider-factory', () => ({
  ProviderFactory: {
    detectProvider: vi.fn().mockResolvedValue({
      name: 'mock-provider',
      detect: vi.fn().mockResolvedValue(true),
      create: vi.fn().mockImplementation((config) => Promise.resolve({
        id: `vm-${Date.now()}`,
        name: config.name,
        provider: 'mock-provider',
        status: 'stopped',
        ip: '192.168.1.100',
        ports: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      exec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', duration: 100 }),
      status: vi.fn().mockResolvedValue('running')
    })
  }
}));

// Mock fs for state persistence
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue({ code: 'ENOENT' }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined)
}));

// Mock the logger
vi.mock('@/lib/logging', () => ({
  createServiceLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

describe('VMPoolManager', () => {
  let poolManager: VMPoolManager;

  beforeEach(async () => {
    // Reset singletons
    resetPoolManager();
    resetPortManager();
    resetProfilesService();

    // Create fresh instance
    poolManager = new VMPoolManager({
      limits: {
        maxVMs: 4,
        maxTotalCPU: 8,
        maxTotalMemoryMB: 8192,
        maxTotalDiskMB: 102400,
        maxSystemUsagePercent: 80
      },
      statePath: '/tmp/test-vm-state.json'
    });

    await poolManager.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      const newManager = new VMPoolManager();
      await expect(newManager.initialize()).resolves.not.toThrow();
    });

    it('should only initialize once', async () => {
      const newManager = new VMPoolManager();
      await newManager.initialize();
      await newManager.initialize(); // Second call should be no-op
      // No error means success
    });
  });

  describe('createVM', () => {
    it('should create a VM with default profile', async () => {
      const options: CreateVMOptions = {
        name: 'test-vm',
        profileId: 'development',
        autoStart: false
      };

      const result = await poolManager.createVM(options);

      expect(result.success).toBe(true);
      expect(result.vm).toBeDefined();
      expect(result.vm?.name).toBe('test-vm');
      expect(result.vm?.profileId).toBe('development');
    });

    it('should create a VM with custom config', async () => {
      const options: CreateVMOptions = {
        name: 'custom-vm',
        config: {
          name: 'custom-vm',
          cpus: 4,
          memory: '4GB',
          disk: '20GB',
          image: 'alpine-3.22'
        },
        resources: {
          cpuCores: 4,
          memoryMB: 4096,
          diskMB: 20480
        },
        autoStart: false
      };

      const result = await poolManager.createVM(options);

      expect(result.success).toBe(true);
      expect(result.vm?.resources.cpuCores).toBe(4);
      expect(result.vm?.resources.memoryMB).toBe(4096);
    });

    it('should auto-generate name if not provided', async () => {
      const options: CreateVMOptions = {
        profileId: 'minimal',
        autoStart: false
      };

      const result = await poolManager.createVM(options);

      expect(result.success).toBe(true);
      expect(result.vm?.name).toMatch(/^vm-/);
    });

    it('should respect resource limits', async () => {
      // Create VMs up to the limit
      for (let i = 0; i < 4; i++) {
        await poolManager.createVM({
          name: `vm-${i}`,
          profileId: 'minimal',
          autoStart: false
        });
      }

      // Fifth VM should fail
      const result = await poolManager.createVM({
        name: 'vm-overflow',
        profileId: 'minimal',
        autoStart: false
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RESOURCE_LIMIT_EXCEEDED');
    });

    it('should allocate ports for the VM', async () => {
      const result = await poolManager.createVM({
        name: 'vm-with-ports',
        profileId: 'development',
        autoStart: false
      });

      expect(result.success).toBe(true);
      expect(result.vm?.ports.length).toBeGreaterThan(0);
    });

    it('should associate VM with project', async () => {
      const result = await poolManager.createVM({
        name: 'project-vm',
        profileId: 'development',
        project: {
          id: 'proj-123',
          name: 'Test Project',
          path: '/home/user/projects/test'
        },
        autoStart: false
      });

      expect(result.success).toBe(true);
      expect(result.vm?.project?.id).toBe('proj-123');
      expect(result.vm?.project?.name).toBe('Test Project');
    });
  });

  describe('VM lifecycle', () => {
    let vmId: string;

    beforeEach(async () => {
      const result = await poolManager.createVM({
        name: 'lifecycle-vm',
        profileId: 'minimal',
        autoStart: false
      });
      vmId = result.vm!.id;
    });

    it('should start a stopped VM', async () => {
      const result = await poolManager.startVM(vmId);

      expect(result.success).toBe(true);
      expect(result.vm?.status.status).toBe('running');
    });

    it('should stop a running VM', async () => {
      await poolManager.startVM(vmId);
      const result = await poolManager.stopVM(vmId);

      expect(result.success).toBe(true);
      expect(result.vm?.status.status).toBe('stopped');
    });

    it('should delete a VM', async () => {
      const result = await poolManager.deleteVM(vmId);

      expect(result.success).toBe(true);
      expect(poolManager.getVM(vmId)).toBeUndefined();
    });

    it('should return error for non-existent VM', async () => {
      const result = await poolManager.startVM('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VM_NOT_FOUND');
    });
  });

  describe('cloneVM', () => {
    let sourceVmId: string;

    beforeEach(async () => {
      const result = await poolManager.createVM({
        name: 'source-vm',
        profileId: 'development',
        tags: ['original'],
        autoStart: false
      });
      sourceVmId = result.vm!.id;
    });

    it('should clone an existing VM', async () => {
      const result = await poolManager.cloneVM(sourceVmId, {
        name: 'cloned-vm'
      });

      expect(result.success).toBe(true);
      expect(result.vm?.name).toBe('cloned-vm');
      expect(result.vm?.profileId).toBe('development');
    });

    it('should auto-generate clone name', async () => {
      const result = await poolManager.cloneVM(sourceVmId);

      expect(result.success).toBe(true);
      expect(result.vm?.name).toBe('source-vm-clone');
    });

    it('should fail for non-existent source VM', async () => {
      const result = await poolManager.cloneVM('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VM_NOT_FOUND');
    });

    it('should allow custom tags for clone', async () => {
      const result = await poolManager.cloneVM(sourceVmId, {
        tags: ['cloned', 'test']
      });

      expect(result.success).toBe(true);
      expect(result.vm?.tags).toContain('cloned');
      expect(result.vm?.tags).toContain('test');
    });
  });

  describe('listVMs', () => {
    beforeEach(async () => {
      await poolManager.createVM({
        name: 'dev-vm-1',
        profileId: 'development',
        tags: ['dev'],
        autoStart: false
      });
      await poolManager.createVM({
        name: 'test-vm-1',
        profileId: 'testing',
        tags: ['test'],
        autoStart: false
      });
      await poolManager.createVM({
        name: 'min-vm-1',
        profileId: 'minimal',
        tags: ['minimal'],
        autoStart: false
      });
    });

    it('should list all VMs', () => {
      const vms = poolManager.listVMs();
      expect(vms.length).toBe(3);
    });

    it('should filter by status', async () => {
      // Start one VM
      const allVMs = poolManager.listVMs();
      await poolManager.startVM(allVMs[0].id);

      const runningVMs = poolManager.listVMs({ status: 'running' });
      expect(runningVMs.length).toBe(1);

      const stoppedVMs = poolManager.listVMs({ status: 'stopped' });
      expect(stoppedVMs.length).toBe(2);
    });

    it('should filter by tags', () => {
      const devVMs = poolManager.listVMs({ tags: ['dev'] });
      expect(devVMs.length).toBe(1);
      expect(devVMs[0].name).toBe('dev-vm-1');
    });

    it('should sort by name', () => {
      const vms = poolManager.listVMs({
        sortBy: 'name',
        sortOrder: 'asc'
      });

      expect(vms[0].name).toBe('dev-vm-1');
      expect(vms[1].name).toBe('min-vm-1');
      expect(vms[2].name).toBe('test-vm-1');
    });

    it('should support pagination', () => {
      const vms = poolManager.listVMs({
        limit: 2,
        offset: 0
      });

      expect(vms.length).toBe(2);
    });
  });

  describe('resource management', () => {
    it('should track resource usage', async () => {
      await poolManager.createVM({
        name: 'resource-vm',
        profileId: 'development',
        autoStart: false
      });

      const usage = poolManager.getResourceUsage();

      expect(usage.cpuCoresUsed).toBeGreaterThan(0);
      expect(usage.memoryUsedMB).toBeGreaterThan(0);
      expect(usage.diskUsedMB).toBeGreaterThan(0);
    });

    it('should return correct limits', () => {
      const limits = poolManager.getLimits();

      expect(limits.maxVMs).toBe(4);
      expect(limits.maxTotalCPU).toBe(8);
      expect(limits.maxTotalMemoryMB).toBe(8192);
    });

    it('should update limits', () => {
      poolManager.setLimits({ maxVMs: 8 });

      const limits = poolManager.getLimits();
      expect(limits.maxVMs).toBe(8);
    });

    it('should get system resources', async () => {
      const resources = await poolManager.getSystemResources();

      expect(resources.totalCPU).toBeGreaterThan(0);
      expect(resources.totalMemoryMB).toBeGreaterThan(0);
    });
  });

  describe('pool state', () => {
    it('should return complete pool state', async () => {
      await poolManager.createVM({
        name: 'state-vm',
        profileId: 'minimal',
        autoStart: false
      });

      const state = await poolManager.getPoolState();

      expect(state.instances.length).toBe(1);
      expect(state.resourceUsage).toBeDefined();
      expect(state.limits).toBeDefined();
      expect(state.systemResources).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should save state on shutdown', async () => {
      await poolManager.createVM({
        name: 'shutdown-vm',
        profileId: 'minimal',
        autoStart: false
      });

      await expect(poolManager.shutdown()).resolves.not.toThrow();
    });
  });
});
