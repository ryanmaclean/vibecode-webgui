/**
 * Port Manager
 * Manages port allocation and tracking for multi-VM environments
 */

import { createServiceLogger } from '@/lib/logging';
import type { PortMapping, PortRange, PortAllocation } from '@/types/multi-vm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';

const execAsync = promisify(exec);

const log = createServiceLogger({
  service: 'vibecode-vm',
  component: 'port-manager'
});

/**
 * Default port range for VM port allocation
 */
const DEFAULT_PORT_RANGE: PortRange = {
  start: 10000,
  end: 20000,
  protocol: 'tcp'
};

/**
 * Reserved ports that should never be allocated
 */
const RESERVED_PORTS = new Set([
  22,    // SSH
  80,    // HTTP
  443,   // HTTPS
  3000,  // Common dev server
  3306,  // MySQL
  5432,  // PostgreSQL
  6379,  // Redis
  8080,  // Common alternative HTTP
  8443,  // Common alternative HTTPS
  9000,  // PHP-FPM
  27017, // MongoDB
]);

/**
 * Well-known service ports
 */
export const SERVICE_PORTS: Record<string, number> = {
  'ssh': 22,
  'http': 80,
  'https': 443,
  'mysql': 3306,
  'postgresql': 5432,
  'postgres': 5432,
  'redis': 6379,
  'mongodb': 27017,
  'nginx': 80,
  'apache': 80,
  'node': 3000,
  'react': 3000,
  'nextjs': 3000,
  'vite': 5173,
  'webpack': 8080,
};

/**
 * Port Manager for handling VM port allocations
 */
export class PortManager {
  private allocatedPorts: Map<number, string> = new Map(); // hostPort -> vmId
  private vmPortMappings: Map<string, PortMapping[]> = new Map(); // vmId -> ports
  private portRange: PortRange;
  private checkPortAvailability: boolean;

  constructor(options?: {
    portRange?: Partial<PortRange>;
    checkPortAvailability?: boolean;
  }) {
    this.portRange = {
      ...DEFAULT_PORT_RANGE,
      ...options?.portRange
    };
    this.checkPortAvailability = options?.checkPortAvailability ?? true;
  }

  /**
   * Allocate a host port for a VM's guest port
   */
  async allocatePort(
    vmId: string,
    guestPort: number,
    options?: {
      preferredHostPort?: number;
      service?: string;
      protocol?: 'tcp' | 'udp';
    }
  ): Promise<PortAllocation> {
    const { preferredHostPort, service, protocol = 'tcp' } = options || {};

    log.debug('Allocating port', { vmId, guestPort, preferredHostPort, service });

    // Try preferred port first
    if (preferredHostPort) {
      if (await this.isPortAvailable(preferredHostPort)) {
        const mapping = this.createPortMapping(
          vmId,
          guestPort,
          preferredHostPort,
          service,
          protocol,
          false
        );
        return { success: true, hostPort: mapping.host };
      }
      log.warn('Preferred port not available, finding alternative', {
        preferredHostPort
      });
    }

    // Find next available port in range
    const hostPort = await this.findAvailablePort();
    if (!hostPort) {
      return {
        success: false,
        error: 'No available ports in configured range'
      };
    }

    const mapping = this.createPortMapping(
      vmId,
      guestPort,
      hostPort,
      service,
      protocol,
      true
    );

    return { success: true, hostPort: mapping.host };
  }

  /**
   * Allocate multiple ports for a VM
   */
  async allocatePorts(
    vmId: string,
    requests: Array<{
      guestPort: number;
      preferredHostPort?: number;
      service?: string;
      protocol?: 'tcp' | 'udp';
    }>
  ): Promise<{ success: boolean; mappings: PortMapping[]; errors: string[] }> {
    const mappings: PortMapping[] = [];
    const errors: string[] = [];

    for (const request of requests) {
      const result = await this.allocatePort(vmId, request.guestPort, {
        preferredHostPort: request.preferredHostPort,
        service: request.service,
        protocol: request.protocol
      });

      if (result.success && result.hostPort) {
        const mapping = this.vmPortMappings.get(vmId)?.find(
          m => m.host === result.hostPort
        );
        if (mapping) {
          mappings.push(mapping);
        }
      } else {
        errors.push(`Failed to allocate port for guest:${request.guestPort}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      mappings,
      errors
    };
  }

  /**
   * Release a specific port
   */
  releasePort(hostPort: number): boolean {
    const vmId = this.allocatedPorts.get(hostPort);
    if (!vmId) {
      return false;
    }

    this.allocatedPorts.delete(hostPort);

    const vmMappings = this.vmPortMappings.get(vmId);
    if (vmMappings) {
      const index = vmMappings.findIndex(m => m.host === hostPort);
      if (index !== -1) {
        vmMappings.splice(index, 1);
      }
    }

    log.debug('Released port', { hostPort, vmId });
    return true;
  }

  /**
   * Release all ports for a VM
   */
  releaseAllPorts(vmId: string): number {
    const mappings = this.vmPortMappings.get(vmId) || [];
    let releasedCount = 0;

    for (const mapping of mappings) {
      if (this.allocatedPorts.delete(mapping.host)) {
        releasedCount++;
      }
    }

    this.vmPortMappings.delete(vmId);
    log.info('Released all ports for VM', { vmId, releasedCount });
    return releasedCount;
  }

  /**
   * Get all port mappings for a VM
   */
  getPortMappings(vmId: string): PortMapping[] {
    return this.vmPortMappings.get(vmId) || [];
  }

  /**
   * Get all allocated ports
   */
  getAllAllocatedPorts(): Map<number, string> {
    return new Map(this.allocatedPorts);
  }

  /**
   * Check if a port is available
   */
  async isPortAvailable(port: number): Promise<boolean> {
    // Check reserved ports
    if (RESERVED_PORTS.has(port)) {
      return false;
    }

    // Check our allocation map
    if (this.allocatedPorts.has(port)) {
      return false;
    }

    // Check port range
    if (port < this.portRange.start || port > this.portRange.end) {
      // Allow ports outside range if explicitly requested, but still check availability
    }

    // Optionally check system-level availability
    if (this.checkPortAvailability) {
      return await this.checkPortInUse(port);
    }

    return true;
  }

  /**
   * Check if a port is in use at the system level
   */
  private async checkPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false); // Port is in use
      });

      server.once('listening', () => {
        server.close();
        resolve(true); // Port is available
      });

      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Find next available port in range
   */
  private async findAvailablePort(): Promise<number | null> {
    // Start from a random point to distribute ports
    const rangeSize = this.portRange.end - this.portRange.start + 1;
    const startOffset = Math.floor(Math.random() * rangeSize);

    for (let i = 0; i < rangeSize; i++) {
      const port = this.portRange.start + ((startOffset + i) % rangeSize);
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }

    return null;
  }

  /**
   * Create and register a port mapping
   */
  private createPortMapping(
    vmId: string,
    guestPort: number,
    hostPort: number,
    service: string | undefined,
    protocol: 'tcp' | 'udp',
    autoAllocated: boolean
  ): PortMapping {
    const mapping: PortMapping = {
      guest: guestPort,
      host: hostPort,
      protocol,
      service,
      autoAllocated
    };

    // Register allocation
    this.allocatedPorts.set(hostPort, vmId);

    // Add to VM mappings
    if (!this.vmPortMappings.has(vmId)) {
      this.vmPortMappings.set(vmId, []);
    }
    this.vmPortMappings.get(vmId)!.push(mapping);

    log.debug('Created port mapping', { vmId, mapping });
    return mapping;
  }

  /**
   * Suggest a host port for a well-known service
   */
  suggestPortForService(service: string): number | undefined {
    const normalizedService = service.toLowerCase();
    return SERVICE_PORTS[normalizedService];
  }

  /**
   * Resolve port conflicts between VMs
   */
  async resolveConflicts(
    vmId: string,
    requestedMappings: PortMapping[]
  ): Promise<{ resolved: PortMapping[]; conflicts: string[] }> {
    const resolved: PortMapping[] = [];
    const conflicts: string[] = [];

    for (const mapping of requestedMappings) {
      const existingVmId = this.allocatedPorts.get(mapping.host);

      if (existingVmId && existingVmId !== vmId) {
        // Conflict detected
        conflicts.push(
          `Port ${mapping.host} is already allocated to VM ${existingVmId}`
        );

        // Try to find alternative
        const alternative = await this.findAvailablePort();
        if (alternative) {
          resolved.push({
            ...mapping,
            host: alternative,
            autoAllocated: true
          });
        }
      } else {
        resolved.push(mapping);
      }
    }

    return { resolved, conflicts };
  }

  /**
   * Get port usage statistics
   */
  getPortStats(): {
    totalAllocated: number;
    totalAvailable: number;
    utilizationPercent: number;
    portsByVm: Map<string, number>;
  } {
    const rangeSize = this.portRange.end - this.portRange.start + 1;
    const totalAllocated = this.allocatedPorts.size;

    const portsByVm = new Map<string, number>();
    for (const vmId of this.allocatedPorts.values()) {
      portsByVm.set(vmId, (portsByVm.get(vmId) || 0) + 1);
    }

    return {
      totalAllocated,
      totalAvailable: rangeSize - totalAllocated,
      utilizationPercent: (totalAllocated / rangeSize) * 100,
      portsByVm
    };
  }

  /**
   * Import port allocations (for restoring state)
   */
  importAllocations(
    allocations: Array<{ vmId: string; mappings: PortMapping[] }>
  ): void {
    for (const { vmId, mappings } of allocations) {
      this.vmPortMappings.set(vmId, mappings);
      for (const mapping of mappings) {
        this.allocatedPorts.set(mapping.host, vmId);
      }
    }
    log.info('Imported port allocations', {
      vmCount: allocations.length,
      totalPorts: this.allocatedPorts.size
    });
  }

  /**
   * Export port allocations (for persistence)
   */
  exportAllocations(): Array<{ vmId: string; mappings: PortMapping[] }> {
    const result: Array<{ vmId: string; mappings: PortMapping[] }> = [];

    for (const [vmId, mappings] of this.vmPortMappings) {
      result.push({ vmId, mappings: [...mappings] });
    }

    return result;
  }

  /**
   * Set the port range
   */
  setPortRange(range: Partial<PortRange>): void {
    this.portRange = {
      ...this.portRange,
      ...range
    };
    log.info('Updated port range', { portRange: this.portRange });
  }

  /**
   * Get current port range
   */
  getPortRange(): PortRange {
    return { ...this.portRange };
  }
}

// Singleton instance
let portManagerInstance: PortManager | null = null;

/**
 * Get the singleton port manager instance
 */
export function getPortManager(options?: ConstructorParameters<typeof PortManager>[0]): PortManager {
  if (!portManagerInstance) {
    portManagerInstance = new PortManager(options);
  }
  return portManagerInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetPortManager(): void {
  portManagerInstance = null;
}
