/**
 * Apple Container Runtime V2
 *
 * Production TypeScript bridge for Apple Containerization framework.
 * Provides container lifecycle management via Swift runtime.
 */

import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import type {
  ContainerOptions,
  ContainerInfo,
  ContainerStartResult,
  ContainerListResult,
  ContainerLogsResult,
} from './types'

export interface AppleContainerConfig {
  /** Path to Swift runtime executable */
  runtimePath?: string
  /** Enable debug logging */
  debug?: boolean
}

export class AppleContainerRuntimeV2 {
  private runtimePath: string
  private debug: boolean

  constructor(config: AppleContainerConfig = {}) {
    // Default to built Swift executable
    this.runtimePath = config.runtimePath || path.join(
      process.cwd(),
      'AppleContainerRuntime/.build/release/apple-container-runtime'
    )
    this.debug = config.debug || false
  }

  /**
   * Check if Apple Container Runtime is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.executeCommand(['--version'])
      return result.success && result.stdout.includes('apple-container-runtime')
    } catch {
      return false
    }
  }

  /**
   * Get runtime version
   */
  async getVersion(): Promise<string> {
    const result = await this.executeCommand(['--version'])
    if (!result.success) {
      throw new Error('Failed to get runtime version')
    }
    return result.stdout.trim()
  }

  /**
   * Start a new container
   */
  async start(
    image: string,
    options: ContainerOptions = {}
  ): Promise<ContainerStartResult> {
    try {
      const args = ['run', image]

      // Container name
      if (options.name) {
        args.push('--name', options.name)
      }

      // Port mappings
      if (options.ports) {
        for (const [host, container] of Object.entries(options.ports)) {
          args.push('--port', `${host}:${container}`)
        }
      }

      // Environment variables
      if (options.env) {
        for (const [key, value] of Object.entries(options.env)) {
          args.push('--env', `${key}=${value}`)
        }
      }

      // Volume mounts
      if (options.volumes) {
        for (const [hostPath, containerPath] of Object.entries(options.volumes)) {
          args.push('--volume', `${hostPath}:${containerPath}`)
        }
      }

      // Resource limits
      if (options.cpus) {
        args.push('--cpus', String(options.cpus))
      }

      if (options.memory) {
        args.push('--memory', String(options.memory))
      }

      // Detached mode (default)
      if (options.detached !== false) {
        args.push('--detach')
      }

      // Remove after exit
      if (options.rm) {
        args.push('--rm')
      }

      const result = await this.executeCommand(args)

      if (!result.success) {
        return {
          id: '',
          name: options.name || '',
          success: false,
          error: result.error || result.stderr,
        }
      }

      // Container ID is in stdout
      const containerId = result.stdout.trim()

      return {
        id: containerId,
        name: options.name || containerId.substring(0, 12),
        success: true,
      }
    } catch (error) {
      return {
        id: '',
        name: options.name || '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Stop a running container
   */
  async stop(containerId: string, timeout = 10): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.executeCommand([
        'stop',
        containerId,
        '--timeout',
        String(timeout),
      ])

      return {
        success: result.success,
        error: result.error || result.stderr,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Remove a container
   */
  async remove(
    containerId: string,
    force = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const args = ['remove', containerId]
      if (force) {
        args.push('--force')
      }

      const result = await this.executeCommand(args)

      return {
        success: result.success,
        error: result.error || result.stderr,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * List all containers
   */
  async list(all = false): Promise<ContainerListResult> {
    try {
      const args = ['list', '--json']
      if (all) {
        args.push('--all')
      }

      const result = await this.executeCommand(args)

      if (!result.success) {
        return {
          containers: [],
          success: false,
          error: result.error || result.stderr,
        }
      }

      // Parse JSON output
      const containers = JSON.parse(result.stdout) as Array<{
        id: string
        name: string
        image: string
        state: string
        ipAddress?: string
        created: string
      }>

      return {
        containers: containers.map((c) => ({
          id: c.id,
          name: c.name,
          image: c.image,
          state: c.state,
          ipAddress: c.ipAddress,
          created: c.created,
        })),
        success: true,
      }
    } catch (error) {
      return {
        containers: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get container logs
   */
  async logs(
    containerId: string,
    options: { follow?: boolean; tail?: number } = {}
  ): Promise<ContainerLogsResult> {
    try {
      const args = ['logs', containerId]

      if (options.follow) {
        args.push('--follow')
      }

      if (options.tail) {
        args.push('--tail', String(options.tail))
      }

      const result = await this.executeCommand(args)

      return {
        logs: result.stdout,
        success: result.success,
        error: result.error || result.stderr,
      }
    } catch (error) {
      return {
        logs: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Stream container logs
   */
  async streamLogs(
    containerId: string,
    callback: (line: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const proc = spawn(this.runtimePath, ['logs', containerId, '--follow'])

      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          if (line.trim()) {
            callback(line)
          }
        }
      })

      proc.stderr.on('data', (data) => {
        if (this.debug) {
          console.error('Container logs stderr:', data.toString())
        }
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({
            success: false,
            error: `Process exited with code ${code}`,
          })
        }
      })

      proc.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
        })
      })
    })
  }

  /**
   * Inspect a container (get detailed info)
   */
  async inspect(containerId: string): Promise<ContainerInfo | null> {
    try {
      const result = await this.executeCommand(['inspect', containerId])

      if (!result.success) {
        return null
      }

      // Parse JSON output
      const detail = JSON.parse(result.stdout)

      return {
        id: detail.id,
        name: detail.name,
        image: detail.image,
        state: detail.state,
        ipAddress: detail.ipAddress,
        created: detail.created,
        ports: detail.config?.portMappings?.reduce((acc: Record<string, number>, pm: any) => {
          acc[pm.containerPort] = pm.hostPort
          return acc
        }, {}),
      }
    } catch {
      return null
    }
  }

  /**
   * Pull an OCI image
   */
  async pull(
    image: string,
    onProgress?: (progress: { bytesDownloaded: number; totalBytes: number; percentComplete: number }) => void
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const proc = spawn(this.runtimePath, ['pull', image, '--progress'])

      proc.stdout.on('data', (data) => {
        const output = data.toString()

        // Parse progress output
        const match = output.match(/Downloading: (\d+)%/)
        if (match && onProgress) {
          const percentComplete = parseInt(match[1], 10)
          onProgress({
            bytesDownloaded: 0, // Would need to parse from more detailed output
            totalBytes: 0,
            percentComplete,
          })
        }
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({
            success: false,
            error: `Pull failed with code ${code}`,
          })
        }
      })

      proc.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
        })
      })
    })
  }

  /**
   * Execute container runtime command
   */
  private executeCommand(
    args: string[]
  ): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
    return new Promise((resolve) => {
      if (this.debug) {
        console.log('Executing:', this.runtimePath, args.join(' '))
      }

      const proc = spawn(this.runtimePath, args)

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (this.debug) {
          console.log('Exit code:', code)
          console.log('Stdout:', stdout)
          console.log('Stderr:', stderr)
        }

        if (code === 0) {
          resolve({
            success: true,
            stdout,
            stderr,
          })
        } else {
          resolve({
            success: false,
            stdout,
            stderr,
            error: stderr || `Command exited with code ${code}`,
          })
        }
      })

      proc.on('error', (error) => {
        resolve({
          success: false,
          stdout,
          stderr,
          error: error.message,
        })
      })
    })
  }

  /**
   * Build the Swift runtime (development helper)
   */
  static async build(debug = false): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const buildType = debug ? 'debug' : 'release'
      const proc = spawn('swift', ['build', '-c', buildType], {
        cwd: path.join(process.cwd(), 'AppleContainerRuntime'),
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({
            success: false,
            error: `Build failed with code ${code}`,
          })
        }
      })

      proc.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
        })
      })
    })
  }
}

// Singleton instance
export const appleContainerV2 = new AppleContainerRuntimeV2()
