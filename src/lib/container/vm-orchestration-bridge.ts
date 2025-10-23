/**
 * VM Orchestration Bridge - TypeScript integration with Swift VMPoolManager
 *
 * This module provides a TypeScript interface to the Swift VM orchestration layer.
 * It uses either HTTP REST API (via vmorchd daemon) or native Node.js bindings.
 *
 * Architecture:
 * ```
 * TypeScript (Next.js)  →  HTTP/Native Bridge  →  Swift VMPoolManager  →  Virtualization.framework
 * ```
 *
 * @module vm-orchestration-bridge
 */

import { EventEmitter } from 'events'
// import { logger } from '@/lib/logger';
/**
 * VM instance information returned from orchestration layer
 */
export interface VMInstance {
  /** Unique VM identifier */
  id: string

  /** VM IP address (192.168.64.x) */
  ipAddress: string

  /** AgentAPI base URL (http://192.168.64.x:3284) */
  agentApiUrl: string

  /** Workspace directory on host */
  workspaceUrl: string

  /** VM allocation timestamp */
  allocatedAt: Date

  /** VM state (running, stopped, error) */
  state: 'running' | 'stopped' | 'error'

  /** CPU count (vCPUs) */
  cpuCount: number

  /** Memory size in bytes */
  memorySize: number

  /** Disk size in bytes */
  diskSize: number

  /** Usage count (for recycling decisions) */
  usageCount: number
}

/**
 * VM pool statistics
 */
export interface PoolStatistics {
  /** Available pre-warmed VMs */
  availableVMs: number

  /** Active VMs in use */
  activeVMs: number

  /** Total VMs (available + active) */
  totalVMs: number

  /** Number of hot allocations from pool */
  hotAllocations: number

  /** Number of cold boots (pool exhausted) */
  coldBootCount: number

  /** Number of VMs recycled */
  recycledVMs: number

  /** Average allocation latency (ms) */
  averageAllocationLatency: number

  /** Average release latency (ms) */
  averageReleaseLatency: number

  /** Pool warm time (seconds) */
  poolWarmTime: number
}

/**
 * VM metrics for monitoring
 */
export interface VMMetrics {
  /** VM identifier */
  vmId: string

  /** CPU usage (0.0-1.0) */
  cpuUsage: number

  /** Memory usage in bytes */
  memoryUsage: number

  /** Disk read bytes/sec */
  diskReadBps: number

  /** Disk write bytes/sec */
  diskWriteBps: number

  /** Network receive bytes/sec */
  networkRxBps: number

  /** Network transmit bytes/sec */
  networkTxBps: number

  /** VM uptime in seconds */
  uptimeSeconds: number
}

/**
 * VM pool configuration
 */
export interface VMPoolConfig {
  /** Target number of pre-warmed VMs */
  poolSize?: number

  /** Maximum number of total VMs */
  maxVMs?: number

  /** Number of uses before VM recycling */
  vmRecycleLimit?: number

  /** Boot timeout in seconds */
  bootTimeout?: number

  /** Per-VM CPU count */
  cpuCount?: number

  /** Per-VM memory in bytes */
  memorySize?: number

  /** Per-VM disk size in bytes */
  diskSize?: number
}

/**
 * VM Orchestration Bridge
 *
 * Provides TypeScript interface to Swift VM orchestration layer.
 * Supports both HTTP (via vmorchd daemon) and native bindings.
 *
 * @example
 * ```typescript
 * // Initialize with HTTP bridge (default)
 * const orchestration = new VMOrchestrationBridge({
 *   mode: 'http',
 *   endpoint: 'http://localhost:8765'
 * });
*
 * // Warm the pool
 * await orchestration.warmPool();
 *
 * // Allocate a VM
 * const vm = await orchestration.allocateVM();
 * console.log(`VM ready at ${vm.agentApiUrl}`);
 *
 * // Use VM...
 * const response = await fetch(`${vm.agentApiUrl}/api/health`);
 *
 * // Release VM back to pool
 * await orchestration.releaseVM(vm.id);
 * ```
 */
export class VMOrchestrationBridge extends EventEmitter {
  private mode: 'http' | 'native'
  private endpoint: string
  private healthCheckInterval?: NodeJS.Timeout

  /**
   * Initialize VM orchestration bridge
   *
   * @param config - Bridge configuration
   */
  constructor(config: {
    mode?: 'http' | 'native'
    endpoint?: string
    poolConfig?: VMPoolConfig
  } = {}) {
    super()

    this.mode = config.mode || 'http'
    this.endpoint = config.endpoint || 'http://localhost:8765'

    // Start health checks
    this.startHealthChecks()
  }

  /**
   * Warm the VM pool (pre-boot VMs)
   *
   * @throws Error if pool warming fails
   */
  async warmPool(): Promise<void> {
    if (this.mode === 'http') {
      const response = await fetch(`${this.endpoint}/api/pool/warm`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to warm pool: ${error.message}`)
      }
    } else {
      // Native binding implementation
      throw new Error('Native mode not yet implemented')
    }

    this.emit('pool:warmed')
  }

  /**
   * Allocate a VM from the pool
   *
   * @returns Allocated VM instance
   * @throws Error if allocation fails
   */
  async allocateVM(): Promise<VMInstance> {
    const startTime = Date.now()

    if (this.mode === 'http') {
      const response = await fetch(`${this.endpoint}/api/vm/allocate`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to allocate VM: ${error.message}`)
      }

      const data = await response.json()
      const vm: VMInstance = {
        id: data.id,
        ipAddress: data.ipAddress,
        agentApiUrl: `http://${data.ipAddress}:3284`,
        workspaceUrl: data.workspaceUrl,
        allocatedAt: new Date(data.allocatedAt),
        state: data.state,
        cpuCount: data.cpuCount,
        memorySize: data.memorySize,
        diskSize: data.diskSize,
        usageCount: data.usageCount
      }

      const latency = Date.now() - startTime
      this.emit('vm:allocated', { vm, latency })

      return vm
    } else {
      // Native binding implementation
      throw new Error('Native mode not yet implemented')
    }
  }

  /**
   * Release a VM back to the pool
   *
   * @param vmId - VM identifier to release
   * @throws Error if release fails
   */
  async releaseVM(vmId: string): Promise<void> {
    if (this.mode === 'http') {
      const response = await fetch(`${this.endpoint}/api/vm/${vmId}/release`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to release VM: ${error.message}`)
      }
    } else {
      // Native binding implementation
      throw new Error('Native mode not yet implemented')
    }

    this.emit('vm:released', { vmId })
  }

  /**
   * Get pool statistics
   *
   * @returns Current pool statistics
   */
  async getStatistics(): Promise<PoolStatistics> {
    if (this.mode === 'http') {
      const response = await fetch(`${this.endpoint}/api/pool/statistics`)

      if (!response.ok) {
        throw new Error('Failed to get pool statistics')
      }

      return await response.json()
    } else {
      // Native binding implementation
      throw new Error('Native mode not yet implemented')
    }
  }

  /**
   * Get VM metrics for monitoring
   *
   * @param vmId - VM identifier
   * @returns VM metrics
   */
  async getVMMetrics(vmId: string): Promise<VMMetrics> {
    if (this.mode === 'http') {
      const response = await fetch(`${this.endpoint}/api/vm/${vmId}/metrics`)

      if (!response.ok) {
        throw new Error(`Failed to get VM metrics: ${vmId}`)
      }

      return await response.json()
    } else {
      // Native binding implementation
      throw new Error('Native mode not yet implemented')
    }
  }

  /**
   * Check if orchestration service is available
   *
   * @returns true if service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      if (this.mode === 'http') {
        const response = await fetch(`${this.endpoint}/health`, {
          signal: AbortSignal.timeout(5000)
        })
        return response.ok
      } else {
        // Native binding health check
        return false
      }
    } catch {
      return false
    }
  }

  /**
   * Start background health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      const healthy = await this.checkHealth()
      if (!healthy) {
        this.emit('health:degraded')
      }
    }, 30000) // Check every 30s
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    this.removeAllListeners()
  }
}

/**
 * Singleton instance for global access
 */
let globalOrchestration: VMOrchestrationBridge | null = null

/**
 * Get or create global orchestration instance
 *
 * @param config - Optional configuration for initialization
 * @returns Global VMOrchestrationBridge instance
 */
export function getVMOrchestration(config?: VMPoolConfig): VMOrchestrationBridge {
  if (!globalOrchestration) {
    globalOrchestration = new VMOrchestrationBridge(config)
  }
  return globalOrchestration
}

/**
 * Helper function to allocate VM with retry logic
 *
 * @param retries - Number of retry attempts (default: 3)
 * @param delay - Delay between retries in ms (default: 1000)
 * @returns Allocated VM instance
 */
export async function allocateVMWithRetry(
  retries = 3,
  delay = 1000
): Promise<VMInstance> {
  const orchestration = getVMOrchestration()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await orchestration.allocateVM()
    } catch (error) {
      if (attempt === retries) {
        throw error
      }

      console.warn(`VM allocation attempt ${attempt} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('VM allocation failed after retries')
}

/**
 * Helper function to release VM with error handling
 *
 * @param vmId - VM identifier to release
 */
export async function releaseVMSafely(vmId: string): Promise<void> {
  try {
    const orchestration = getVMOrchestration()
    await orchestration.releaseVM(vmId)
  } catch (error) {
    console.error(`Failed to release VM ${vmId}:`, error)
    // Don't throw - allow graceful degradation
  }
}
