/**
 * Workspace Auto-Scaling Service
 * Dynamically scales workspace resources based on usage patterns and demand
 * Supports horizontal and vertical scaling with cost optimization
 */

export interface WorkspaceMetrics {
  workspaceId: string
  userId: string
  cpuUsage: number // 0-100%
  memoryUsage: number // 0-100%
  diskUsage: number // 0-100%
  networkIO: number // bytes/sec
  activeConnections: number
  lastActivity: Date
  resourceRequests: number // pending resource requests
  queueLength: number // tasks waiting for resources
}

export interface ScalingRule {
  id: string
  name: string
  condition: {
    metric: keyof WorkspaceMetrics
    operator: '>' | '<' | '>=' | '<=' | '=='
    threshold: number
    duration: number // seconds the condition must be true
  }
  action: {
    type: 'scale_up' | 'scale_down' | 'provision' | 'deallocate'
    resourceType: 'cpu' | 'memory' | 'disk' | 'instances'
    amount: number
    maxInstances?: number
    minInstances?: number
  }
  cooldown: number // seconds before rule can trigger again
  priority: number // higher = more important
  enabled: boolean
}

export interface WorkspaceResources {
  workspaceId: string
  instances: WorkspaceInstance[]
  limits: {
    maxCpu: number
    maxMemory: number
    maxDisk: number
    maxInstances: number
  }
  current: {
    totalCpu: number
    totalMemory: number
    totalDisk: number
    instanceCount: number
  }
  scaling: {
    isScaling: boolean
    lastScaleAction: Date
    pendingActions: ScalingAction[]
  }
}

export interface WorkspaceInstance {
  instanceId: string
  workspaceId: string
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  resources: {
    cpu: number
    memory: number
    disk: number
  }
  createdAt: Date
  lastActivity: Date
  podName?: string
  namespace?: string
}

export interface ScalingAction {
  actionId: string
  workspaceId: string
  type: 'scale_up' | 'scale_down' | 'provision' | 'deallocate'
  resourceType: 'cpu' | 'memory' | 'disk' | 'instances'
  amount: number
  status: 'pending' | 'executing' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
  error?: string
  metadata?: Record<string, any>
}

export interface AutoScalingConfig {
  enabled: boolean
  evaluationInterval: number // seconds
  rules: ScalingRule[]
  resourceLimits: {
    maxCpuPerWorkspace: number
    maxMemoryPerWorkspace: number
    maxInstancesPerWorkspace: number
    maxInstancesPerUser: number
  }
  costOptimization: {
    enabled: boolean
    idleTimeoutMinutes: number
    scaleDownDelay: number
    prioritizeResourceUtilization: boolean
  }
}

export class WorkspaceAutoScaler {
  private metrics: Map<string, WorkspaceMetrics> = new Map()
  private resources: Map<string, WorkspaceResources> = new Map()
  private config: AutoScalingConfig
  private ruleCooldowns: Map<string, Date> = new Map()
  private isEvaluating: boolean = false

  constructor(config?: Partial<AutoScalingConfig>) {
    this.config = {
      enabled: true,
      evaluationInterval: 30, // 30 seconds
      rules: this.getDefaultScalingRules(),
      resourceLimits: {
        maxCpuPerWorkspace: 8000, // 8 cores
        maxMemoryPerWorkspace: 32000, // 32GB
        maxInstancesPerWorkspace: 10,
        maxInstancesPerUser: 50
      },
      costOptimization: {
        enabled: true,
        idleTimeoutMinutes: 30,
        scaleDownDelay: 300, // 5 minutes
        prioritizeResourceUtilization: true
      },
      ...config
    }

    // Convert resource limits to workspace limits format
    const defaultWorkspaceLimits = {
      maxCpu: this.config.resourceLimits.maxCpuPerWorkspace,
      maxMemory: this.config.resourceLimits.maxMemoryPerWorkspace,
      maxDisk: 100000, // 100GB default
      maxInstances: this.config.resourceLimits.maxInstancesPerWorkspace
    }

    if (this.config.enabled) {
      this.startAutoScaling()
    }
  }

  /**
   * Start the auto-scaling evaluation loop
   */
  private startAutoScaling(): void {
    const interval = this.config.evaluationInterval * 1000
    
    setInterval(async () => {
      if (!this.isEvaluating) {
        await this.evaluateScalingRules()
      }
    }, interval)

    // Debug log removed`)
  }

  /**
   * Update workspace metrics
   */
  async updateMetrics(workspaceId: string, metrics: Partial<WorkspaceMetrics>): Promise<void> {
    const current = this.metrics.get(workspaceId) || {
      workspaceId,
      userId: '',
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkIO: 0,
      activeConnections: 0,
      lastActivity: new Date(),
      resourceRequests: 0,
      queueLength: 0
    }

    const updated = { ...current, ...metrics, lastActivity: new Date() }
    this.metrics.set(workspaceId, updated)
  }

  /**
   * Register workspace resources
   */
  async registerWorkspace(workspaceId: string, resources: Partial<WorkspaceResources>): Promise<void> {
    const current = this.resources.get(workspaceId) || {
      workspaceId,
      instances: [],
      limits: {
        maxCpu: this.config.resourceLimits.maxCpuPerWorkspace,
        maxMemory: this.config.resourceLimits.maxMemoryPerWorkspace,
        maxDisk: 100000, // 100GB default
        maxInstances: this.config.resourceLimits.maxInstancesPerWorkspace
      },
      current: { totalCpu: 0, totalMemory: 0, totalDisk: 0, instanceCount: 0 },
      scaling: { isScaling: false, lastScaleAction: new Date(0), pendingActions: [] }
    }

    const updated = { ...current, ...resources }
    this.resources.set(workspaceId, updated)

    // Debug log removed
  }

  /**
   * Evaluate all scaling rules
   */
  private async evaluateScalingRules(): Promise<void> {
    this.isEvaluating = true

    try {
      for (const [workspaceId, metrics] of this.metrics.entries()) {
        const resources = this.resources.get(workspaceId)
        if (!resources) continue

        // Skip if already scaling
        if (resources.scaling.isScaling) continue

        // Evaluate each rule
        for (const rule of this.config.rules) {
          if (!rule.enabled) continue

          // Check cooldown
          const cooldownKey = `${workspaceId}-${rule.id}`
          const lastExecution = this.ruleCooldowns.get(cooldownKey)
          if (lastExecution && (Date.now() - lastExecution.getTime()) < (rule.cooldown * 1000)) {
            continue
          }

          // Check if rule condition is met
          if (await this.evaluateRuleCondition(rule, metrics, resources)) {
            await this.executeScalingAction(workspaceId, rule, metrics, resources)
            this.ruleCooldowns.set(cooldownKey, new Date())
            break // Only execute one rule per evaluation
          }
        }

        // Check for idle workspaces
        if (this.config.costOptimization.enabled) {
          await this.checkIdleWorkspace(workspaceId, metrics, resources)
        }
      }
    } catch (error) {
      console.error('Auto-scaling evaluation error:', error)
    } finally {
      this.isEvaluating = false
    }
  }

  /**
   * Evaluate if a rule condition is met
   */
  private async evaluateRuleCondition(
    rule: ScalingRule,
    metrics: WorkspaceMetrics,
    resources: WorkspaceResources
  ): Promise<boolean> {
    const { condition } = rule
    const metricValue = metrics[condition.metric]

    if (typeof metricValue !== 'number') return false

    let conditionMet = false

    switch (condition.operator) {
      case '>':
        conditionMet = metricValue > condition.threshold
        break
      case '<':
        conditionMet = metricValue < condition.threshold
        break
      case '>=':
        conditionMet = metricValue >= condition.threshold
        break
      case '<=':
        conditionMet = metricValue <= condition.threshold
        break
      case '==':
        conditionMet = metricValue === condition.threshold
        break
    }

    // Check duration if condition is met
    if (conditionMet && condition.duration > 0) {
      // In a real implementation, you would track condition duration
      // For now, we'll assume immediate execution
    }

    return conditionMet
  }

  /**
   * Execute scaling action
   */
  private async executeScalingAction(
    workspaceId: string,
    rule: ScalingRule,
    metrics: WorkspaceMetrics,
    resources: WorkspaceResources
  ): Promise<void> {
    const { action } = rule

    // Create a proper ScalingAction from the rule action
    const scalingAction: ScalingAction = {
      actionId: this.generateActionId(),
      workspaceId,
      type: action.type,
      resourceType: action.resourceType,
      amount: action.amount,
      status: 'pending',
      createdAt: new Date(),
      metadata: { ruleId: rule.id, ruleName: rule.name }
    }

    // Check resource limits
    if (!this.canScale(scalingAction, resources)) {
      // Debug log removed
      return
    }

    // Mark as scaling
    resources.scaling.isScaling = true
    resources.scaling.lastScaleAction = new Date()

    resources.scaling.pendingActions.push(scalingAction)

    try {
      // Debug log removed

      switch (scalingAction.type) {
        case 'scale_up':
          await this.scaleUp(workspaceId, scalingAction, resources)
          break
        case 'scale_down':
          await this.scaleDown(workspaceId, scalingAction, resources)
          break
        case 'provision':
          await this.provisionInstance(workspaceId, scalingAction, resources)
          break
        case 'deallocate':
          await this.deallocateInstance(workspaceId, scalingAction, resources)
          break
      }

      scalingAction.status = 'completed'
      scalingAction.completedAt = new Date()

      // Debug log removed
    } catch (error) {
      scalingAction.status = 'failed'
      scalingAction.error = error instanceof Error ? error.message : 'Unknown error'
      
      console.error(`❌ Scaling action failed for workspace ${workspaceId}:`, error)
    } finally {
      // Remove completed/failed action and mark as not scaling
      resources.scaling.pendingActions = resources.scaling.pendingActions.filter(
        a => a.actionId !== scalingAction.actionId
      )
      resources.scaling.isScaling = false
    }
  }

  /**
   * Scale up resources (vertical scaling)
   */
  private async scaleUp(workspaceId: string, action: ScalingAction, resources: WorkspaceResources): Promise<void> {
    // In a real implementation, this would call Kubernetes API to update resource limits
    const instance = resources.instances.find(i => i.status === 'running')
    if (!instance) throw new Error('No running instance to scale')

    switch (action.resourceType) {
      case 'cpu':
        instance.resources.cpu += action.amount
        resources.current.totalCpu += action.amount
        break
      case 'memory':
        instance.resources.memory += action.amount
        resources.current.totalMemory += action.amount
        break
      case 'disk':
        instance.resources.disk += action.amount
        resources.current.totalDisk += action.amount
        break
    }

    // Mock Kubernetes API call
    await this.mockKubernetesResourceUpdate(workspaceId, instance)
  }

  /**
   * Scale down resources (vertical scaling)
   */
  private async scaleDown(workspaceId: string, action: ScalingAction, resources: WorkspaceResources): Promise<void> {
    const instance = resources.instances.find(i => i.status === 'running')
    if (!instance) return

    switch (action.resourceType) {
      case 'cpu':
        instance.resources.cpu = Math.max(100, instance.resources.cpu - action.amount) // Min 100 CPU
        break
      case 'memory':
        instance.resources.memory = Math.max(128, instance.resources.memory - action.amount) // Min 128MB
        break
      case 'disk':
        // Disk cannot be scaled down
        break
    }

    await this.mockKubernetesResourceUpdate(workspaceId, instance)
  }

  /**
   * Provision new instance (horizontal scaling)
   */
  private async provisionInstance(workspaceId: string, action: ScalingAction, resources: WorkspaceResources): Promise<void> {
    const newInstance: WorkspaceInstance = {
      instanceId: this.generateInstanceId(),
      workspaceId,
      status: 'starting',
      resources: {
        cpu: 1000, // 1 core
        memory: 2048, // 2GB
        disk: 10000 // 10GB
      },
      createdAt: new Date(),
      lastActivity: new Date(),
      podName: `workspace-${workspaceId}-${Date.now()}`,
      namespace: 'vibecode-workspaces'
    }

    resources.instances.push(newInstance)
    resources.current.instanceCount++

    // Mock Kubernetes deployment
    await this.mockKubernetesPodCreation(newInstance)
    
    newInstance.status = 'running'
  }

  /**
   * Deallocate instance (horizontal scaling down)
   */
  private async deallocateInstance(workspaceId: string, action: ScalingAction, resources: WorkspaceResources): Promise<void> {
    const idleInstances = resources.instances
      .filter(i => i.status === 'running')
      .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())

    if (idleInstances.length <= 1) return // Keep at least one instance

    const instanceToRemove = idleInstances[0]
    instanceToRemove.status = 'stopping'

    // Mock Kubernetes deletion
    await this.mockKubernetesPodDeletion(instanceToRemove)

    // Remove from list
    resources.instances = resources.instances.filter(i => i.instanceId !== instanceToRemove.instanceId)
    resources.current.instanceCount--
  }

  /**
   * Check for idle workspaces
   */
  private async checkIdleWorkspace(
    workspaceId: string,
    metrics: WorkspaceMetrics,
    resources: WorkspaceResources
  ): Promise<void> {
    const { idleTimeoutMinutes } = this.config.costOptimization
    const idleThreshold = Date.now() - (idleTimeoutMinutes * 60 * 1000)

    if (metrics.lastActivity.getTime() < idleThreshold && 
        metrics.activeConnections === 0 && 
        metrics.cpuUsage < 5) {
      
      // Debug log removed
      
      const scaleDownAction: ScalingAction = {
        actionId: this.generateActionId(),
        workspaceId,
        type: 'deallocate',
        resourceType: 'instances',
        amount: 1,
        status: 'pending',
        createdAt: new Date(),
        metadata: { reason: 'idle_timeout' }
      }

      await this.executeScalingAction(workspaceId, {
        id: 'idle-scaledown',
        name: 'Idle Scale Down',
        condition: { metric: 'activeConnections', operator: '==', threshold: 0, duration: 0 },
        action: scaleDownAction,
        cooldown: 300,
        priority: 1,
        enabled: true
      }, metrics, resources)
    }
  }

  /**
   * Check if scaling action is allowed
   */
  private canScale(action: ScalingAction, resources: WorkspaceResources): boolean {
    const { limits } = resources

    if (action.type === 'scale_up' || action.type === 'provision') {
      switch (action.resourceType) {
        case 'cpu':
          return resources.current.totalCpu + action.amount <= limits.maxCpu
        case 'memory':
          return resources.current.totalMemory + action.amount <= limits.maxMemory
        case 'instances':
          return resources.current.instanceCount + action.amount <= limits.maxInstances
      }
    }

    return true // Scale down is always allowed
  }

  /**
   * Get default scaling rules
   */
  private getDefaultScalingRules(): ScalingRule[] {
    return [
      {
        id: 'high-cpu-scale-up',
        name: 'High CPU Scale Up',
        condition: { metric: 'cpuUsage', operator: '>', threshold: 80, duration: 60 },
        action: { 
          type: 'scale_up', 
          resourceType: 'cpu', 
          amount: 500, // 0.5 core
          maxInstances: 10 
        },
        cooldown: 300,
        priority: 10,
        enabled: true
      },
      {
        id: 'high-memory-scale-up',
        name: 'High Memory Scale Up',
        condition: { metric: 'memoryUsage', operator: '>', threshold: 85, duration: 60 },
        action: { 
          type: 'scale_up', 
          resourceType: 'memory', 
          amount: 512, // 512MB
          maxInstances: 10 
        },
        cooldown: 300,
        priority: 9,
        enabled: true
      },
      {
        id: 'high-queue-provision',
        name: 'High Queue Provision Instance',
        condition: { metric: 'queueLength', operator: '>', threshold: 5, duration: 30 },
        action: { 
          type: 'provision', 
          resourceType: 'instances', 
          amount: 1,
          maxInstances: 5
        },
        cooldown: 600,
        priority: 8,
        enabled: true
      },
      {
        id: 'low-cpu-scale-down',
        name: 'Low CPU Scale Down',
        condition: { metric: 'cpuUsage', operator: '<', threshold: 20, duration: 300 },
        action: { 
          type: 'scale_down', 
          resourceType: 'cpu', 
          amount: 250, // 0.25 core
          minInstances: 1
        },
        cooldown: 600,
        priority: 5,
        enabled: true
      }
    ]
  }

  /**
   * Mock Kubernetes operations (replace with real K8s API calls)
   */
  private async mockKubernetesResourceUpdate(workspaceId: string, instance: WorkspaceInstance): Promise<void> {
    // Mock API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    // Debug log removed
  }

  private async mockKubernetesPodCreation(instance: WorkspaceInstance): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2000))
    // Debug log removed
  }

  private async mockKubernetesPodDeletion(instance: WorkspaceInstance): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000))
    // Debug log removed
  }

  /**
   * Utility methods
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  }

  private generateInstanceId(): string {
    return `instance_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  }

  /**
   * Get workspace scaling status
   */
  getWorkspaceStatus(workspaceId: string): {
    metrics?: WorkspaceMetrics
    resources?: WorkspaceResources
    isScaling: boolean
    pendingActions: number
  } {
    const metrics = this.metrics.get(workspaceId)
    const resources = this.resources.get(workspaceId)

    return {
      metrics,
      resources,
      isScaling: resources?.scaling.isScaling || false,
      pendingActions: resources?.scaling.pendingActions.length || 0
    }
  }

  /**
   * Update scaling configuration
   */
  updateConfig(config: Partial<AutoScalingConfig>): void {
    this.config = { ...this.config, ...config }
    // Debug log removed
  }

  /**
   * Get scaling statistics
   */
  getScalingStats(): {
    totalWorkspaces: number
    activeWorkspaces: number
    scalingWorkspaces: number
    totalInstances: number
    avgCpuUsage: number
    avgMemoryUsage: number
  } {
    const workspaces = Array.from(this.resources.values())
    const activeMetrics = Array.from(this.metrics.values()).filter(
      m => Date.now() - m.lastActivity.getTime() < 300000 // Active in last 5 minutes
    )

    return {
      totalWorkspaces: workspaces.length,
      activeWorkspaces: activeMetrics.length,
      scalingWorkspaces: workspaces.filter(w => w.scaling.isScaling).length,
      totalInstances: workspaces.reduce((sum, w) => sum + w.current.instanceCount, 0),
      avgCpuUsage: activeMetrics.length > 0
        ? activeMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / activeMetrics.length
        : 0,
      avgMemoryUsage: activeMetrics.length > 0
        ? activeMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / activeMetrics.length
        : 0
    }
  }

  /**
   * Get workspace metrics
   */
  async getMetrics(workspaceId: string): Promise<WorkspaceMetrics | undefined> {
    return this.metrics.get(workspaceId)
  }

  /**
   * Add a scaling rule
   */
  addRule(rule: ScalingRule): void {
    // Remove existing rule with same ID if present
    this.config.rules = this.config.rules.filter(r => r.id !== rule.id)
    this.config.rules.push(rule)
    // Sort by priority (descending)
    this.config.rules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Get all scaling rules
   */
  getRules(): ScalingRule[] {
    return [...this.config.rules]
  }

  /**
   * Remove a scaling rule by ID
   */
  removeRule(ruleId: string): void {
    this.config.rules = this.config.rules.filter(r => r.id !== ruleId)
  }

  /**
   * Evaluate workspace for scaling decisions
   */
  async evaluateWorkspace(workspaceId: string): Promise<void> {
    const metrics = this.metrics.get(workspaceId)
    const resources = this.resources.get(workspaceId)

    if (!metrics || !resources) {
      throw new Error(`Workspace ${workspaceId} not found`)
    }

    // Skip if already scaling
    if (resources.scaling.isScaling) {
      return
    }

    // Evaluate each rule
    for (const rule of this.config.rules) {
      if (!rule.enabled) continue

      // Check cooldown
      const cooldownKey = `${workspaceId}-${rule.id}`
      const lastExecution = this.ruleCooldowns.get(cooldownKey)
      if (lastExecution && (Date.now() - lastExecution.getTime()) < (rule.cooldown * 1000)) {
        continue
      }

      // Check if rule condition is met
      if (await this.evaluateRuleCondition(rule, metrics, resources)) {
        await this.executeScalingAction(workspaceId, rule, metrics, resources)
        this.ruleCooldowns.set(cooldownKey, new Date())
        break // Only execute one rule per evaluation
      }
    }

    // Check for idle workspaces
    if (this.config.costOptimization.enabled) {
      await this.checkIdleWorkspace(workspaceId, metrics, resources)
    }
  }

  /**
   * Get scaling history for a workspace
   */
  async getScalingHistory(workspaceId: string): Promise<ScalingAction[]> {
    const resources = this.resources.get(workspaceId)
    if (!resources) {
      return []
    }

    // In a real implementation, this would fetch from a database
    // For now, return pending actions as history
    return [...resources.scaling.pendingActions]
  }

  /**
   * Get resource utilization for a workspace
   */
  async getResourceUtilization(workspaceId: string): Promise<{
    cpu: { used: number; limit: number; percentage: number }
    memory: { used: number; limit: number; percentage: number }
    disk: { used: number; limit: number; percentage: number }
    instances: { count: number; limit: number }
  }> {
    const resources = this.resources.get(workspaceId)
    if (!resources) {
      throw new Error(`Workspace ${workspaceId} not found`)
    }

    const metrics = this.metrics.get(workspaceId)

    return {
      cpu: {
        used: resources.current.totalCpu || 0,
        limit: resources.limits.maxCpu,
        percentage: metrics?.cpuUsage || 0
      },
      memory: {
        used: resources.current.totalMemory || 0,
        limit: resources.limits.maxMemory,
        percentage: metrics?.memoryUsage || 0
      },
      disk: {
        used: resources.current.totalDisk || 0,
        limit: resources.limits.maxDisk,
        percentage: metrics?.diskUsage || 0
      },
      instances: {
        count: resources.current.instanceCount || 0,
        limit: resources.limits.maxInstances
      }
    }
  }

  /**
   * Calculate cost savings from auto-scaling
   */
  async getCostSavings(workspaceId: string): Promise<{
    estimatedMonthlySavings: number
    currentMonthlyCost: number
    optimizedMonthlyCost: number
    optimizationRecommendations: {
      idleTimeReduction: number
      rightSizingOpportunities: string[]
      potentialSavingsPercentage: number
    }
  }> {
    const resources = this.resources.get(workspaceId)
    const metrics = this.metrics.get(workspaceId)

    if (!resources) {
      throw new Error(`Workspace ${workspaceId} not found`)
    }

    // Mock cost calculation (in a real system, this would use actual cloud provider pricing)
    const cpuCostPerCore = 0.05 // $0.05 per core per hour
    const memoryCostPerGB = 0.01 // $0.01 per GB per hour
    const hoursPerMonth = 730

    const currentCpuCost = (resources.current.totalCpu || 0) / 1000 * cpuCostPerCore * hoursPerMonth
    const currentMemoryCost = (resources.current.totalMemory || 0) / 1024 * memoryCostPerGB * hoursPerMonth
    const currentMonthlyCost = currentCpuCost + currentMemoryCost

    // Calculate optimized cost based on average usage
    const avgCpuUsage = metrics?.cpuUsage || 50
    const avgMemoryUsage = metrics?.memoryUsage || 50

    const optimizedCpu = (resources.current.totalCpu || 0) * (avgCpuUsage / 100) * 1.2 // 20% buffer
    const optimizedMemory = (resources.current.totalMemory || 0) * (avgMemoryUsage / 100) * 1.2

    const optimizedCpuCost = optimizedCpu / 1000 * cpuCostPerCore * hoursPerMonth
    const optimizedMemoryCost = optimizedMemory / 1024 * memoryCostPerGB * hoursPerMonth
    const optimizedMonthlyCost = optimizedCpuCost + optimizedMemoryCost

    const estimatedMonthlySavings = Math.max(0, currentMonthlyCost - optimizedMonthlyCost)
    const potentialSavingsPercentage = currentMonthlyCost > 0
      ? (estimatedMonthlySavings / currentMonthlyCost) * 100
      : 0

    const recommendations: string[] = []
    if (avgCpuUsage < 50) {
      recommendations.push('Reduce CPU allocation - current usage is below 50%')
    }
    if (avgMemoryUsage < 50) {
      recommendations.push('Reduce memory allocation - current usage is below 50%')
    }
    if (metrics && metrics.activeConnections === 0 && avgCpuUsage < 10) {
      recommendations.push('Consider implementing auto-pause for idle workspaces')
    }

    return {
      estimatedMonthlySavings,
      currentMonthlyCost,
      optimizedMonthlyCost,
      optimizationRecommendations: {
        idleTimeReduction: this.config.costOptimization.idleTimeoutMinutes,
        rightSizingOpportunities: recommendations,
        potentialSavingsPercentage
      }
    }
  }
}

// Export singleton instance
export const workspaceAutoScaler = new WorkspaceAutoScaler()
export default workspaceAutoScaler