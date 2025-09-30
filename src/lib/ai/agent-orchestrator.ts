/**
 * Multi-Agent Orchestration System
 * 
 * Provides centralized coordination of specialized AI agents with:
 * - Role-based agent specialization
 * - Intelligent task planning and dependency resolution
 * - Parallel agent execution with load balancing
 * - Result validation and cross-agent verification
 * - Smart workflow optimization
 */

import { z } from 'zod'
import { UnifiedAIClient } from '../unified-ai-client'
import { MultiAgentWorkflow, type AgentRole, type WorkflowStep, type WorkflowResult } from './agents/multi-agent-workflow'

// Enhanced agent capability definitions
export interface AgentCapability {
  name: string
  description: string
  category: 'analysis' | 'generation' | 'review' | 'optimization' | 'planning' | 'execution'
  complexity: 'low' | 'medium' | 'high'
  estimatedDuration: number // minutes
  requirements: {
    memory?: number // MB
    cpu?: 'low' | 'medium' | 'high'
    dependencies?: string[] // other capabilities needed
  }
}

// Task priority and complexity scoring
export interface TaskMetrics {
  priority: 'low' | 'medium' | 'high' | 'critical'
  complexity: number // 1-10 scale
  estimatedDuration: number // minutes
  resourceRequirements: {
    memory: number
    cpu: 'low' | 'medium' | 'high'
    parallelizable: boolean
  }
  dependencies: string[]
  validation: {
    required: boolean
    reviewers: string[] // agent roles that should validate
    criteria: string[]
  }
}

// Enhanced agent role with specialization
export interface SpecializedAgentRole extends AgentRole {
  specialization: string[]
  capabilities: AgentCapability[]
  performanceMetrics: {
    averageResponseTime: number
    successRate: number
    qualityScore: number
  }
  loadLimits: {
    maxConcurrentTasks: number
    maxQueueSize: number
  }
}

// Orchestration plan with parallel execution
export interface OrchestrationPlan {
  id: string
  goal: string
  steps: OrchestrationStep[]
  parallelGroups: OrchestrationStep[][]
  totalEstimatedTime: number
  resourceRequirements: {
    totalMemory: number
    peakConcurrency: number
  }
  validationPlan: ValidationStep[]
}

// Enhanced orchestration step
export interface OrchestrationStep extends WorkflowStep {
  metrics: TaskMetrics
  assignedAgent: string
  startTime?: Date
  endTime?: Date
  resourceUsage?: {
    memory: number
    duration: number
  }
  validationResults?: ValidationResult[]
}

// Validation step definition
export interface ValidationStep {
  id: string
  targetStepId: string
  validatorRole: string
  criteria: string[]
  schema?: z.ZodSchema<any>
}

// Validation result
export interface ValidationResult {
  validatorRole: string
  passed: boolean
  score: number // 0-1
  feedback: string
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    suggestion?: string
  }>
}

// Agent load tracking
interface AgentLoad {
  activeTasks: number
  queuedTasks: number
  averageResponseTime: number
  lastActivity: Date
}

/**
 * Central orchestrator for multi-agent coordination
 */
export class AgentOrchestrator {
  private workflow: MultiAgentWorkflow
  private specializedAgents: Map<string, SpecializedAgentRole> = new Map()
  private agentLoads: Map<string, AgentLoad> = new Map()
  private activePlans: Map<string, OrchestrationPlan> = new Map()
  private executionResults: Map<string, Map<string, WorkflowResult>> = new Map()

  constructor(aiClient?: UnifiedAIClient) {
    this.workflow = new MultiAgentWorkflow()
    this.initializeSpecializedAgents()
  }

  /**
   * Initialize specialized agent roles with enhanced capabilities
   */
  private initializeSpecializedAgents(): void {
    // Software Architect with enhanced specialization
    this.registerSpecializedAgent({
      name: 'architect',
      description: 'Software architect specializing in system design and architecture',
      systemPrompt: `You are a senior software architect with 15+ years of experience.
Your specializations include microservices, cloud architecture, security design, and scalability patterns.

Your role is to:
1. Analyze requirements and design scalable system architectures
2. Choose appropriate technologies and design patterns
3. Consider performance, security, and maintainability
4. Provide clear architectural diagrams and documentation
5. Make decisions that balance technical debt with delivery speed
6. Review architectural decisions for consistency and best practices

Always provide structured, actionable architectural guidance with clear reasoning.`,
      model: 'gpt-4',
      temperature: 0.1,
      specialization: [
        'system-architecture',
        'microservices-design',
        'cloud-architecture',
        'security-architecture',
        'scalability-patterns',
        'technology-selection'
      ],
      capabilities: [
        {
          name: 'system-design',
          description: 'Design comprehensive system architectures',
          category: 'planning',
          complexity: 'high',
          estimatedDuration: 45,
          requirements: { memory: 512, cpu: 'high' }
        },
        {
          name: 'architecture-review',
          description: 'Review and validate architectural decisions',
          category: 'review',
          complexity: 'medium',
          estimatedDuration: 30,
          requirements: { memory: 256, cpu: 'medium', dependencies: ['system-design'] }
        }
      ],
      performanceMetrics: {
        averageResponseTime: 120,
        successRate: 0.95,
        qualityScore: 0.92
      },
      loadLimits: {
        maxConcurrentTasks: 2,
        maxQueueSize: 5
      }
    })

    // Frontend Developer with enhanced capabilities
    this.registerSpecializedAgent({
      name: 'frontend-developer',
      description: 'Frontend developer specializing in React, TypeScript, and modern web technologies',
      systemPrompt: `You are a senior frontend developer with expertise in:
- React 18+ with TypeScript and modern hooks patterns
- State management (Redux Toolkit, Zustand, React Query)
- Performance optimization and Core Web Vitals
- Accessibility (WCAG 2.1 AA compliance)
- Testing (Jest, React Testing Library, Playwright)
- Build tools and bundling optimization

Your role is to:
1. Implement clean, maintainable React components with TypeScript
2. Ensure responsive design and accessibility compliance
3. Optimize for performance and user experience
4. Write comprehensive tests and documentation
5. Follow modern React patterns and best practices
6. Review frontend code for quality and maintainability`,
      model: 'gpt-4',
      temperature: 0.2,
      specialization: [
        'react-development',
        'typescript-implementation',
        'performance-optimization',
        'accessibility-compliance',
        'state-management',
        'frontend-testing'
      ],
      capabilities: [
        {
          name: 'component-development',
          description: 'Develop React components with TypeScript',
          category: 'generation',
          complexity: 'medium',
          estimatedDuration: 30,
          requirements: { memory: 256, cpu: 'medium' }
        },
        {
          name: 'ui-optimization',
          description: 'Optimize user interface for performance and accessibility',
          category: 'optimization',
          complexity: 'high',
          estimatedDuration: 45,
          requirements: { memory: 512, cpu: 'high' }
        }
      ],
      performanceMetrics: {
        averageResponseTime: 90,
        successRate: 0.93,
        qualityScore: 0.89
      },
      loadLimits: {
        maxConcurrentTasks: 3,
        maxQueueSize: 8
      }
    })

    // Backend Developer with enhanced capabilities  
    this.registerSpecializedAgent({
      name: 'backend-developer',
      description: 'Backend developer specializing in Node.js, databases, and API design',
      systemPrompt: `You are a senior backend developer with expertise in:
- Node.js and TypeScript server development
- RESTful and GraphQL API design and implementation
- Database design and optimization (PostgreSQL, MongoDB, Redis)
- Authentication, authorization, and security
- Microservices and distributed systems
- Performance optimization and monitoring

Your role is to:
1. Design and implement robust, scalable APIs
2. Implement proper error handling, validation, and security
3. Optimize database queries and data structures
4. Write comprehensive tests and documentation
5. Consider performance, scalability, and maintainability
6. Review backend code for security and best practices`,
      model: 'gpt-4',
      temperature: 0.2,
      specialization: [
        'api-development',
        'database-design',
        'security-implementation',
        'performance-optimization',
        'microservices-development',
        'backend-testing'
      ],
      capabilities: [
        {
          name: 'api-development',
          description: 'Develop REST and GraphQL APIs',
          category: 'generation',
          complexity: 'high',
          estimatedDuration: 60,
          requirements: { memory: 512, cpu: 'high' }
        },
        {
          name: 'database-optimization',
          description: 'Optimize database performance and structure',
          category: 'optimization',
          complexity: 'high',
          estimatedDuration: 45,
          requirements: { memory: 256, cpu: 'medium' }
        }
      ],
      performanceMetrics: {
        averageResponseTime: 110,
        successRate: 0.91,
        qualityScore: 0.88
      },
      loadLimits: {
        maxConcurrentTasks: 2,
        maxQueueSize: 6
      }
    })

    // Code Reviewer with enhanced validation capabilities
    this.registerSpecializedAgent({
      name: 'code-reviewer',
      description: 'Senior code reviewer focusing on quality, security, and best practices',
      systemPrompt: `You are a senior code reviewer with expertise in:
- Code quality assessment and maintainability analysis
- Security vulnerability identification and mitigation
- Performance optimization and code efficiency
- Testing strategy evaluation and coverage analysis
- Documentation quality and completeness
- Architecture compliance and design pattern validation

Your role is to:
1. Conduct thorough code reviews with detailed feedback
2. Identify security vulnerabilities and suggest fixes
3. Evaluate performance implications and optimizations
4. Assess test coverage and quality
5. Verify documentation completeness and accuracy
6. Validate architectural compliance and design patterns
7. Provide constructive, actionable improvement suggestions`,
      model: 'gpt-4',
      temperature: 0.1,
      specialization: [
        'security-review',
        'performance-analysis',
        'code-quality-assessment',
        'testing-evaluation',
        'documentation-review',
        'architecture-validation'
      ],
      capabilities: [
        {
          name: 'security-audit',
          description: 'Audit code for security vulnerabilities',
          category: 'review',
          complexity: 'high',
          estimatedDuration: 40,
          requirements: { memory: 384, cpu: 'high' }
        },
        {
          name: 'quality-assessment',
          description: 'Assess overall code quality and maintainability',
          category: 'analysis',
          complexity: 'medium',
          estimatedDuration: 25,
          requirements: { memory: 256, cpu: 'medium' }
        }
      ],
      performanceMetrics: {
        averageResponseTime: 85,
        successRate: 0.96,
        qualityScore: 0.94
      },
      loadLimits: {
        maxConcurrentTasks: 4,
        maxQueueSize: 10
      }
    })

    // DevOps Engineer with deployment and monitoring focus
    this.registerSpecializedAgent({
      name: 'devops-engineer',
      description: 'DevOps engineer specializing in deployment, monitoring, and infrastructure',
      systemPrompt: `You are a senior DevOps engineer with expertise in:
- Container orchestration (Docker, Kubernetes)
- CI/CD pipeline design and implementation
- Infrastructure as Code (Terraform, CloudFormation)
- Monitoring and observability (Prometheus, Grafana, Datadog)
- Cloud platforms (AWS, Azure, GCP)
- Security and compliance automation

Your role is to:
1. Design and implement deployment strategies
2. Create robust CI/CD pipelines with proper testing
3. Implement comprehensive monitoring and alerting
4. Ensure security best practices and compliance
5. Optimize resource utilization and cost efficiency
6. Provide disaster recovery and backup strategies
7. Review infrastructure code and deployment configurations`,
      model: 'gpt-4',
      temperature: 0.1,
      specialization: [
        'container-orchestration',
        'cicd-pipelines',
        'infrastructure-automation',
        'monitoring-setup',
        'security-compliance',
        'resource-optimization'
      ],
      capabilities: [
        {
          name: 'deployment-strategy',
          description: 'Design deployment and infrastructure strategies',
          category: 'planning',
          complexity: 'high',
          estimatedDuration: 50,
          requirements: { memory: 384, cpu: 'high' }
        },
        {
          name: 'monitoring-setup',
          description: 'Implement monitoring and observability solutions',
          category: 'execution',
          complexity: 'medium',
          estimatedDuration: 35,
          requirements: { memory: 256, cpu: 'medium' }
        }
      ],
      performanceMetrics: {
        averageResponseTime: 95,
        successRate: 0.92,
        qualityScore: 0.90
      },
      loadLimits: {
        maxConcurrentTasks: 2,
        maxQueueSize: 5
      }
    })

    // Initialize agent load tracking
    for (const [name] of this.specializedAgents) {
      this.agentLoads.set(name, {
        activeTasks: 0,
        queuedTasks: 0,
        averageResponseTime: 0,
        lastActivity: new Date()
      })
    }
  }

  /**
   * Register a specialized agent role
   */
  registerSpecializedAgent(role: SpecializedAgentRole): void {
    this.specializedAgents.set(role.name, role)
    this.workflow.addAgentRole(role)
    
    // Initialize load tracking
    this.agentLoads.set(role.name, {
      activeTasks: 0,
      queuedTasks: 0,
      averageResponseTime: role.performanceMetrics.averageResponseTime,
      lastActivity: new Date()
    })
  }

  /**
   * Create an intelligent orchestration plan with parallel execution groups
   */
  async createOrchestrationPlan(goal: string, requirements?: Partial<TaskMetrics>): Promise<OrchestrationPlan> {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Analyze the goal and break it down into tasks
    const tasks = await this.analyzeAndDecompose(goal, requirements)
    
    // Create orchestration steps with enhanced metrics
    const steps: OrchestrationStep[] = tasks.map(task => ({
      ...task,
      assignedAgent: this.selectOptimalAgent(task.metrics),
      resourceUsage: undefined,
      validationResults: undefined
    }))

    // Organize steps into parallel execution groups
    const parallelGroups = this.createParallelExecutionGroups(steps)
    
    // Calculate resource requirements
    const resourceRequirements = this.calculateResourceRequirements(steps)
    
    // Create validation plan
    const validationPlan = this.createValidationPlan(steps)

    const plan: OrchestrationPlan = {
      id: planId,
      goal,
      steps,
      parallelGroups,
      totalEstimatedTime: Math.max(...parallelGroups.map(group => 
        group.reduce((sum, step) => sum + step.metrics.estimatedDuration, 0)
      )),
      resourceRequirements,
      validationPlan
    }

    this.activePlans.set(planId, plan)
    return plan
  }

  /**
   * Execute orchestration plan with parallel processing and validation
   */
  async executeOrchestrationPlan(planId: string): Promise<Map<string, WorkflowResult>> {
    const plan = this.activePlans.get(planId)
    if (!plan) {
      throw new Error(`Orchestration plan ${planId} not found`)
    }

    const results = new Map<string, WorkflowResult>()
    this.executionResults.set(planId, results)

    try {
      // Execute parallel groups sequentially, but steps within groups in parallel
      for (const group of plan.parallelGroups) {
        const groupPromises = group.map(step => this.executeStep(step, results))
        const groupResults = await Promise.allSettled(groupPromises)
        
        // Check for failures and handle them
        groupResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Step ${group[index].id} failed:`, result.reason)
            throw new Error(`Critical step failed: ${group[index].id}`)
          }
        })
      }

      // Execute validation steps
      await this.executeValidationPlan(plan, results)

      return results
    } catch (error) {
      console.error(`Orchestration plan ${planId} execution failed:`, error)
      throw error
    } finally {
      this.activePlans.delete(planId)
    }
  }

  /**
   * Get orchestration status and metrics
   */
  getOrchestrationStatus(planId: string): any {
    const plan = this.activePlans.get(planId)
    const results = this.executionResults.get(planId)
    
    if (!plan) {
      return null
    }

    const completedSteps = results?.size || 0
    const totalSteps = plan.steps.length
    const failedSteps = Array.from(results?.values() || [])
      .filter(result => result.output?.error).length

    return {
      planId,
      goal: plan.goal,
      totalSteps,
      completedSteps,
      failedSteps,
      progress: completedSteps / totalSteps,
      estimatedTimeRemaining: plan.totalEstimatedTime * (1 - (completedSteps / totalSteps)),
      resourceUsage: this.calculateCurrentResourceUsage(),
      agentLoads: this.getAgentLoadSummary()
    }
  }

  // Private helper methods continue in next part...
  
  /**
   * Analyze goal and decompose into executable tasks
   */
  private async analyzeAndDecompose(goal: string, requirements?: Partial<TaskMetrics>): Promise<OrchestrationStep[]> {
    // This would use AI to analyze the goal and break it into tasks
    // For now, return a basic decomposition based on the goal type
    
    const defaultMetrics: TaskMetrics = {
      priority: 'medium',
      complexity: 5,
      estimatedDuration: 30,
      resourceRequirements: {
        memory: 256,
        cpu: 'medium',
        parallelizable: true
      },
      dependencies: [],
      validation: {
        required: true,
        reviewers: ['code-reviewer'],
        criteria: ['quality', 'security', 'performance']
      },
      ...requirements
    }

    // Basic task decomposition - this could be enhanced with AI analysis
    if (goal.toLowerCase().includes('code generation') || goal.toLowerCase().includes('implement')) {
      return [
        {
          id: 'architecture-planning',
          agentRole: 'architect',
          input: `Design system architecture for: ${goal}`,
          metrics: { ...defaultMetrics, priority: 'high', complexity: 8 },
          assignedAgent: 'architect'
        },
        {
          id: 'frontend-implementation',
          agentRole: 'frontend-developer',
          input: `Implement frontend components for: ${goal}`,
          dependencies: ['architecture-planning'],
          metrics: { ...defaultMetrics, complexity: 6 },
          assignedAgent: 'frontend-developer'
        },
        {
          id: 'backend-implementation',
          agentRole: 'backend-developer',
          input: `Implement backend services for: ${goal}`,
          dependencies: ['architecture-planning'],
          metrics: { ...defaultMetrics, complexity: 7 },
          assignedAgent: 'backend-developer'
        },
        {
          id: 'integration-review',
          agentRole: 'code-reviewer',
          input: `Review integration and overall code quality for: ${goal}`,
          dependencies: ['frontend-implementation', 'backend-implementation'],
          metrics: { ...defaultMetrics, complexity: 4 },
          assignedAgent: 'code-reviewer'
        }
      ]
    }

    // Default single-step task
    return [{
      id: 'main-task',
      agentRole: this.selectOptimalAgent(defaultMetrics),
      input: goal,
      metrics: defaultMetrics,
      assignedAgent: this.selectOptimalAgent(defaultMetrics)
    }]
  }

  /**
   * Select optimal agent based on task metrics and current load
   */
  private selectOptimalAgent(metrics: TaskMetrics): string {
    let bestAgent = 'architect' // default fallback
    let bestScore = -1

    for (const [agentName, agent] of this.specializedAgents) {
      const load = this.agentLoads.get(agentName)!
      
      // Skip if agent is overloaded
      if (load.activeTasks >= agent.loadLimits.maxConcurrentTasks) {
        continue
      }

      // Calculate suitability score
      const capabilityMatch = this.calculateCapabilityMatch(agent, metrics)
      const loadPenalty = load.activeTasks / agent.loadLimits.maxConcurrentTasks
      const performanceBonus = agent.performanceMetrics.successRate * agent.performanceMetrics.qualityScore
      
      const score = capabilityMatch + performanceBonus - loadPenalty

      if (score > bestScore) {
        bestScore = score
        bestAgent = agentName
      }
    }

    return bestAgent
  }

  /**
   * Calculate how well an agent's capabilities match task requirements
   */
  private calculateCapabilityMatch(agent: SpecializedAgentRole, metrics: TaskMetrics): number {
    // Simple matching algorithm - could be enhanced with ML
    let score = 0
    
    // Base capability score
    score += agent.capabilities.length * 0.1
    
    // Complexity match
    const complexityMatch = agent.capabilities.some(cap => 
      cap.complexity === (metrics.complexity > 7 ? 'high' : metrics.complexity > 4 ? 'medium' : 'low')
    ) ? 0.3 : 0
    score += complexityMatch
    
    // Performance metrics
    score += agent.performanceMetrics.qualityScore * 0.4
    
    return Math.min(score, 1.0)
  }

  /**
   * Create parallel execution groups based on dependencies
   */
  private createParallelExecutionGroups(steps: OrchestrationStep[]): OrchestrationStep[][] {
    const groups: OrchestrationStep[][] = []
    const processed = new Set<string>()
    const remaining = [...steps]

    while (remaining.length > 0) {
      const currentGroup: OrchestrationStep[] = []
      
      // Find steps that can be executed (all dependencies satisfied)
      for (let i = remaining.length - 1; i >= 0; i--) {
        const step = remaining[i]
        const canExecute = step.dependencies?.every(dep => processed.has(dep)) ?? true
        
        if (canExecute) {
          currentGroup.push(step)
          remaining.splice(i, 1)
          processed.add(step.id)
        }
      }

      if (currentGroup.length === 0) {
        throw new Error('Circular dependency detected in orchestration plan')
      }

      groups.push(currentGroup)
    }

    return groups
  }

  /**
   * Calculate total resource requirements for the plan
   */
  private calculateResourceRequirements(steps: OrchestrationStep[]): { totalMemory: number; peakConcurrency: number } {
    let totalMemory = 0
    let peakConcurrency = 0

    // Find the maximum parallel group size for peak concurrency
    const parallelGroups = this.createParallelExecutionGroups(steps)
    peakConcurrency = Math.max(...parallelGroups.map(group => group.length))

    // Calculate total memory as the sum of all step requirements
    for (const step of steps) {
      totalMemory += step.metrics.resourceRequirements.memory
    }

    return { totalMemory, peakConcurrency }
  }

  /**
   * Create validation plan for orchestration steps
   */
  private createValidationPlan(steps: OrchestrationStep[]): ValidationStep[] {
    const validationSteps: ValidationStep[] = []

    for (const step of steps) {
      if (step.metrics.validation.required) {
        for (const reviewer of step.metrics.validation.reviewers) {
          validationSteps.push({
            id: `validate-${step.id}-${reviewer}`,
            targetStepId: step.id,
            validatorRole: reviewer,
            criteria: step.metrics.validation.criteria
          })
        }
      }
    }

    return validationSteps
  }

  /**
   * Execute a single orchestration step
   */
  private async executeStep(step: OrchestrationStep, results: Map<string, WorkflowResult>): Promise<void> {
    const startTime = new Date()
    step.startTime = startTime

    // Update agent load
    const load = this.agentLoads.get(step.assignedAgent)!
    load.activeTasks++
    load.lastActivity = startTime

    try {
      // Execute the step using the workflow
      const workflowSteps: WorkflowStep[] = [step]
      const stepResults = await this.workflow.executeWorkflow(workflowSteps)
      
      const result = stepResults[0]
      step.endTime = new Date()
      step.resourceUsage = {
        memory: step.metrics.resourceRequirements.memory,
        duration: step.endTime.getTime() - startTime.getTime()
      }

      results.set(step.id, result)

      // Update agent load
      load.activeTasks--
      load.averageResponseTime = (load.averageResponseTime + step.resourceUsage.duration) / 2

    } catch (error) {
      step.endTime = new Date()
      load.activeTasks--
      throw error
    }
  }

  /**
   * Execute validation plan
   */
  private async executeValidationPlan(plan: OrchestrationPlan, results: Map<string, WorkflowResult>): Promise<void> {
    for (const validationStep of plan.validationPlan) {
      const targetResult = results.get(validationStep.targetStepId)
      if (!targetResult) continue

      try {
        const validationPrompt = `
        Validate the following result according to these criteria: ${validationStep.criteria.join(', ')}
        
        Original input: ${targetResult.input}
        Result to validate: ${JSON.stringify(targetResult.output)}
        
        Provide validation in JSON format:
        {
          "passed": boolean,
          "score": number (0-1),
          "feedback": "detailed feedback",
          "issues": [{"severity": "low|medium|high|critical", "description": "issue description", "suggestion": "optional fix suggestion"}]
        }
        `

        const validationResult = await this.workflow.executeWorkflow([{
          id: validationStep.id,
          agentRole: validationStep.validatorRole,
          input: validationPrompt,
          outputSchema: z.object({
            passed: z.boolean(),
            score: z.number().min(0).max(1),
            feedback: z.string(),
            issues: z.array(z.object({
              severity: z.enum(['low', 'medium', 'high', 'critical']),
              description: z.string(),
              suggestion: z.string().optional()
            }))
          })
        }])

        // Find the target step and add validation result
        const targetStep = plan.steps.find(s => s.id === validationStep.targetStepId)
        if (targetStep) {
          if (!targetStep.validationResults) {
            targetStep.validationResults = []
          }
          targetStep.validationResults.push({
            validatorRole: validationStep.validatorRole,
            ...validationResult[0].output
          })
        }

      } catch (error) {
        console.error(`Validation step ${validationStep.id} failed:`, error)
      }
    }
  }

  /**
   * Calculate current resource usage across all active plans
   */
  private calculateCurrentResourceUsage(): { memory: number; activeTasks: number } {
    let totalMemory = 0
    let activeTasks = 0

    for (const load of this.agentLoads.values()) {
      activeTasks += load.activeTasks
      // Estimate memory usage based on active tasks (simplified)
      totalMemory += load.activeTasks * 256 // 256MB per task estimate
    }

    return { memory: totalMemory, activeTasks }
  }

  /**
   * Get summary of agent loads
   */
  private getAgentLoadSummary(): Record<string, AgentLoad> {
    const summary: Record<string, AgentLoad> = {}
    for (const [agentName, load] of this.agentLoads) {
      summary[agentName] = { ...load }
    }
    return summary
  }

  /**
   * Get all specialized agent roles
   */
  getSpecializedAgents(): SpecializedAgentRole[] {
    return Array.from(this.specializedAgents.values())
  }

  /**
   * Get agent performance metrics
   */
  getAgentMetrics(agentName: string): SpecializedAgentRole['performanceMetrics'] | null {
    const agent = this.specializedAgents.get(agentName)
    return agent?.performanceMetrics || null
  }
}

// Factory function for creating orchestrator instances
export function createAgentOrchestrator(aiClient?: UnifiedAIClient): AgentOrchestrator {
  return new AgentOrchestrator(aiClient)
}

// Export default instance
export const defaultOrchestrator = createAgentOrchestrator()