import { AgentOrchestrator, createAgentOrchestrator, SpecializedAgentRole, OrchestrationPlan, TaskMetrics } from '@/lib/ai/agent-orchestrator'
import { MultiAgentWorkflow } from '@/lib/ai/agents/multi-agent-workflow'

// Mock the MultiAgentWorkflow
jest.mock('@/lib/ai/agents/multi-agent-workflow')

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let mockWorkflow: jest.Mocked<MultiAgentWorkflow>;

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock MultiAgentWorkflow
    mockWorkflow = {
      addAgentRole: jest.fn(),
      executeWorkflow: jest.fn().mockResolvedValue([
        {
          stepId: 'test-step',
          agentRole: 'architect',
          input: 'test input',
          output: { result: 'test output' },
          metadata: {
            model: 'gpt-4',
            duration: 1000,
            timestamp: new Date().toISOString()
          }
        }
      ]),
      getResult: jest.fn(),
      getAllResults: jest.fn(),
      clearResults: jest.fn()
    } as any

    ;(MultiAgentWorkflow as jest.MockedClass<typeof MultiAgentWorkflow>).mockImplementation(() => mockWorkflow)
    
    orchestrator = new AgentOrchestrator()
  })

  describe('initialization', () => {
    it('should create an orchestrator instance', () => {
      expect(orchestrator).toBeInstanceOf(AgentOrchestrator)
    })

    it('should initialize with specialized agents', () => {
      const agents = orchestrator.getSpecializedAgents()
      expect(agents).toHaveLength(5)
      
      const agentNames = agents.map(agent => agent.name)
      expect(agentNames).toContain('architect')
      expect(agentNames).toContain('frontend-developer')
      expect(agentNames).toContain('backend-developer')
      expect(agentNames).toContain('code-reviewer')
      expect(agentNames).toContain('devops-engineer')
    })

    it('should register agents with the workflow', () => {
      expect(mockWorkflow.addAgentRole).toHaveBeenCalledTimes(5)
    })
  })

  describe('agent specialization', () => {
    it('should have properly defined agent capabilities', () => {
      const agents = orchestrator.getSpecializedAgents()
      
      for (const agent of agents) {
        expect(agent.specialization).toBeDefined()
        expect(agent.specialization.length).toBeGreaterThan(0)
        expect(agent.capabilities).toBeDefined()
        expect(agent.capabilities.length).toBeGreaterThan(0)
        expect(agent.performanceMetrics).toBeDefined()
        expect(agent.loadLimits).toBeDefined()
      }
    })

    it('should have architect with system design capabilities', () => {
      const agents = orchestrator.getSpecializedAgents()
      const architect = agents.find(a => a.name === 'architect')
      
      expect(architect).toBeDefined()
      expect(architect!.specialization).toContain('system-architecture')
      expect(architect!.capabilities.some(cap => cap.name === 'system-design')).toBe(true)
    })

    it('should have code-reviewer with validation capabilities', () => {
      const agents = orchestrator.getSpecializedAgents()
      const reviewer = agents.find(a => a.name === 'code-reviewer')
      
      expect(reviewer).toBeDefined()
      expect(reviewer!.specialization).toContain('security-review')
      expect(reviewer!.capabilities.some(cap => cap.name === 'security-audit')).toBe(true)
    })
  })

  describe('orchestration planning', () => {
    it('should create an orchestration plan for code generation', async () => {
      const goal = 'Implement a user authentication system'
      const plan = await orchestrator.createOrchestrationPlan(goal)
      
      expect(plan).toBeDefined()
      expect(plan.id).toMatch(/^plan-\d+-\w+$/)
      expect(plan.goal).toBe(goal)
      expect(plan.steps).toBeDefined()
      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.parallelGroups).toBeDefined()
      expect(plan.totalEstimatedTime).toBeGreaterThan(0)
      expect(plan.resourceRequirements).toBeDefined()
      expect(plan.validationPlan).toBeDefined()
    })

    it('should create parallel execution groups with proper dependencies', async () => {
      const goal = 'Implement a complete web application'
      const plan = await orchestrator.createOrchestrationPlan(goal)
      
      // First group should contain architecture planning
      const firstGroup = plan.parallelGroups[0]
      expect(firstGroup.some(step => step.id === 'architecture-planning')).toBe(true)
      
      // Subsequent groups should have steps that depend on architecture
      if (plan.parallelGroups.length > 1) {
        const secondGroup = plan.parallelGroups[1]
        expect(secondGroup.every(step => 
          step.dependencies?.includes('architecture-planning') || step.id === 'architecture-planning'
        )).toBe(true)
      }
    })

    it('should assign optimal agents to tasks', async () => {
      const goal = 'Create system architecture documentation'
      const plan = await orchestrator.createOrchestrationPlan(goal)
      
      // Should prefer architect for architecture tasks
      const architectureStep = plan.steps.find(step => 
        step.id.includes('architecture') || step.input.toLowerCase().includes('architecture')
      )
      if (architectureStep) {
        expect(architectureStep.assignedAgent).toBe('architect')
      }
    })

    it('should calculate resource requirements correctly', async () => {
      const goal = 'Implement microservices architecture'
      const plan = await orchestrator.createOrchestrationPlan(goal)
      
      expect(plan.resourceRequirements.totalMemory).toBeGreaterThan(0)
      expect(plan.resourceRequirements.peakConcurrency).toBeGreaterThan(0)
      expect(plan.resourceRequirements.peakConcurrency).toBeLessThanOrEqual(plan.steps.length)
    })
  })

  describe('orchestration execution', () => {
    it('should execute an orchestration plan successfully', async () => {
      const goal = 'Simple code review task'
      const plan = await orchestrator.createOrchestrationPlan(goal)
      
      const results = await orchestrator.executeOrchestrationPlan(plan.id)
      
      expect(results).toBeInstanceOf(Map)
      expect(results.size).toBeGreaterThan(0)
      expect(mockWorkflow.executeWorkflow).toHaveBeenCalled()
    })

    it('should handle step execution with timing', async () => {
      const goal = 'Test timing measurement'
      const plan = await orchestrator.createOrchestrationPlan(goal)
      
      const startTime = Date.now()
      await orchestrator.executeOrchestrationPlan(plan.id)
      const endTime = Date.now()
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000) // 5 seconds max for test
    })

    it('should provide orchestration status during execution', async () => {
      const goal = 'Status tracking test'
      const plan = await orchestrator.createOrchestrationPlan(goal)
      
      // Check status before execution
      const initialStatus = orchestrator.getOrchestrationStatus(plan.id)
      expect(initialStatus).toBeDefined()
      expect(initialStatus.completedSteps).toBe(0)
      expect(initialStatus.progress).toBe(0)
      
      // Execute and check final status
      await orchestrator.executeOrchestrationPlan(plan.id)
      const finalStatus = orchestrator.getOrchestrationStatus(plan.id)
      expect(finalStatus).toBeNull() // Plan should be cleaned up after execution
    })
  })

  describe('agent load balancing', () => {
    it('should track agent loads correctly', async () => {
      const goal = 'Load balancing test'
      const plan = await orchestrator.createOrchestrationPlan(goal)
      
      const initialStatus = orchestrator.getOrchestrationStatus(plan.id)
      expect(initialStatus.agentLoads).toBeDefined()
      
      // All agents should start with zero load
      for (const agentName in initialStatus.agentLoads) {
        expect(initialStatus.agentLoads[agentName].activeTasks).toBe(0)
      }
    })

    it('should get agent performance metrics', () => {
      const metrics = orchestrator.getAgentMetrics('architect')
      expect(metrics).toBeDefined()
      expect(metrics?.averageResponseTime).toBeGreaterThan(0)
      expect(metrics?.successRate).toBeGreaterThan(0)
      expect(metrics?.qualityScore).toBeGreaterThan(0)
    })

    it('should return null for non-existent agent metrics', () => {
      const metrics = orchestrator.getAgentMetrics('non-existent-agent')
      expect(metrics).toBeNull()
    })
  })

  describe('validation system', () => {
    it('should create validation plans for tasks requiring validation', async () => {
      const goal = 'Code generation with validation'
      const requirements: Partial<TaskMetrics> = {
        validation: {
          required: true,
          reviewers: ['code-reviewer'],
          criteria: ['security', 'quality', 'performance']
        }
      }
      
      const plan = await orchestrator.createOrchestrationPlan(goal, requirements)
      expect(plan.validationPlan).toBeDefined()
      expect(plan.validationPlan.length).toBeGreaterThan(0)
      
      const validationStep = plan.validationPlan[0]
      expect(validationStep.validatorRole).toBe('code-reviewer')
      expect(validationStep.criteria).toContain('security')
    })
  })

  describe('custom agent registration', () => {
    it('should allow registration of custom specialized agents', () => {
      const customAgent: SpecializedAgentRole = {
        name: 'custom-agent',
        description: 'Custom test agent',
        systemPrompt: 'You are a custom agent for testing',
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        specialization: ['testing'],
        capabilities: [{
          name: 'custom-capability',
          description: 'Test capability',
          category: 'analysis',
          complexity: 'low',
          estimatedDuration: 10,
          requirements: { memory: 128, cpu: 'low' }
        }],
        performanceMetrics: {
          averageResponseTime: 50,
          successRate: 0.9,
          qualityScore: 0.85
        },
        loadLimits: {
          maxConcurrentTasks: 5,
          maxQueueSize: 10
        }
      }
      
      orchestrator.registerSpecializedAgent(customAgent)
      
      const agents = orchestrator.getSpecializedAgents()
      expect(agents.some(agent => agent.name === 'custom-agent')).toBe(true)
      expect(mockWorkflow.addAgentRole).toHaveBeenCalledWith(customAgent)
    })
  })

  describe('error handling', () => {
    it('should handle non-existent orchestration plan', async () => {
      await expect(orchestrator.executeOrchestrationPlan('non-existent-plan'))
        .rejects.toThrow('Orchestration plan non-existent-plan not found')
    })

    it('should handle workflow execution errors gracefully', async () => {
      mockWorkflow.executeWorkflow.mockRejectedValueOnce(new Error('Workflow execution failed'))
      
      const goal = 'Error handling test'
      const plan = await orchestrator.createOrchestrationPlan(goal)
      
      await expect(orchestrator.executeOrchestrationPlan(plan.id))
        .rejects.toThrow()
    })

    it('should return null status for non-existent plan', () => {
      const status = orchestrator.getOrchestrationStatus('non-existent-plan')
      expect(status).toBeNull()
    })
  })

  describe('factory function', () => {
    it('should create orchestrator via factory function', () => {
      const factoryOrchestrator = createAgentOrchestrator()
      expect(factoryOrchestrator).toBeInstanceOf(AgentOrchestrator)
    })
  })
})

describe('Integration with existing MultiAgentWorkflow', () => {
  it('should work with the existing workflow interface', async () => {
    const orchestrator = createAgentOrchestrator()
    const agents = orchestrator.getSpecializedAgents()
    
    // Verify all required agent roles are present
    expect(agents.find(a => a.name === 'architect')).toBeDefined()
    expect(agents.find(a => a.name === 'frontend-developer')).toBeDefined()
    expect(agents.find(a => a.name === 'backend-developer')).toBeDefined()
    expect(agents.find(a => a.name === 'code-reviewer')).toBeDefined()
    expect(agents.find(a => a.name === 'devops-engineer')).toBeDefined()
  })
})