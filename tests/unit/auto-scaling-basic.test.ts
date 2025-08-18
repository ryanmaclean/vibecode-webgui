/**
 * Basic auto-scaling functionality tests
 */

import { WorkspaceAutoScaler } from '@/lib/workspace/auto-scaler'

describe('Workspace Auto-Scaling Basic', () => {
  let autoScaler: WorkspaceAutoScaler

  beforeEach(() => {
    autoScaler = new WorkspaceAutoScaler()
  })

  describe('Initialization', () => {
    it('should create auto-scaler successfully', () => {
      expect(autoScaler).toBeDefined()
    })

    it('should create auto-scaler with custom config', () => {
      const customAutoScaler = new WorkspaceAutoScaler({
        enabled: false,
        evaluationInterval: 60
      })
      
      expect(customAutoScaler).toBeDefined()
    })
  })

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      const newConfig = {
        enabled: false,
        evaluationInterval: 120,
        costOptimization: {
          enabled: true,
          idleTimeoutMinutes: 45,
          scaleDownDelay: 600,
          prioritizeResourceUtilization: true
        }
      }

      expect(() => autoScaler.updateConfig(newConfig)).not.toThrow()
    })

    it('should update partial configuration', () => {
      const partialConfig = {
        enabled: true
      }

      expect(() => autoScaler.updateConfig(partialConfig)).not.toThrow()
    })
  })

  describe('Workspace Management', () => {
    it('should register workspace with full resources', async () => {
      const workspaceId = 'test-workspace-123'
      const resources = {
        workspaceId,
        instances: [{
          instanceId: 'instance-1',
          workspaceId,
          status: 'running' as const,
          resources: {
            cpu: 2,
            memory: 4096,
            disk: 50
          },
          createdAt: new Date(),
          lastActivity: new Date()
        }],
        limits: {
          maxCpu: 8,
          maxMemory: 16384,
          maxDisk: 200,
          maxInstances: 10
        }
      }

      await expect(autoScaler.registerWorkspace(workspaceId, resources)).resolves.not.toThrow()
    })

    it('should register workspace with minimal resources', async () => {
      const workspaceId = 'minimal-workspace'
      
      await expect(autoScaler.registerWorkspace(workspaceId, {})).resolves.not.toThrow()
    })

    it('should register multiple workspaces', async () => {
      const workspaces = ['workspace-1', 'workspace-2', 'workspace-3']
      
      for (const workspaceId of workspaces) {
        await expect(autoScaler.registerWorkspace(workspaceId, {
          workspaceId,
          instances: [],
          limits: {
            maxCpu: 4,
            maxMemory: 8192,
            maxDisk: 100,
            maxInstances: 5
          }
        })).resolves.not.toThrow()
      }
    })
  })

  describe('Metrics Updates', () => {
    const workspaceId = 'metrics-workspace'

    beforeEach(async () => {
      await autoScaler.registerWorkspace(workspaceId, {})
    })

    it('should update complete metrics', async () => {
      const metrics = {
        workspaceId,
        userId: 'user-123',
        cpuUsage: 75.5,
        memoryUsage: 60.2,
        diskUsage: 40.1,
        networkIO: 1024,
        activeConnections: 5,
        lastActivity: new Date(),
        resourceRequests: 2,
        queueLength: 1
      }

      await expect(autoScaler.updateMetrics(workspaceId, metrics)).resolves.not.toThrow()
    })

    it('should update partial metrics', async () => {
      const partialMetrics = {
        cpuUsage: 85,
        memoryUsage: 70
      }

      await expect(autoScaler.updateMetrics(workspaceId, partialMetrics)).resolves.not.toThrow()
    })

    it('should handle edge case metrics values', async () => {
      const edgeCaseMetrics = {
        cpuUsage: 0,
        memoryUsage: 100,
        diskUsage: 0,
        networkIO: 0,
        activeConnections: 0,
        lastActivity: new Date(),
        resourceRequests: 0,
        queueLength: 0
      }

      await expect(autoScaler.updateMetrics(workspaceId, edgeCaseMetrics)).resolves.not.toThrow()
    })

    it('should handle high load metrics', async () => {
      const highLoadMetrics = {
        cpuUsage: 95,
        memoryUsage: 90,
        diskUsage: 85,
        networkIO: 10240,
        activeConnections: 50,
        lastActivity: new Date(),
        resourceRequests: 10,
        queueLength: 15
      }

      await expect(autoScaler.updateMetrics(workspaceId, highLoadMetrics)).resolves.not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle updating metrics for non-existent workspace', async () => {
      const metrics = {
        cpuUsage: 50,
        memoryUsage: 40
      }

      // This should not throw, but create the workspace entry
      await expect(autoScaler.updateMetrics('non-existent', metrics)).resolves.not.toThrow()
    })

    it('should handle invalid workspace IDs', async () => {
      const invalidIds = ['', ' ', null, undefined]
      
      for (const invalidId of invalidIds) {
        if (invalidId !== null && invalidId !== undefined) {
          await expect(autoScaler.registerWorkspace(invalidId, {})).resolves.not.toThrow()
        }
      }
    })
  })

  describe('Resource Limits', () => {
    it('should handle workspace with custom limits', async () => {
      const workspaceId = 'custom-limits-workspace'
      const resources = {
        workspaceId,
        instances: [],
        limits: {
          maxCpu: 16,
          maxMemory: 32768,
          maxDisk: 500,
          maxInstances: 20
        }
      }

      await expect(autoScaler.registerWorkspace(workspaceId, resources)).resolves.not.toThrow()
    })

    it('should handle workspace with minimal limits', async () => {
      const workspaceId = 'minimal-limits-workspace'
      const resources = {
        workspaceId,
        instances: [],
        limits: {
          maxCpu: 1,
          maxMemory: 1024,
          maxDisk: 10,
          maxInstances: 1
        }
      }

      await expect(autoScaler.registerWorkspace(workspaceId, resources)).resolves.not.toThrow()
    })
  })

  describe('Instance Management', () => {
    it('should handle workspace with multiple instances', async () => {
      const workspaceId = 'multi-instance-workspace'
      const instances = [
        {
          instanceId: 'instance-1',
          workspaceId,
          status: 'running' as const,
          resources: { cpu: 2, memory: 4096, disk: 50 },
          createdAt: new Date(),
          lastActivity: new Date()
        },
        {
          instanceId: 'instance-2',
          workspaceId,
          status: 'starting' as const,
          resources: { cpu: 4, memory: 8192, disk: 100 },
          createdAt: new Date(),
          lastActivity: new Date()
        }
      ]

      const resources = {
        workspaceId,
        instances,
        limits: {
          maxCpu: 16,
          maxMemory: 32768,
          maxDisk: 500,
          maxInstances: 10
        }
      }

      await expect(autoScaler.registerWorkspace(workspaceId, resources)).resolves.not.toThrow()
    })
  })
})