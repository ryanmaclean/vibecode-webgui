/**
 * Snapshot Manager Tests
 *
 * Unit tests for the VM snapshot manager functionality.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SnapshotManager, resetSnapshotManager } from '../snapshot-manager';
import { SnapshotStorage, resetSnapshotStorage } from '../snapshot-storage';
import type { SnapshotOptions, SnapshotInfo } from '@/types/vm-snapshot';
import type { VMStatus, VMConfig } from '../../types';

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SnapshotManager', () => {
  let manager: SnapshotManager;
  let storage: SnapshotStorage;
  let testDir: string;
  let vmDir: string;
  let snapshotDir: string;

  beforeEach(async () => {
    // Reset singletons
    resetSnapshotManager();
    resetSnapshotStorage();

    // Create temporary directories
    testDir = path.join(os.tmpdir(), `snapshot-test-${Date.now()}`);
    vmDir = path.join(testDir, 'vms', 'test-vm');
    snapshotDir = path.join(testDir, 'snapshots');

    await fs.mkdir(vmDir, { recursive: true });
    await fs.mkdir(path.join(vmDir, 'disk'), { recursive: true });
    await fs.mkdir(snapshotDir, { recursive: true });

    // Create a mock disk image
    const diskPath = path.join(vmDir, 'disk', 'root.img');
    await fs.writeFile(diskPath, 'mock disk content');

    // Create a mock config
    const config: VMConfig = {
      name: 'test-vm',
      cpus: 4,
      memory: '4GB',
      disk: '20GB',
      image: 'alpine-3.22',
      arch: 'arm64',
    };
    await fs.writeFile(path.join(vmDir, 'config.json'), JSON.stringify(config));

    // Create a mock PID file (to simulate running VM)
    await fs.writeFile(path.join(vmDir, 'vm.pid'), '12345');

    // Create storage and manager with test directories
    storage = new SnapshotStorage({ baseDir: snapshotDir });
    manager = new SnapshotManager(storage);

    // Override vmBaseDir
    (manager as any).vmBaseDir = path.join(testDir, 'vms');

    await manager.initialize();
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createSnapshot', () => {
    it('should create a snapshot successfully', async () => {
      const result = await manager.createSnapshot(
        'test-vm',
        'Test Snapshot',
        'A test snapshot',
        { includeDisk: true, includeMemory: false, compress: false }
      );

      expect(result.success).toBe(true);
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot?.name).toBe('Test Snapshot');
      expect(result.snapshot?.description).toBe('A test snapshot');
      expect(result.snapshot?.state).toBe('ready');
      expect(result.snapshot?.includesDisk).toBe(true);
      expect(result.snapshot?.includesMemory).toBe(false);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should fail for non-existent VM', async () => {
      const result = await manager.createSnapshot(
        'non-existent-vm',
        'Test Snapshot'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('VM not found');
    });

    it('should emit events during snapshot creation', async () => {
      const events: string[] = [];
      manager.addEventListener((event) => {
        events.push(event.type);
      });

      await manager.createSnapshot('test-vm', 'Event Test', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });

      expect(events).toContain('snapshot:creating');
      expect(events).toContain('snapshot:created');
    });
  });

  describe('listSnapshots', () => {
    it('should return empty list initially', async () => {
      const response = await manager.listSnapshots();

      expect(response.snapshots).toHaveLength(0);
      expect(response.total).toBe(0);
      expect(response.totalSize).toBe(0);
    });

    it('should return created snapshots', async () => {
      await manager.createSnapshot('test-vm', 'Snapshot 1', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });
      await manager.createSnapshot('test-vm', 'Snapshot 2', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });

      const response = await manager.listSnapshots();

      expect(response.snapshots).toHaveLength(2);
      expect(response.total).toBe(2);
      expect(response.totalSize).toBeGreaterThan(0);
    });
  });

  describe('listSnapshotsForVM', () => {
    it('should filter snapshots by VM ID', async () => {
      await manager.createSnapshot('test-vm', 'VM1 Snapshot', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });

      const snapshots = await manager.listSnapshotsForVM('test-vm');

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].vmId).toBe('test-vm');
    });

    it('should return empty for unknown VM', async () => {
      const snapshots = await manager.listSnapshotsForVM('unknown-vm');
      expect(snapshots).toHaveLength(0);
    });
  });

  describe('getSnapshot', () => {
    it('should return snapshot by ID', async () => {
      const createResult = await manager.createSnapshot('test-vm', 'Get Test', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });

      const snapshot = await manager.getSnapshot(createResult.snapshot!.id);

      expect(snapshot).toBeDefined();
      expect(snapshot?.id).toBe(createResult.snapshot!.id);
      expect(snapshot?.name).toBe('Get Test');
    });

    it('should return null for unknown ID', async () => {
      const snapshot = await manager.getSnapshot('unknown-id');
      expect(snapshot).toBeNull();
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete snapshot successfully', async () => {
      const createResult = await manager.createSnapshot('test-vm', 'Delete Test', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });
      const snapshotId = createResult.snapshot!.id;

      const deleteResult = await manager.deleteSnapshot(snapshotId);

      expect(deleteResult.success).toBe(true);

      const snapshot = await manager.getSnapshot(snapshotId);
      expect(snapshot).toBeNull();
    });

    it('should fail for non-existent snapshot', async () => {
      const result = await manager.deleteSnapshot('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should emit delete event', async () => {
      const createResult = await manager.createSnapshot('test-vm', 'Delete Event Test', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });

      const events: string[] = [];
      manager.addEventListener((event) => {
        events.push(event.type);
      });

      await manager.deleteSnapshot(createResult.snapshot!.id);

      expect(events).toContain('snapshot:deleted');
    });
  });

  describe('restoreSnapshot', () => {
    it('should restore snapshot with mock provider', async () => {
      const createResult = await manager.createSnapshot('test-vm', 'Restore Test', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });

      // Create mock provider
      const mockProvider = {
        status: jest.fn().mockResolvedValue('stopped' as VMStatus),
        stop: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue(undefined),
      };

      const restoreResult = await manager.restoreSnapshot(
        createResult.snapshot!.id,
        'test-vm',
        mockProvider
      );

      expect(restoreResult.success).toBe(true);
      expect(mockProvider.start).toHaveBeenCalledWith('test-vm');
    });

    it('should fail for non-existent snapshot', async () => {
      const result = await manager.restoreSnapshot('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('estimateSnapshotSize', () => {
    it('should return size estimate', async () => {
      const estimate = await manager.estimateSnapshotSize('test-vm', {
        includeDisk: true,
        includeMemory: false,
        compress: true,
      });

      expect(estimate).toBeDefined();
      expect(estimate.diskSize).toBeGreaterThan(0);
      expect(estimate.uncompressedSize).toBeGreaterThan(0);
      expect(estimate.compressedSize).toBeLessThanOrEqual(estimate.uncompressedSize);
      expect(typeof estimate.hasEnoughSpace).toBe('boolean');
    });
  });

  describe('createAutoSnapshot', () => {
    it('should create auto-snapshot with operation name', async () => {
      const result = await manager.createAutoSnapshot('test-vm', 'upgrade');

      expect(result.success).toBe(true);
      expect(result.snapshot?.name).toContain('auto-upgrade');
      expect(result.snapshot?.description).toContain('Automatic snapshot before upgrade');
    });
  });

  describe('cleanup', () => {
    it('should run cleanup without errors', async () => {
      await manager.createSnapshot('test-vm', 'Cleanup Test', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });

      const result = await manager.cleanup();

      expect(result).toBeDefined();
      expect(Array.isArray(result.removed)).toBe(true);
      expect(typeof result.freedSpace).toBe('number');
    });
  });

  describe('event handling', () => {
    it('should add and remove event listeners', async () => {
      const listener = jest.fn();

      manager.addEventListener(listener);
      await manager.createSnapshot('test-vm', 'Event Listener Test', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });

      expect(listener).toHaveBeenCalled();

      listener.mockClear();
      manager.removeEventListener(listener);

      await manager.createSnapshot('test-vm', 'After Remove Test', undefined, {
        includeDisk: true,
        includeMemory: false,
        compress: false,
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('SnapshotStorage', () => {
  let storage: SnapshotStorage;
  let testDir: string;

  beforeEach(async () => {
    resetSnapshotStorage();

    testDir = path.join(os.tmpdir(), `storage-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    storage = new SnapshotStorage({ baseDir: testDir });
    await storage.initialize();
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialize', () => {
    it('should create base directory', async () => {
      const newDir = path.join(testDir, 'new-storage');
      const newStorage = new SnapshotStorage({ baseDir: newDir });
      await newStorage.initialize();

      const exists = await fs.access(newDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create index file', async () => {
      const indexPath = path.join(testDir, 'index.json');
      const exists = await fs.access(indexPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('createSnapshotDirectory', () => {
    it('should create directory for snapshot', async () => {
      const snapshotId = 'test-snapshot-id';
      const snapshotPath = await storage.createSnapshotDirectory(snapshotId);

      const exists = await fs.access(snapshotPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      expect(snapshotPath).toContain(snapshotId);
    });
  });

  describe('index operations', () => {
    it('should add and retrieve snapshots from index', async () => {
      const mockSnapshot: SnapshotInfo = {
        id: 'test-id',
        name: 'Test Snapshot',
        createdAt: new Date(),
        size: 1024,
        state: 'ready',
        vmId: 'test-vm',
        vmName: 'test-vm',
        includesDisk: true,
        includesMemory: false,
        compressed: false,
        path: '/test/path',
        metadata: {
          services: [],
          ports: [],
          environment: {},
          vmConfig: {
            cpus: 4,
            memory: 4294967296,
            diskSize: 21474836480,
            arch: 'arm64',
            provider: 'vfkit',
            image: 'alpine-3.22',
          },
          hostInfo: {
            os: 'darwin',
            osVersion: '14.0',
            arch: 'arm64',
            hostname: 'test-host',
          },
          vibecodeVersion: '1.0.0',
        },
      };

      await storage.addToIndex(mockSnapshot);

      const retrieved = await storage.getSnapshot('test-id');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Snapshot');
    });

    it('should update snapshots in index', async () => {
      const mockSnapshot: SnapshotInfo = {
        id: 'update-test',
        name: 'Original Name',
        createdAt: new Date(),
        size: 1024,
        state: 'creating',
        vmId: 'test-vm',
        vmName: 'test-vm',
        includesDisk: true,
        includesMemory: false,
        compressed: false,
        path: '/test/path',
        metadata: {
          services: [],
          ports: [],
          environment: {},
          vmConfig: {
            cpus: 4,
            memory: 4294967296,
            diskSize: 21474836480,
            arch: 'arm64',
            provider: 'vfkit',
            image: 'alpine-3.22',
          },
          hostInfo: {
            os: 'darwin',
            osVersion: '14.0',
            arch: 'arm64',
            hostname: 'test-host',
          },
          vibecodeVersion: '1.0.0',
        },
      };

      await storage.addToIndex(mockSnapshot);
      await storage.updateInIndex('update-test', { state: 'ready', size: 2048 });

      const updated = await storage.getSnapshot('update-test');
      expect(updated?.state).toBe('ready');
      expect(updated?.size).toBe(2048);
    });

    it('should remove snapshots from index', async () => {
      const mockSnapshot: SnapshotInfo = {
        id: 'remove-test',
        name: 'To Remove',
        createdAt: new Date(),
        size: 1024,
        state: 'ready',
        vmId: 'test-vm',
        vmName: 'test-vm',
        includesDisk: true,
        includesMemory: false,
        compressed: false,
        path: '/test/path',
        metadata: {
          services: [],
          ports: [],
          environment: {},
          vmConfig: {
            cpus: 4,
            memory: 4294967296,
            diskSize: 21474836480,
            arch: 'arm64',
            provider: 'vfkit',
            image: 'alpine-3.22',
          },
          hostInfo: {
            os: 'darwin',
            osVersion: '14.0',
            arch: 'arm64',
            hostname: 'test-host',
          },
          vibecodeVersion: '1.0.0',
        },
      };

      await storage.addToIndex(mockSnapshot);
      await storage.removeFromIndex('remove-test');

      const removed = await storage.getSnapshot('remove-test');
      expect(removed).toBeNull();
    });
  });

  describe('listSnapshots', () => {
    it('should return sorted list of snapshots', async () => {
      const now = new Date();
      const older = new Date(now.getTime() - 10000);

      const createMockSnapshot = (id: string, name: string, date: Date): SnapshotInfo => ({
        id,
        name,
        createdAt: date,
        size: 1024,
        state: 'ready',
        vmId: 'test-vm',
        vmName: 'test-vm',
        includesDisk: true,
        includesMemory: false,
        compressed: false,
        path: '/test/path',
        metadata: {
          services: [],
          ports: [],
          environment: {},
          vmConfig: {
            cpus: 4,
            memory: 4294967296,
            diskSize: 21474836480,
            arch: 'arm64',
            provider: 'vfkit',
            image: 'alpine-3.22',
          },
          hostInfo: {
            os: 'darwin',
            osVersion: '14.0',
            arch: 'arm64',
            hostname: 'test-host',
          },
          vibecodeVersion: '1.0.0',
        },
      });

      await storage.addToIndex(createMockSnapshot('older', 'Older', older));
      await storage.addToIndex(createMockSnapshot('newer', 'Newer', now));

      const snapshots = await storage.listSnapshots();

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].id).toBe('newer'); // Newer first (sorted by createdAt desc)
    });
  });

  describe('getSnapshotsForVM', () => {
    it('should filter by VM ID', async () => {
      const createMockSnapshot = (id: string, vmId: string): SnapshotInfo => ({
        id,
        name: id,
        createdAt: new Date(),
        size: 1024,
        state: 'ready',
        vmId,
        vmName: vmId,
        includesDisk: true,
        includesMemory: false,
        compressed: false,
        path: '/test/path',
        metadata: {
          services: [],
          ports: [],
          environment: {},
          vmConfig: {
            cpus: 4,
            memory: 4294967296,
            diskSize: 21474836480,
            arch: 'arm64',
            provider: 'vfkit',
            image: 'alpine-3.22',
          },
          hostInfo: {
            os: 'darwin',
            osVersion: '14.0',
            arch: 'arm64',
            hostname: 'test-host',
          },
          vibecodeVersion: '1.0.0',
        },
      });

      await storage.addToIndex(createMockSnapshot('snap1', 'vm1'));
      await storage.addToIndex(createMockSnapshot('snap2', 'vm1'));
      await storage.addToIndex(createMockSnapshot('snap3', 'vm2'));

      const vm1Snapshots = await storage.getSnapshotsForVM('vm1');
      expect(vm1Snapshots).toHaveLength(2);

      const vm2Snapshots = await storage.getSnapshotsForVM('vm2');
      expect(vm2Snapshots).toHaveLength(1);
    });
  });

  describe('calculateChecksum', () => {
    it('should calculate SHA-256 checksum', async () => {
      const testFile = path.join(testDir, 'checksum-test.txt');
      await fs.writeFile(testFile, 'test content');

      const checksum = await storage.calculateChecksum(testFile);

      expect(checksum).toBeDefined();
      expect(checksum.length).toBe(64); // SHA-256 produces 64 hex chars
    });
  });

  describe('verifyIntegrity', () => {
    it('should verify correct checksum', async () => {
      const testFile = path.join(testDir, 'integrity-test.txt');
      await fs.writeFile(testFile, 'test content');

      const checksum = await storage.calculateChecksum(testFile);
      const valid = await storage.verifyIntegrity(testFile, checksum);

      expect(valid).toBe(true);
    });

    it('should reject incorrect checksum', async () => {
      const testFile = path.join(testDir, 'integrity-test2.txt');
      await fs.writeFile(testFile, 'test content');

      const valid = await storage.verifyIntegrity(testFile, 'invalid-checksum');

      expect(valid).toBe(false);
    });
  });

  describe('calculateDirectorySize', () => {
    it('should calculate total size of directory', async () => {
      const subDir = path.join(testDir, 'size-test');
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(path.join(subDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(subDir, 'file2.txt'), 'content2');

      const size = await storage.calculateDirectorySize(subDir);

      expect(size).toBeGreaterThan(0);
    });
  });

  describe('settings', () => {
    it('should return current settings', () => {
      const settings = storage.getSettings();

      expect(settings).toBeDefined();
      expect(settings.baseDir).toBe(testDir);
      expect(settings.maxSnapshots).toBeDefined();
      expect(settings.defaultCompression).toBeDefined();
    });

    it('should update settings', async () => {
      await storage.updateSettings({ maxSnapshots: 50 });

      const settings = storage.getSettings();
      expect(settings.maxSnapshots).toBe(50);
    });
  });
});
