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
  
  /** Volume mounts (name:path) */
  volumes?: Record<string, string>
  
  /** Container name */
  name?: string
  
  /** Run in detached mode */
  detached?: boolean
  
  /** Remove container after exit */
  rm?: boolean
  
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
  
  /** Container state (running, stopped, etc.) */
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
