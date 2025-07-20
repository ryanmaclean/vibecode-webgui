// Agent Framework Foundation - Basic multi-agent coordination system
// Designed for future LangChain integration while providing immediate value

import { UnifiedAIClient, type UnifiedChatMessage } from './unified-ai-client'
import { ollamaClient } from './ollama-client'
import { vectorStore } from './vector-store'

export interface AgentCapability {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (input: any, context: AgentContext) => Promise<any>
}

export interface AgentContext {
  workspaceId: string
  userId: string
  sessionId: string
  aiClient: UnifiedAIClient
  previousResults: Map<string, any>
  maxSteps: number
  currentStep: number
}

export interface AgentTask {
  id: string
  description: string
  priority: 'low' | 'medium' | 'high'
  estimatedTime?: number
  dependencies?: string[]
  capabilities: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
}

export interface AgentPlan {
  goal: string
  tasks: AgentTask[]
  estimatedTotalTime: number
  requiredCapabilities: string[]
}

export class Agent {
  private id: string
  private name: string
  private description: string
  private capabilities: Map<string, AgentCapability>
  private aiClient: UnifiedAIClient
  private model: string

  constructor(
    id: string,
    name: string,
    description: string,
    aiClient: UnifiedAIClient,
    model: string = 'gpt-4'
  ) {
    this.id = id
    this.name = name
    this.description = description
    this.capabilities = new Map()
    this.aiClient = aiClient
    this.model = model
  }

  addCapability(capability: AgentCapability): void {
    this.capabilities.set(capability.name, capability)
  }

  getCapabilities(): string[] {
    return Array.from(this.capabilities.keys())
  }

  async executeTask(task: AgentTask, context: AgentContext): Promise<any> {
    console.log(`Agent ${this.name} executing task: ${task.description}`)
    
    try {
      // Check if agent has required capabilities
      const missingCapabilities = task.capabilities.filter(
        cap => !this.capabilities.has(cap)
      )
      
      if (missingCapabilities.length > 0) {
        throw new Error(`Missing capabilities: ${missingCapabilities.join(', ')}`)
      }

      // Build task execution prompt
      const systemPrompt = `You are ${this.name}, ${this.description}.

Available capabilities: ${this.getCapabilities().join(', ')}

Current task: ${task.description}
Priority: ${task.priority}
Workspace: ${context.workspaceId}

Execute this task step by step, using available capabilities as needed.
Provide detailed reasoning and results.`

      const messages: UnifiedChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Execute task: ${task.description}` }
      ]

      // Use AI to reason about the task
      const response = await this.aiClient.chat(messages, this.model)
      
      // Execute any required capabilities
      let finalResult = response.content
      
      for (const capabilityName of task.capabilities) {
        const capability = this.capabilities.get(capabilityName)
        if (capability) {
          try {
            const capResult = await capability.execute(
              { task, aiResponse: response.content }, 
              context
            )
            finalResult = { aiReasoning: response.content, capabilityResults: capResult }
          } catch (error) {
            console.warn(`Capability ${capabilityName} failed:`, error)
          }
        }
      }

      return finalResult
    } catch (error) {
      console.error(`Agent ${this.name} task execution failed:`, error)
      throw error
    }
  }
}

export class AgentCoordinator {
  private agents: Map<string, Agent> = new Map()
  private activeWorkflows: Map<string, AgentWorkflow> = new Map()
  private defaultAIClient: UnifiedAIClient

  constructor(aiClient: UnifiedAIClient) {
    this.defaultAIClient = aiClient
    this.initializeBuiltInAgents()
  }

  private initializeBuiltInAgents(): void {
    // Code Analysis Agent
    const codeAgent = new Agent(
      'code-analyzer',
      'Code Analysis Agent',
      'Expert at analyzing code structure, dependencies, and quality',
      this.defaultAIClient,
      'gpt-4'
    )

    codeAgent.addCapability({
      name: 'analyze-codebase',
      description: 'Analyze codebase structure and patterns',
      parameters: { workspaceId: 'string' },
      execute: async (input, context) => {
        // Use vector search to get code context
        const codeContext = await vectorStore.getContext(
          'code structure dependencies patterns',
          context.workspaceId,
          5000,
          0.6
        )
        return { analysis: codeContext, type: 'codebase-analysis' }
      }
    })

    // Documentation Agent
    const docsAgent = new Agent(
      'documentation',
      'Documentation Agent', 
      'Specialist in creating and maintaining project documentation',
      this.defaultAIClient,
      'gpt-4'
    )

    docsAgent.addCapability({
      name: 'generate-docs',
      description: 'Generate documentation from code',
      parameters: { files: 'string[]', style: 'string' },
      execute: async (input, context) => {
        // Generate documentation based on code analysis
        return { documentation: 'Generated docs', type: 'documentation' }
      }
    })

    // Testing Agent
    const testAgent = new Agent(
      'test-generator',
      'Test Generation Agent',
      'Expert at creating comprehensive test suites',
      this.defaultAIClient,
      'gpt-4'
    )

    testAgent.addCapability({
      name: 'generate-tests',
      description: 'Generate test cases for code',
      parameters: { files: 'string[]', framework: 'string' },
      execute: async (input, context) => {
        // Generate tests based on code analysis
        return { tests: 'Generated test suite', type: 'test-generation' }
      }
    })

    this.agents.set(codeAgent.id, codeAgent)
    this.agents.set(docsAgent.id, docsAgent)
    this.agents.set(testAgent.id, testAgent)
  }

  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent)
  }

  async createPlan(goal: string, context: AgentContext): Promise<AgentPlan> {
    const planningPrompt = `Create a detailed execution plan for the following goal:

Goal: ${goal}

Available agents and their capabilities:
${Array.from(this.agents.values()).map(agent => 
  `- ${agent.name}: ${agent.getCapabilities().join(', ')}`
).join('\n')}

Break down the goal into specific, actionable tasks. For each task, specify:
1. Clear description
2. Required capabilities
3. Estimated time (in minutes)
4. Dependencies on other tasks
5. Priority level

Respond in JSON format with the following structure:
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Task description",
      "capabilities": ["capability1", "capability2"],
      "estimatedTime": 30,
      "dependencies": [],
      "priority": "high"
    }
  ]
}`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are an expert project planner and task decomposition specialist.' },
      { role: 'user', content: planningPrompt }
    ]

    const response = await this.defaultAIClient.chat(messages, 'gpt-4')
    
    try {
      const planData = JSON.parse(response.content)
      const tasks: AgentTask[] = planData.tasks.map((t: any) => ({
        ...t,
        status: 'pending' as const
      }))

      return {
        goal,
        tasks,
        estimatedTotalTime: tasks.reduce((sum, task) => sum + (task.estimatedTime || 30), 0),
        requiredCapabilities: [...new Set(tasks.flatMap(task => task.capabilities))]
      }
    } catch (error) {
      throw new Error('Failed to parse planning response')
    }
  }

  async executePlan(plan: AgentPlan, context: AgentContext): Promise<Map<string, any>> {
    const workflow = new AgentWorkflow(plan, this.agents, context)
    this.activeWorkflows.set(context.sessionId, workflow)
    
    try {
      const results = await workflow.execute()
      this.activeWorkflows.delete(context.sessionId)
      return results
    } catch (error) {
      this.activeWorkflows.delete(context.sessionId)
      throw error
    }
  }

  async executeGoal(goal: string, context: AgentContext): Promise<Map<string, any>> {
    const plan = await this.createPlan(goal, context)
    return await this.executePlan(plan, context)
  }

  getActiveWorkflows(): string[] {
    return Array.from(this.activeWorkflows.keys())
  }

  getWorkflowStatus(sessionId: string): any {
    const workflow = this.activeWorkflows.get(sessionId)
    return workflow ? workflow.getStatus() : null
  }
}

export class AgentWorkflow {
  private plan: AgentPlan
  private agents: Map<string, Agent>
  private context: AgentContext
  private results: Map<string, any> = new Map()
  private currentTaskIndex: number = 0

  constructor(plan: AgentPlan, agents: Map<string, Agent>, context: AgentContext) {
    this.plan = plan
    this.agents = agents
    this.context = context
  }

  async execute(): Promise<Map<string, any>> {
    console.log(`Executing workflow for goal: ${this.plan.goal}`)
    
    // Sort tasks by dependencies and priority
    const sortedTasks = this.topologicalSort(this.plan.tasks)
    
    for (const task of sortedTasks) {
      this.currentTaskIndex++
      this.context.currentStep = this.currentTaskIndex
      
      try {
        task.status = 'running'
        
        // Find appropriate agent for this task
        const agent = this.findBestAgent(task)
        if (!agent) {
          throw new Error(`No suitable agent found for task: ${task.description}`)
        }

        console.log(`Executing task ${task.id} with agent ${agent.name}`)
        
        const result = await agent.executeTask(task, this.context)
        
        task.status = 'completed'
        task.result = result
        this.results.set(task.id, result)
        
        // Store result for future tasks
        this.context.previousResults.set(task.id, result)
        
      } catch (error) {
        task.status = 'failed'
        task.error = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Task ${task.id} failed:`, error)
        
        // Decide whether to continue or abort based on task priority
        if (task.priority === 'high') {
          throw new Error(`Critical task failed: ${task.description}`)
        }
      }
    }

    return this.results
  }

  private findBestAgent(task: AgentTask): Agent | null {
    const candidates = Array.from(this.agents.values()).filter(agent => {
      const agentCapabilities = agent.getCapabilities()
      return task.capabilities.every(cap => agentCapabilities.includes(cap))
    })

    // Return the first suitable agent (could be enhanced with scoring)
    return candidates.length > 0 ? candidates[0] : null
  }

  private topologicalSort(tasks: AgentTask[]): AgentTask[] {
    const sorted: AgentTask[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (task: AgentTask) => {
      if (visiting.has(task.id)) {
        throw new Error(`Circular dependency detected involving task: ${task.id}`)
      }
      
      if (visited.has(task.id)) {
        return
      }

      visiting.add(task.id)

      // Visit dependencies first
      for (const depId of task.dependencies || []) {
        const depTask = tasks.find(t => t.id === depId)
        if (depTask) {
          visit(depTask)
        }
      }

      visiting.delete(task.id)
      visited.add(task.id)
      sorted.push(task)
    }

    // Sort by priority first, then visit
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    const prioritySorted = [...tasks].sort((a, b) => 
      priorityOrder[b.priority] - priorityOrder[a.priority]
    )

    for (const task of prioritySorted) {
      visit(task)
    }

    return sorted
  }

  getStatus(): any {
    const completedTasks = this.plan.tasks.filter(t => t.status === 'completed').length
    const failedTasks = this.plan.tasks.filter(t => t.status === 'failed').length
    const runningTasks = this.plan.tasks.filter(t => t.status === 'running').length
    
    return {
      goal: this.plan.goal,
      totalTasks: this.plan.tasks.length,
      completed: completedTasks,
      failed: failedTasks,
      running: runningTasks,
      progress: completedTasks / this.plan.tasks.length,
      currentStep: this.currentTaskIndex,
      estimatedTimeRemaining: this.plan.estimatedTotalTime * (1 - (completedTasks / this.plan.tasks.length))
    }
  }
}

// Factory function to create agent coordinator with VibeCode configuration
export function createVibeCodeAgentCoordinator(userApiKeys: any = {}): AgentCoordinator {
  const aiClient = new UnifiedAIClient(userApiKeys)
  return new AgentCoordinator(aiClient)
}

// Built-in agent workflows for common tasks
export const BUILT_IN_WORKFLOWS = {
  'analyze-project': {
    description: 'Comprehensive project analysis including code quality, architecture, and documentation',
    estimatedTime: 45,
    capabilities: ['analyze-codebase', 'generate-docs']
  },
  'enhance-testing': {
    description: 'Analyze test coverage and generate additional tests',
    estimatedTime: 60,
    capabilities: ['analyze-codebase', 'generate-tests']
  },
  'code-review': {
    description: 'Automated code review with suggestions and documentation',
    estimatedTime: 30,
    capabilities: ['analyze-codebase', 'generate-docs']
  }
} as const

export type WorkflowType = keyof typeof BUILT_IN_WORKFLOWS

// Export default instance for immediate use
const defaultCoordinator = createVibeCodeAgentCoordinator()
export { defaultCoordinator as agentCoordinator }