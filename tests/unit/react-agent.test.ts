// ReAct Agent Tests - Comprehensive testing for the ReAct pattern implementation

import { ReActAgent } from '../../../src/lib/agent-framework/react-agent'
import { ReasoningEngine } from '../../../src/lib/agent-framework/reasoning-engine'
import { ObservationTracker } from '../../../src/lib/agent-framework/observation-tracker'
import { UnifiedAIClient } from '../../../src/lib/unified-ai-client'

// Mock UnifiedAIClient for testing
class MockAIClient extends UnifiedAIClient {
  private mockResponses: Record<string, string> = {}

  constructor() {
    super({})
  }

  setMockResponse(promptKeyword: string, response: string) {
    this.mockResponses[promptKeyword] = response
  }

  async chat(messages: any[], model: string = 'gpt-4'): Promise<any> {
    const lastMessage = messages[messages.length - 1]?.content || ''
    
    // Find matching mock response
    for (const [keyword, response] of Object.entries(this.mockResponses)) {
      if (lastMessage.toLowerCase().includes(keyword.toLowerCase())) {
        return {
          content: response,
          model,
          provider: 'mock',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
        }
      }
    }

    // Default response
    return {
      content: 'Mock AI response',
      model,
      provider: 'mock',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
    }
  }
}

describe('ReAct Agent', () => {
  let mockClient: MockAIClient
  let reActAgent: ReActAgent
  let mockContext: any

  beforeEach(() => {
    mockClient = new MockAIClient()
    reActAgent = new ReActAgent(
      'test-agent',
      'Test ReAct Agent',
      'A test agent for ReAct pattern validation',
      mockClient,
      'gpt-4',
      5 // max steps for testing
    )

    mockContext = {
      workspaceId: '123',
      userId: 'test-user',
      sessionId: 'test-session',
      aiClient: mockClient,
      previousResults: new Map(),
      maxSteps: 5,
      currentStep: 0
    }
  })

  describe('Basic ReAct Cycle', () => {
    test('should complete Think-Act-Observe cycle', async () => {
      // Setup mock responses for each phase
      mockClient.setMockResponse('thinking', 'I need to analyze the problem and plan next steps')
      mockClient.setMockResponse('extract', JSON.stringify({
        description: 'Analyze the test scenario',
        result: 'Analysis completed'
      }))
      mockClient.setMockResponse('analyzing', JSON.stringify({
        success: true,
        confidence: 0.9,
        needsCorrection: false,
        analysis: 'Action was successful'
      }))
      mockClient.setMockResponse('complete', 'COMPLETE')

      const task = {
        id: 'test-task',
        description: 'Test the ReAct pattern implementation',
        priority: 'medium' as const,
        capabilities: [],
        status: 'pending' as const
      }

      const result = await reActAgent.executeReActTask(task, mockContext)
      
      expect(result).toBeDefined()
      expect(result.goal).toBe(task.description)
      expect(result.steps).toBeGreaterThan(0)
    })

    test('should track state throughout execution', async () => {
      mockClient.setMockResponse('thinking', 'Initial thought process')
      mockClient.setMockResponse('complete', 'CONTINUE - need more work')

      const task = {
        id: 'state-test',
        description: 'Test state tracking',
        priority: 'high' as const,
        capabilities: [],
        status: 'pending' as const
      }

      // Execute for just one step to check state
      await reActAgent.executeReActTask(task, mockContext)
      
      const state = reActAgent.getState()
      expect(state.goal).toBe(task.description)
      expect(state.steps.length).toBeGreaterThan(0)
      expect(state.currentStepIndex).toBeGreaterThan(0)
    })

    test('should handle completion detection', async () => {
      mockClient.setMockResponse('complete', 'COMPLETE')
      
      const task = {
        id: 'completion-test',
        description: 'Test completion detection',
        priority: 'low' as const,
        capabilities: [],
        status: 'pending' as const
      }

      const result = await reActAgent.executeReActTask(task, mockContext)
      expect(result.goal).toBe(task.description)
    })
  })

  describe('Self-Correction', () => {
    test('should apply corrections when needed', async () => {
      mockClient.setMockResponse('thinking', 'Planning corrective action')
      mockClient.setMockResponse('analyzing', JSON.stringify({
        success: false,
        confidence: 0.3,
        needsCorrection: true,
        analysis: 'Action failed',
        suggestedAction: 'Try alternative approach'
      }))
      mockClient.setMockResponse('complete', 'CONTINUE')

      const task = {
        id: 'correction-test',
        description: 'Test self-correction capabilities',
        priority: 'high' as const,
        capabilities: [],
        status: 'pending' as const
      }

      await reActAgent.executeReActTask(task, mockContext)
      
      const state = reActAgent.getState()
      expect(state.corrections.length).toBeGreaterThan(0)
    })
  })

  describe('Capability Integration', () => {
    test('should execute capabilities when available', async () => {
      // Add a test capability
      reActAgent.addCapability({
        name: 'test-capability',
        description: 'A test capability',
        parameters: { input: 'string' },
        execute: async (input, context) => {
          return { result: 'capability executed', input }
        }
      })

      mockClient.setMockResponse('thinking', 'I will use the test capability')
      mockClient.setMockResponse('extract', JSON.stringify({
        description: 'Execute test capability',
        capability: 'test-capability',
        parameters: { input: 'test data' }
      }))
      mockClient.setMockResponse('analyzing', JSON.stringify({
        success: true,
        confidence: 0.95,
        needsCorrection: false,
        analysis: 'Capability executed successfully'
      }))
      mockClient.setMockResponse('complete', 'COMPLETE')

      const task = {
        id: 'capability-test',
        description: 'Test capability execution',
        priority: 'medium' as const,
        capabilities: ['test-capability'],
        status: 'pending' as const
      }

      const result = await reActAgent.executeReActTask(task, mockContext)
      expect(result).toBeDefined()
    })
  })
})

describe('Reasoning Engine', () => {
  let mockClient: MockAIClient
  let reasoningEngine: ReasoningEngine

  beforeEach(() => {
    mockClient = new MockAIClient()
    reasoningEngine = new ReasoningEngine(mockClient, 'gpt-4')
  })

  describe('Initial Reasoning', () => {
    test('should generate initial reasoning and hypotheses', async () => {
      const mockResponse = JSON.stringify({
        reasoning: 'This problem requires a systematic approach',
        hypotheses: [
          {
            description: 'Direct approach will work',
            confidence: 0.8,
            rationale: 'Standard problem-solving method'
          }
        ],
        recommendedApproach: 'Start with direct analysis'
      })

      mockClient.setMockResponse('analyze', mockResponse)

      const context = {
        goal: 'Test goal',
        constraints: ['time limit'],
        availableActions: ['analyze', 'execute'],
        previousAttempts: [],
        domainKnowledge: {}
      }

      const result = await reasoningEngine.generateInitialReasoning(context)
      
      expect(result.reasoning).toBeTruthy()
      expect(result.hypotheses.length).toBeGreaterThan(0)
      expect(result.recommendedApproach).toBeTruthy()
    })
  })

  describe('Hypothesis Testing', () => {
    test('should test hypotheses with evidence', async () => {
      // First generate a hypothesis
      const mockInitialResponse = JSON.stringify({
        reasoning: 'Initial analysis',
        hypotheses: [{ description: 'Test hypothesis', confidence: 0.7, rationale: 'Test reason' }],
        recommendedApproach: 'Test approach'
      })

      mockClient.setMockResponse('analyze', mockInitialResponse)

      const context = {
        goal: 'Test hypothesis validation',
        constraints: [],
        availableActions: ['test'],
        previousAttempts: [],
        domainKnowledge: {}
      }

      const initialResult = await reasoningEngine.generateInitialReasoning(context)
      const hypothesisId = initialResult.hypotheses[0].id

      // Now test the hypothesis
      const mockTestResponse = JSON.stringify({
        outcome: 'confirmed',
        reasoning: 'Evidence supports the hypothesis',
        newConfidence: 0.9
      })

      mockClient.setMockResponse('test', mockTestResponse)

      const testResult = await reasoningEngine.testHypothesis(hypothesisId, 'Supporting evidence')
      
      expect(testResult.outcome).toBe('confirmed')
      expect(testResult.confidence).toBe(0.9)
    })
  })

  describe('Alternative Generation', () => {
    test('should generate alternatives when approach fails', async () => {
      const mockResponse = JSON.stringify({
        reasoning: 'Current approach failed because...',
        alternatives: [
          'Try different methodology',
          'Use alternative tools',
          'Change sequence of actions'
        ],
        recommendedAlternative: 'Try different methodology'
      })

      mockClient.setMockResponse('generate', mockResponse)

      const context = {
        goal: 'Test alternative generation',
        constraints: [],
        availableActions: ['alternative1', 'alternative2'],
        previousAttempts: ['failed attempt'],
        domainKnowledge: {}
      }

      const result = await reasoningEngine.generateAlternativeApproaches(
        'Current failing approach',
        'Method not suitable',
        context
      )

      expect(result.alternatives.length).toBeGreaterThan(0)
      expect(result.recommendedAlternative).toBeTruthy()
    })
  })
})

describe('Observation Tracker', () => {
  let mockClient: MockAIClient
  let observationTracker: ObservationTracker

  beforeEach(() => {
    mockClient = new MockAIClient()
    observationTracker = new ObservationTracker(mockClient, 'gpt-4')
  })

  describe('Observation Management', () => {
    test('should add and track observations', () => {
      const obsId = observationTracker.addObservation(
        'action_result',
        { result: 'test result' },
        'test-source',
        0.9
      )

      expect(obsId).toBeTruthy()

      const observations = observationTracker.getObservations()
      expect(observations.length).toBe(1)
      expect(observations[0].type).toBe('action_result')
      expect(observations[0].source).toBe('test-source')
    })

    test('should maintain observation size limits', () => {
      const tracker = new ObservationTracker(mockClient, 'gpt-4', 3) // limit to 3

      // Add 5 observations
      for (let i = 0; i < 5; i++) {
        tracker.addObservation('system_event', `event ${i}`, 'test', 1.0)
      }

      const observations = tracker.getObservations()
      expect(observations.length).toBe(3) // Should be limited to 3
    })
  })

  describe('State Snapshots', () => {
    test('should create and store state snapshots', () => {
      const snapshotId = observationTracker.createStateSnapshot(
        'Test goal',
        1,
        ['hypothesis1', 'hypothesis2'],
        0.8,
        ['next action']
      )

      expect(snapshotId).toBeTruthy()

      const history = observationTracker.getStateHistory()
      expect(history.length).toBe(1)
      expect(history[0].goal).toBe('Test goal')
    })
  })

  describe('Pattern Learning', () => {
    test('should record and retrieve learning patterns', async () => {
      await observationTracker.recordLearningPattern(
        'Test pattern',
        ['example1', 'example2'],
        0.85,
        ['condition1']
      )

      const patterns = observationTracker.getLearningPatterns()
      expect(patterns.length).toBe(1)
      expect(patterns[0].pattern).toBe('Test pattern')
      expect(patterns[0].successRate).toBe(0.85)
    })

    test('should update existing patterns', async () => {
      // Record pattern twice
      await observationTracker.recordLearningPattern('Same pattern', ['example1'], 0.7)
      await observationTracker.recordLearningPattern('Same pattern', ['example2'], 0.9)

      const patterns = observationTracker.getLearningPatterns()
      expect(patterns.length).toBe(1) // Should merge, not duplicate
      expect(patterns[0].examples.length).toBe(2)
    })
  })

  describe('Analysis Functions', () => {
    test('should analyze observations for insights', async () => {
      // Add some test observations
      observationTracker.addObservation('action_result', { success: true }, 'test1', 0.9)
      observationTracker.addObservation('action_result', { success: false }, 'test2', 0.3)

      const mockResponse = JSON.stringify({
        insights: ['Pattern of mixed results'],
        patterns: ['Success rate 50%'],
        recommendations: ['Review failed actions'],
        confidence: 0.7
      })

      mockClient.setMockResponse('analyze', mockResponse)

      const analysis = await observationTracker.analyzeObservations()
      
      expect(analysis.insights.length).toBeGreaterThan(0)
      expect(analysis.confidence).toBe(0.7)
    })

    test('should detect anomalies in observations', async () => {
      // Add observations to detect anomalies
      for (let i = 0; i < 6; i++) {
        observationTracker.addObservation('system_event', { value: i < 5 ? 'normal' : 'anomaly' }, 'test', 1.0)
      }

      const mockResponse = JSON.stringify({
        anomalies: ['Unusual pattern detected'],
        severity: 'medium',
        recommendations: ['Investigate anomaly']
      })

      mockClient.setMockResponse('analyze', mockResponse)

      const result = await observationTracker.detectAnomalies()
      
      expect(result.anomalies.length).toBeGreaterThanOrEqual(0)
      expect(['low', 'medium', 'high']).toContain(result.severity)
    })
  })

  describe('State Transitions', () => {
    test('should record and track state transitions', () => {
      observationTracker.recordTransition(
        'state1',
        'state2', 
        'action1',
        'positive result',
        true
      )

      const transitions = observationTracker.getTransitions()
      expect(transitions.length).toBe(1)
      expect(transitions[0].from).toBe('state1')
      expect(transitions[0].to).toBe('state2')
      expect(transitions[0].success).toBe(true)
    })
  })
})

describe('Integration Tests', () => {
  let mockClient: MockAIClient
  let reActAgent: ReActAgent
  let reasoningEngine: ReasoningEngine
  let observationTracker: ObservationTracker

  beforeEach(() => {
    mockClient = new MockAIClient()
    reActAgent = new ReActAgent('integration-test', 'Integration Test Agent', 'Test agent', mockClient)
    reasoningEngine = new ReasoningEngine(mockClient)
    observationTracker = new ObservationTracker(mockClient)
  })

  test('should integrate ReAct components effectively', async () => {
    // Setup comprehensive mock responses
    mockClient.setMockResponse('thinking', 'Comprehensive analysis needed')
    mockClient.setMockResponse('extract', JSON.stringify({
      description: 'Execute comprehensive test',
      result: 'Integration test completed'
    }))
    mockClient.setMockResponse('analyzing', JSON.stringify({
      success: true,
      confidence: 0.95,
      needsCorrection: false,
      analysis: 'All components working together'
    }))
    mockClient.setMockResponse('complete', 'COMPLETE')

    const task = {
      id: 'integration-test',
      description: 'Test full ReAct pattern integration',
      priority: 'high' as const,
      capabilities: [],
      status: 'pending' as const
    }

    const context = {
      workspaceId: '123',
      userId: 'test-user',
      sessionId: 'integration-session',
      aiClient: mockClient,
      previousResults: new Map(),
      maxSteps: 10,
      currentStep: 0
    }

    const result = await reActAgent.executeReActTask(task, context)
    
    expect(result).toBeDefined()
    expect(result.goal).toBe(task.description)
    
    // Verify state tracking
    const state = reActAgent.getState()
    expect(state.steps.length).toBeGreaterThan(0)
    
    // Verify step history contains all types
    const stepHistory = reActAgent.getStepHistory()
    const stepTypes = stepHistory.map(step => step.type)
    expect(stepTypes).toContain('thought')
    expect(stepTypes).toContain('action')
    expect(stepTypes).toContain('observation')
  })
})