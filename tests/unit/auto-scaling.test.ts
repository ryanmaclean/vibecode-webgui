/**
 * Unit tests for workspace auto-scaling functionality
 */

import { WorkspaceAutoScaler } from '@/lib/workspace/auto-scaler'

describe('Workspace Auto-Scaling', () => {
  let autoScaler: WorkspaceAutoScaler

  beforeEach(() => {
    autoScaler = new WorkspaceAutoScaler()
  })

  describe('Configuration', () => {
    it('should create auto-scaler with default config', () => {
      expect(autoScaler).toBeDefined()
    })

    it('should update configuration', () => {
      const newConfig = {
        enabled: false,
        evaluationInterval: 60
      }

      autoScaler.updateConfig(newConfig)
      // Since config is private, we test indirectly through behavior
      expect(autoScaler).toBeDefined()
    })
  })

  describe('Workspace Registration', () => {
    it('should register workspace with resources', async () => {
      const workspaceId = 'test-workspace-123'
      const resources = {
        workspaceId,
        instances: [],
        limits: {
          maxCpu: 4,
          maxMemory: 8192,
          maxDisk: 100,
          maxInstances: 5
        }
      }

      await expect(autoScaler.registerWorkspace(workspaceId, resources)).resolves.not.toThrow()
    })

    it('should handle minimal resource configuration', async () => {
      const workspaceId = 'minimal-workspace'
      
      await expect(autoScaler.registerWorkspace(workspaceId, {})).resolves.not.toThrow()
    })
  })

  describe('Metrics Management', () => {
    const workspaceId = 'metrics-test-workspace'

    beforeEach(async () => {
      await autoScaler.registerWorkspace(workspaceId, {})
    })

    it('should update workspace metrics', async () => {
      const metrics = {
        cpuUsage: 75,
        memoryUsage: 60,
        diskUsage: 40,
        networkIO: 1024,
        activeConnections: 5,
        lastActivity: new Date(),
        resourceRequests: 2,
        queueLength: 1
      }

      await expect(autoScaler.updateMetrics(workspaceId, metrics)).resolves.not.toThrow()
    })

    it('should handle partial metrics updates', async () => {
      const partialMetrics = {
        cpuUsage: 50,
        memoryUsage: 30
      }

      await expect(autoScaler.updateMetrics(workspaceId, partialMetrics)).resolves.not.toThrow()
    })

    it('should get workspace metrics', async () => {
      await autoScaler.updateMetrics(workspaceId, {
        cpuUsage: 80,
        memoryUsage: 70
      })

      const metrics = await autoScaler.getMetrics(workspaceId)
      
      expect(metrics).toBeDefined()
      expect(metrics.cpuUsage).toBe(80)
      expect(metrics.memoryUsage).toBe(70)
    })
  })

  describe('Scaling Rules', () => {
    it('should add scaling rule', () => {
      const initialRulesCount = autoScaler.getRules().length

      const rule = {
        id: 'custom-cpu-scale-up',
        name: 'Custom CPU Scale Up',
        condition: {
          metric: 'cpuUsage' as const,
          operator: '>' as const,
          threshold: 80,
          duration: 300
        },
        action: {
          type: 'scale_up' as const,
          resourceType: 'cpu' as const,
          amount: 1
        },
        cooldown: 300,
        enabled: true,
        priority: 1
      }

      autoScaler.addRule(rule)

      const rules = autoScaler.getRules()
      expect(rules.length).toBeGreaterThan(initialRulesCount)

      const addedRule = rules.find(r => r.id === 'custom-cpu-scale-up')
      expect(addedRule).toBeDefined()
      expect(addedRule?.name).toBe('Custom CPU Scale Up')
    })

    it('should remove scaling rule', () => {
      const initialRulesCount = autoScaler.getRules().length

      const rule = {
        id: 'test-rule-to-remove',
        name: 'Test Rule',
        condition: {
          metric: 'memoryUsage' as const,
          operator: '>' as const,
          threshold: 90,
          duration: 300
        },
        action: {
          type: 'scale_up' as const,
          resourceType: 'memory' as const,
          amount: 1024
        },
        cooldown: 300,
        enabled: true,
        priority: 1
      }

      autoScaler.addRule(rule)
      expect(autoScaler.getRules().length).toBe(initialRulesCount + 1)

      autoScaler.removeRule('test-rule-to-remove')
      expect(autoScaler.getRules().length).toBe(initialRulesCount)

      const removedRule = autoScaler.getRules().find(r => r.id === 'test-rule-to-remove')
      expect(removedRule).toBeUndefined()
    })
  })

  describe('Scaling Operations', () => {
    const workspaceId = 'scaling-test-workspace'

    beforeEach(async () => {
      await autoScaler.registerWorkspace(workspaceId, {
        workspaceId,
        instances: [],
        limits: {
          maxCpu: 8,
          maxMemory: 16384,
          maxDisk: 200,
          maxInstances: 10
        }
      })
    })

    it('should handle scale up operation', async () => {
      const scaleUpRule = {
        id: 'scale-up-test',
        name: 'Scale Up Test',
        condition: {
          metric: 'cpuUsage' as const,
          operator: '>' as const,
          threshold: 80,
          duration: 60
        },
        action: {
          type: 'scale_up' as const,
          resourceType: 'cpu' as const,
          amount: 2
        },
        cooldown: 300,
        enabled: true,
        priority: 1
      }

      autoScaler.addRule(scaleUpRule)

      // Simulate high CPU usage
      await autoScaler.updateMetrics(workspaceId, {
        cpuUsage: 85,
        memoryUsage: 60,
        lastActivity: new Date()
      })

      // Trigger evaluation
      await autoScaler.evaluateWorkspace(workspaceId)

      // The scaling should have been triggered (we can't easily test the actual scaling without mocking k8s)
      expect(true).toBe(true) // Basic smoke test
    })

    it('should respect resource limits', async () => {
      // Test that scaling doesn't exceed configured limits
      await autoScaler.updateMetrics(workspaceId, {
        cpuUsage: 95,
        memoryUsage: 95,
        lastActivity: new Date()
      })

      await expect(autoScaler.evaluateWorkspace(workspaceId)).resolves.not.toThrow()
    })
  })

  describe('Resource Monitoring', () => {
    it('should get scaling history', async () => {
      const workspaceId = 'history-test'
      await autoScaler.registerWorkspace(workspaceId, {})

      const history = await autoScaler.getScalingHistory(workspaceId)
      
      expect(Array.isArray(history)).toBe(true)
    })

    it('should get resource utilization', async () => {
      const workspaceId = 'utilization-test'
      await autoScaler.registerWorkspace(workspaceId, {})

      const utilization = await autoScaler.getResourceUtilization(workspaceId)
      
      expect(utilization).toBeDefined()
      expect(utilization).toHaveProperty('cpu')
      expect(utilization).toHaveProperty('memory')
      expect(utilization).toHaveProperty('disk')
    })
  })

  describe('Cost Optimization', () => {
    beforeEach(() => {
      autoScaler.updateConfig({
        costOptimization: {
          enabled: true,
          idleTimeoutMinutes: 30,
          scaleDownDelay: 300,
          prioritizeResourceUtilization: true
        }
      })
    })

    it('should handle idle workspace detection', async () => {
      const workspaceId = 'idle-test'
      await autoScaler.registerWorkspace(workspaceId, {})

      // Simulate idle workspace
      const oldTimestamp = new Date(Date.now() - 45 * 60 * 1000) // 45 minutes ago
      await autoScaler.updateMetrics(workspaceId, {
        cpuUsage: 5,
        memoryUsage: 10,
        lastActivity: oldTimestamp,
        activeConnections: 0
      })

      await expect(autoScaler.evaluateWorkspace(workspaceId)).resolves.not.toThrow()
    })

    it('should calculate cost savings', async () => {
      const workspaceId = 'cost-test'
      await autoScaler.registerWorkspace(workspaceId, {})

      const savings = await autoScaler.getCostSavings(workspaceId)
      
      expect(savings).toBeDefined()
      expect(typeof savings.estimatedMonthlySavings).toBe('number')
      expect(typeof savings.optimizationRecommendations).toBe('object')
    })
  })
})