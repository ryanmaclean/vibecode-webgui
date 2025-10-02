/**
 * Apple Container Runtime Types
 *
 * Type definitions for Apple Container integration
 */

export interface ContainerOptions {
  /** Port mappings (host:container) */
  ports?: Record<number, number>

  /** Environment variables */
  env?: Record<string, string>

  /** Volume mounts (hostPath:containerPath) */
  volumes?: Record<string, string>

  /** Container name */
  name?: string

  /** Run in detached mode */
  detached?: boolean

  /** Remove container after exit */
  rm?: boolean

  /** CPU count (default: 2) */
  cpus?: number

  /** Memory in MB (default: 2048) */
  memory?: number

  /** Additional arguments */
  args?: string[]
}

export interface ContainerInfo {
  /** Container ID */
  id: string

  /** Container name */
  name: string

  /** Image name */
  image: string

  /** Container state (created, running, stopped, exited) */
  state: string

  /** IP address */
  ipAddress?: string

  /** Port mappings */
  ports?: Record<string, number>

  /** Created timestamp */
  created?: string
}

export interface ContainerStartResult {
  /** Container ID */
  id: string

  /** Container name */
  name: string

  /** Success status */
  success: boolean

  /** Error message if failed */
  error?: string
}

export interface ContainerListResult {
  /** List of containers */
  containers: ContainerInfo[]

  /** Success status */
  success: boolean

  /** Error message if failed */
  error?: string
}

export interface ContainerLogsResult {
  /** Log output */
  logs: string

  /** Success status */
  success: boolean

  /** Error message if failed */
  error?: string
}

export interface ContainerStats {
  /** CPU usage percentage */
  cpuPercent: number

  /** Memory usage in bytes */
  memoryUsage: number

  /** Memory limit in bytes */
  memoryLimit: number

  /** Network bytes received */
  networkRx: number

  /** Network bytes transmitted */
  networkTx: number
}

export interface ContainerHealth {
  /** Health status */
  status: 'healthy' | 'unhealthy' | 'starting' | 'none'

  /** Number of consecutive failures */
  failingStreak: number

  /** Last health check time */
  lastCheck?: Date
}
