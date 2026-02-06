/**
 * Port Manager Tests
 * Tests for port allocation and management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PortManager, resetPortManager, SERVICE_PORTS } from '../port-manager';

// Mock net module for port availability checks
vi.mock('net', () => ({
  createServer: vi.fn(() => ({
    once: vi.fn((event, callback) => {
      if (event === 'listening') {
        // Simulate port is available
        setTimeout(() => callback(), 0);
      }
    }),
    listen: vi.fn(),
    close: vi.fn()
  }))
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

describe('PortManager', () => {
  let portManager: PortManager;

  beforeEach(() => {
    resetPortManager();
    portManager = new PortManager({
      portRange: { start: 10000, end: 10100 },
      checkPortAvailability: false // Disable system checks for tests
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('allocatePort', () => {
    it('should allocate a port for a VM', async () => {
      const result = await portManager.allocatePort('vm-1', 8080);

      expect(result.success).toBe(true);
      expect(result.hostPort).toBeDefined();
      expect(result.hostPort).toBeGreaterThanOrEqual(10000);
      expect(result.hostPort).toBeLessThanOrEqual(10100);
    });

    it('should use preferred port when available', async () => {
      const result = await portManager.allocatePort('vm-1', 8080, {
        preferredHostPort: 10050
      });

      expect(result.success).toBe(true);
      expect(result.hostPort).toBe(10050);
    });

    it('should find alternative when preferred port is taken', async () => {
      // Allocate the preferred port first
      await portManager.allocatePort('vm-1', 8080, { preferredHostPort: 10050 });

      // Try to allocate same preferred port for another VM
      const result = await portManager.allocatePort('vm-2', 8080, {
        preferredHostPort: 10050
      });

      expect(result.success).toBe(true);
      expect(result.hostPort).not.toBe(10050);
    });

    it('should track service name', async () => {
      await portManager.allocatePort('vm-1', 22, {
        service: 'SSH'
      });

      const mappings = portManager.getPortMappings('vm-1');
      expect(mappings[0].service).toBe('SSH');
    });

    it('should mark auto-allocated ports', async () => {
      const result = await portManager.allocatePort('vm-1', 3000);

      const mappings = portManager.getPortMappings('vm-1');
      expect(mappings[0].autoAllocated).toBe(true);
    });
  });

  describe('allocatePorts', () => {
    it('should allocate multiple ports', async () => {
      const result = await portManager.allocatePorts('vm-1', [
        { guestPort: 22, service: 'SSH' },
        { guestPort: 80, service: 'HTTP' },
        { guestPort: 443, service: 'HTTPS' }
      ]);

      expect(result.success).toBe(true);
      expect(result.mappings.length).toBe(3);
      expect(result.errors.length).toBe(0);
    });

    it('should return errors for failed allocations', async () => {
      // Fill up most ports
      const smallManager = new PortManager({
        portRange: { start: 10000, end: 10002 },
        checkPortAvailability: false
      });

      // Allocate all available ports
      await smallManager.allocatePort('vm-1', 1);
      await smallManager.allocatePort('vm-1', 2);
      await smallManager.allocatePort('vm-1', 3);

      // Try to allocate more
      const result = await smallManager.allocatePorts('vm-2', [
        { guestPort: 4 },
        { guestPort: 5 }
      ]);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('releasePort', () => {
    it('should release an allocated port', async () => {
      const allocation = await portManager.allocatePort('vm-1', 8080);
      const hostPort = allocation.hostPort!;

      const released = portManager.releasePort(hostPort);

      expect(released).toBe(true);
      expect(portManager.getAllAllocatedPorts().has(hostPort)).toBe(false);
    });

    it('should return false for non-allocated port', () => {
      const released = portManager.releasePort(99999);
      expect(released).toBe(false);
    });
  });

  describe('releaseAllPorts', () => {
    it('should release all ports for a VM', async () => {
      await portManager.allocatePorts('vm-1', [
        { guestPort: 22 },
        { guestPort: 80 },
        { guestPort: 443 }
      ]);

      const releasedCount = portManager.releaseAllPorts('vm-1');

      expect(releasedCount).toBe(3);
      expect(portManager.getPortMappings('vm-1').length).toBe(0);
    });

    it('should return 0 for VM with no ports', () => {
      const releasedCount = portManager.releaseAllPorts('non-existent');
      expect(releasedCount).toBe(0);
    });
  });

  describe('getPortMappings', () => {
    it('should return all mappings for a VM', async () => {
      await portManager.allocatePorts('vm-1', [
        { guestPort: 22, service: 'SSH' },
        { guestPort: 80, service: 'HTTP' }
      ]);

      const mappings = portManager.getPortMappings('vm-1');

      expect(mappings.length).toBe(2);
      expect(mappings.find(m => m.guest === 22)).toBeDefined();
      expect(mappings.find(m => m.guest === 80)).toBeDefined();
    });

    it('should return empty array for VM with no ports', () => {
      const mappings = portManager.getPortMappings('non-existent');
      expect(mappings).toEqual([]);
    });
  });

  describe('isPortAvailable', () => {
    it('should return false for allocated port', async () => {
      const allocation = await portManager.allocatePort('vm-1', 8080);

      const available = await portManager.isPortAvailable(allocation.hostPort!);

      expect(available).toBe(false);
    });

    it('should return false for reserved ports', async () => {
      const available = await portManager.isPortAvailable(22);
      expect(available).toBe(false);
    });

    it('should return true for available port', async () => {
      const available = await portManager.isPortAvailable(15000);
      expect(available).toBe(true);
    });
  });

  describe('resolveConflicts', () => {
    it('should detect and resolve port conflicts', async () => {
      // Allocate port for vm-1
      await portManager.allocatePort('vm-1', 8080, { preferredHostPort: 10050 });

      // Try same port for vm-2
      const { resolved, conflicts } = await portManager.resolveConflicts('vm-2', [
        { guest: 8080, host: 10050, protocol: 'tcp' }
      ]);

      expect(conflicts.length).toBe(1);
      expect(resolved.length).toBe(1);
      expect(resolved[0].host).not.toBe(10050);
    });

    it('should not flag non-conflicting ports', async () => {
      const { resolved, conflicts } = await portManager.resolveConflicts('vm-1', [
        { guest: 8080, host: 10050, protocol: 'tcp' }
      ]);

      expect(conflicts.length).toBe(0);
      expect(resolved.length).toBe(1);
      expect(resolved[0].host).toBe(10050);
    });
  });

  describe('suggestPortForService', () => {
    it('should suggest correct port for SSH', () => {
      expect(portManager.suggestPortForService('ssh')).toBe(22);
    });

    it('should suggest correct port for HTTP', () => {
      expect(portManager.suggestPortForService('http')).toBe(80);
    });

    it('should suggest correct port for PostgreSQL', () => {
      expect(portManager.suggestPortForService('postgresql')).toBe(5432);
      expect(portManager.suggestPortForService('postgres')).toBe(5432);
    });

    it('should return undefined for unknown service', () => {
      expect(portManager.suggestPortForService('unknown')).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      expect(portManager.suggestPortForService('SSH')).toBe(22);
      expect(portManager.suggestPortForService('Ssh')).toBe(22);
    });
  });

  describe('getPortStats', () => {
    it('should return correct statistics', async () => {
      await portManager.allocatePorts('vm-1', [
        { guestPort: 22 },
        { guestPort: 80 }
      ]);
      await portManager.allocatePort('vm-2', 443);

      const stats = portManager.getPortStats();

      expect(stats.totalAllocated).toBe(3);
      expect(stats.totalAvailable).toBe(101 - 3); // Range is 10000-10100
      expect(stats.portsByVm.get('vm-1')).toBe(2);
      expect(stats.portsByVm.get('vm-2')).toBe(1);
    });
  });

  describe('import/export', () => {
    it('should export allocations', async () => {
      await portManager.allocatePorts('vm-1', [
        { guestPort: 22, service: 'SSH' }
      ]);

      const exported = portManager.exportAllocations();

      expect(exported.length).toBe(1);
      expect(exported[0].vmId).toBe('vm-1');
      expect(exported[0].mappings.length).toBe(1);
    });

    it('should import allocations', () => {
      const allocations = [
        {
          vmId: 'vm-1',
          mappings: [
            { guest: 22, host: 10022, protocol: 'tcp' as const, service: 'SSH' }
          ]
        }
      ];

      portManager.importAllocations(allocations);

      const mappings = portManager.getPortMappings('vm-1');
      expect(mappings.length).toBe(1);
      expect(mappings[0].guest).toBe(22);
      expect(mappings[0].host).toBe(10022);
    });
  });

  describe('port range', () => {
    it('should get current port range', () => {
      const range = portManager.getPortRange();

      expect(range.start).toBe(10000);
      expect(range.end).toBe(10100);
    });

    it('should update port range', () => {
      portManager.setPortRange({ start: 20000, end: 30000 });

      const range = portManager.getPortRange();

      expect(range.start).toBe(20000);
      expect(range.end).toBe(30000);
    });
  });

  describe('SERVICE_PORTS', () => {
    it('should have common services defined', () => {
      expect(SERVICE_PORTS['ssh']).toBe(22);
      expect(SERVICE_PORTS['http']).toBe(80);
      expect(SERVICE_PORTS['https']).toBe(443);
      expect(SERVICE_PORTS['mysql']).toBe(3306);
      expect(SERVICE_PORTS['postgresql']).toBe(5432);
      expect(SERVICE_PORTS['redis']).toBe(6379);
      expect(SERVICE_PORTS['mongodb']).toBe(27017);
    });
  });
});
