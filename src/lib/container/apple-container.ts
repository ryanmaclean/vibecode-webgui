/**
 * Apple Container Runtime
 * 
 * TypeScript wrapper around Apple's container CLI for managing
 * code-server instances in lightweight VMs.
 */

import { spawn } from 'child_process'
import type {
  ContainerOptions,
  ContainerInfo,
  ContainerStartResult,
  ContainerListResult,
  ContainerLogsResult,
} from './types'

export class AppleContainerRuntime {
  private containerBinary = 'container'

  /**
   * Check if Apple Container CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.executeCommand(['--version'])
      return result.success
    } catch {
      return false
    }
  }

  /**
   * Start a new container
   */
  async start(
    image: string,
    options: ContainerOptions = {}
  ): Promise<ContainerStartResult> {
    try {
      const args = ['run']

      // Detached mode (default)
      if (options.detached !== false) {
        args.push('-d')
      }

      // Container name
      if (options.name) {
        args.push('--name', options.name)
      }

      // Port mappings
      if (options.ports) {
        for (const [host, container] of Object.entries(options.ports)) {
          args.push('-p', `${host}:${container}`)
        }
      }

      // Environment variables
      if (options.env) {
        for (const [key, value] of Object.entries(options.env)) {
          args.push('-e', `${key}=${value}`)
        }
      }

      // Volume mounts
      if (options.volumes) {
        for (const [name, path] of Object.entries(options.volumes)) {
          args.push('-v', `${name}:${path}`)
        }
      }

      // Remove after exit
      if (options.rm) {
        args.push('--rm')
      }

      // Additional args
      if (options.args) {
        args.push(...options.args)
      }

      // Image name
      args.push(image)

      const result = await this.executeCommand(args)

      if (!result.success) {
        return {
          id: '',
          name: options.name || '',
          success: false,
          error: result.error,
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
  async stop(containerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.executeCommand(['stop', containerId])
      return {
        success: result.success,
        error: result.error,
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
  async remove(containerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.executeCommand(['rm', containerId])
      return {
        success: result.success,
        error: result.error,
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
  async list(): Promise<ContainerListResult> {
    try {
      const result = await this.executeCommand(['list', '--format', 'json'])

      if (!result.success) {
        return {
          containers: [],
          success: false,
          error: result.error,
        }
      }

      // Parse JSON output
      try {
        const containers = JSON.parse(result.stdout) as Array<{
          ID: string
          IMAGE: string
          STATE: string
          ADDR?: string
        }>

        return {
          containers: containers.map((c) => ({
            id: c.ID,
            name: c.ID.substring(0, 12),
            image: c.IMAGE,
            state: c.STATE,
            ipAddress: c.ADDR,
          })),
          success: true,
        }
      } catch (parseError) {
        // Fallback: parse table format
        return this.parseTableFormat(result.stdout)
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
  async logs(containerId: string): Promise<ContainerLogsResult> {
    try {
      const result = await this.executeCommand(['logs', containerId])

      return {
        logs: result.stdout,
        success: result.success,
        error: result.error,
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
   * Inspect a container (get detailed info)
   */
  async inspect(containerId: string): Promise<ContainerInfo | null> {
    try {
      const result = await this.executeCommand(['inspect', containerId])

      if (!result.success) {
        return null
      }

      // Parse JSON output
      const data = JSON.parse(result.stdout)
      
      // Extract relevant info (structure depends on container CLI output)
      return {
        id: data[0]?.id || containerId,
        name: data[0]?.configuration?.id || containerId,
        image: data[0]?.configuration?.image?.reference || 'unknown',
        state: data[0]?.state || 'unknown',
        ipAddress: data[0]?.network?.ipAddress,
        created: data[0]?.created,
      }
    } catch {
      return null
    }
  }

  /**
   * Execute container CLI command
   */
  private executeCommand(
    args: string[]
  ): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
    return new Promise((resolve) => {
      const proc = spawn(this.containerBinary, args)

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
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
   * Parse table format output from container list
   */
  private parseTableFormat(output: string): ContainerListResult {
    try {
      const lines = output.trim().split('\n')
      
      if (lines.length < 2) {
        return { containers: [], success: true }
      }

      // Skip header line
      const containers: ContainerInfo[] = []
      
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/\s+/)
        
        if (parts.length >= 4) {
          containers.push({
            id: parts[0],
            name: parts[0].substring(0, 12),
            image: parts[1],
            state: parts[3],
            ipAddress: parts[4],
          })
        }
      }

      return {
        containers,
        success: true,
      }
    } catch (error) {
      return {
        containers: [],
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse output',
      }
    }
  }
}

// Singleton instance
export const appleContainer = new AppleContainerRuntime()
