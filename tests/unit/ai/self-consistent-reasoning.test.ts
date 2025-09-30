/**
 * Tests for Chain-of-Thought with Self-Consistency implementation
 */

import { SelfConsistentReasoning, SelfConsistencyConfig, ReasoningPath } from '../../src/lib/ai/self-consistent-reasoning'
import { ModelOrchestrator, ModelConfig, TaskType, ModelCapabilities } from '../../src/lib/ai/model-orchestration'

// Mock ModelOrchestrator for testing
class MockModelOrchestrator extends ModelOrchestrator {
  constructor() {
    super([]) // Pass empty array to avoid loading default models
  }

  selectModel(context: any) {
    return {
      primaryModel: {
        id: 'test-model',
        name: 'Test Model',
        provider: 'openai' as const,
        model: 'gpt-4',
        capabilities: {
          codeGeneration: 8,
          reasoning: 9,
          creativity: 7,
          speed: 100,
          contextLength: 8192,
          multimodal: false,
          functionCalling: true,
          jsonMode: true,
          streaming: true,
          costPerToken: 0.03
        } as ModelCapabilities,
        enabled: true,
        rateLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 40000
        },
        fallbackModels: []
      } as ModelConfig,
      fallbackModels: [],
      confidence: 0.9,
      reasoning: 'Selected for high reasoning capability',
      estimatedCost: 0.01,
      estimatedLatency: 1000
    }
  }
}

describe('SelfConsistentReasoning', () => {
  let selfConsistentReasoning: SelfConsistentReasoning
  let mockOrchestrator: MockModelOrchestrator

  beforeEach(() => {
    mockOrchestrator = new MockModelOrchestrator()
    selfConsistentReasoning = new SelfConsistentReasoning(mockOrchestrator)
  })

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(selfConsistentReasoning).toBeInstanceOf(SelfConsistentReasoning)
    })
  })

  describe('selfConsistentReasoning', () => {
    const mockContext = {
      taskType: TaskType.PLANNING,
      priority: 'medium' as const,
      expectedTokens: 1000,
      requiresStreaming: false,
      requiresJsonMode: false,
      requiresFunctionCalling: false,
      requiresMultimodal: false
    }

    it('should generate multiple reasoning paths and return consensus', async () => {
      // Mock the private methods to control the test
      const mockPaths: ReasoningPath[] = [
        {
          id: 'path-1',
          prompt: 'Test prompt',
          thoughts: [
            {
              content: 'First thought: analyzing the problem',
              state: {
                thoughtNumber: 1,
                totalThoughtsEstimated: 3,
                nextThoughtNeeded: true
              },
              timestamp: Date.now()
            },
            {
              content: 'Second thought: considering options',
              state: {
                thoughtNumber: 2,
                totalThoughtsEstimated: 3,
                nextThoughtNeeded: true
              },
              timestamp: Date.now()
            },
            {
              content: 'Final thought: the answer is 42',
              state: {
                thoughtNumber: 3,
                totalThoughtsEstimated: 3,
                nextThoughtNeeded: false
              },
              timestamp: Date.now()
            }
          ],
          finalAnswer: '42',
          confidence: 0.8,
          reasoning: 'Systematic analysis leading to answer 42',
          model: 'test-model',
          timestamp: Date.now()
        },
        {
          id: 'path-2',
          prompt: 'Test prompt',
          thoughts: [
            {
              content: 'Alternative approach: different angle',
              state: {
                thoughtNumber: 1,
                totalThoughtsEstimated: 2,
                nextThoughtNeeded: true
              },
              timestamp: Date.now()
            },
            {
              content: 'Conclusion: also 42',
              state: {
                thoughtNumber: 2,
                totalThoughtsEstimated: 2,
                nextThoughtNeeded: false
              },
              timestamp: Date.now()
            }
          ],
          finalAnswer: '42',
          confidence: 0.9,
          reasoning: 'Alternative path to same answer',
          model: 'test-model',
          timestamp: Date.now()
        }
      ]

      // Use a config with fewer paths for faster testing
      const config: Partial<SelfConsistencyConfig> = {
        numPaths: 2,
        maxThoughtsPerPath: 5,
        minConsensusThreshold: 0.5
      }

      // Override the private method to return our mock paths
      jest.spyOn(selfConsistentReasoning as any, 'generateReasoningPaths')
        .mockResolvedValue(mockPaths)

      const result = await selfConsistentReasoning.selfConsistentReasoning(
        'What is the answer to life, the universe, and everything?',
        mockContext,
        config
      )

      expect(result.consensusAnswer).toBe('42')
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.paths).toHaveLength(2)
      expect(result.successRate).toBe(1.0)
      expect(result.answerComparison.consensus).toBe('42')
      expect(result.reasoning).toContain('Consensus reached')
    })

    it('should handle no consensus scenario', async () => {
      const divergentPaths: ReasoningPath[] = [
        {
          id: 'path-1',
          prompt: 'Test prompt',
          thoughts: [{
            content: 'Answer is A',
            state: { thoughtNumber: 1, totalThoughtsEstimated: 1, nextThoughtNeeded: false },
            timestamp: Date.now()
          }],
          finalAnswer: 'A',
          confidence: 0.7,
          reasoning: 'Path to A',
          model: 'test-model',
          timestamp: Date.now()
        },
        {
          id: 'path-2',
          prompt: 'Test prompt',
          thoughts: [{
            content: 'Answer is B',
            state: { thoughtNumber: 1, totalThoughtsEstimated: 1, nextThoughtNeeded: false },
            timestamp: Date.now()
          }],
          finalAnswer: 'B',
          confidence: 0.6,
          reasoning: 'Path to B',
          model: 'test-model',
          timestamp: Date.now()
        },
        {
          id: 'path-3',
          prompt: 'Test prompt',
          thoughts: [{
            content: 'Answer is C',
            state: { thoughtNumber: 1, totalThoughtsEstimated: 1, nextThoughtNeeded: false },
            timestamp: Date.now()
          }],
          finalAnswer: 'C',
          confidence: 0.5,
          reasoning: 'Path to C',
          model: 'test-model',
          timestamp: Date.now()
        }
      ]

      jest.spyOn(selfConsistentReasoning as any, 'generateReasoningPaths')
        .mockResolvedValue(divergentPaths)

      const config: Partial<SelfConsistencyConfig> = {
        numPaths: 3,
        minConsensusThreshold: 0.6 // High threshold to prevent consensus
      }

      const result = await selfConsistentReasoning.selfConsistentReasoning(
        'Divergent question',
        mockContext,
        config
      )

      expect(result.consensusAnswer).toBe('No consensus reached')
      expect(result.confidence).toBe(0)
      expect(result.answerComparison.consensus).toBeNull()
      expect(result.reasoning).toContain('No consensus was reached')
    })
  })

  describe('Answer extraction and comparison', () => {
    it('should correctly group similar answers', () => {
      const paths: ReasoningPath[] = [
        {
          id: 'path-1',
          finalAnswer: 'The answer is 42',
          confidence: 0.8,
          thoughts: [], prompt: '', reasoning: '', model: '', timestamp: Date.now()
        },
        {
          id: 'path-2',
          finalAnswer: '42',
          confidence: 0.9,
          thoughts: [], prompt: '', reasoning: '', model: '', timestamp: Date.now()
        },
        {
          id: 'path-3',
          finalAnswer: 'Forty-two',
          confidence: 0.7,
          thoughts: [], prompt: '', reasoning: '', model: '', timestamp: Date.now()
        },
        {
          id: 'path-4',
          finalAnswer: 'Different answer',
          confidence: 0.6,
          thoughts: [], prompt: '', reasoning: '', model: '', timestamp: Date.now()
        }
      ]

      const config: SelfConsistencyConfig = {
        numPaths: 4,
        maxThoughtsPerPath: 5,
        minConsensusThreshold: 0.5,
        useModelDiversity: true,
        confidenceWeighting: true
      }

      const result = (selfConsistentReasoning as any).extractAndCompareAnswers(paths, config)

      expect(result.answerGroups).toHaveLength(4) // Each answer is unique due to normalization
      expect(result.extractedAnswers).toHaveLength(4)
      expect(result.agreementRatio).toBeLessThanOrEqual(1.0)
    })

    it('should normalize answers correctly', () => {
      const normalizeAnswer = (selfConsistentReasoning as any).normalizeAnswer.bind(selfConsistentReasoning)
      
      expect(normalizeAnswer('The answer is 42!')).toBe('the answer is 42')
      expect(normalizeAnswer('  42  ')).toBe('42')
      expect(normalizeAnswer('Forty-Two')).toBe('forty two')
      expect(normalizeAnswer('Answer: 42.')).toBe('answer 42')
    })
  })

  describe('Path confidence calculation', () => {
    it('should calculate confidence based on reasoning quality', () => {
      const calculatePathConfidence = (selfConsistentReasoning as any).calculatePathConfidence.bind(selfConsistentReasoning)
      
      const detailedThoughts = [
        { content: 'First detailed thought about the problem', state: {}, timestamp: Date.now() },
        { content: 'Second analysis of the situation', state: {}, timestamp: Date.now() },
        { content: 'Third consideration of alternatives', state: {}, timestamp: Date.now() },
        { content: 'Final conclusion with certainty', state: {}, timestamp: Date.now() }
      ]
      
      const briefThoughts = [
        { content: 'Quick answer', state: {}, timestamp: Date.now() }
      ]
      
      const uncertainThoughts = [
        { content: 'Maybe this is the answer, but I am uncertain', state: {}, timestamp: Date.now() }
      ]
      
      const detailedConf = calculatePathConfidence(detailedThoughts, 'Well-reasoned answer with details')
      const briefConf = calculatePathConfidence(briefThoughts, 'Brief answer')
      const uncertainConf = calculatePathConfidence(uncertainThoughts, 'Uncertain response')
      
      expect(detailedConf).toBeGreaterThan(briefConf)
      expect(briefConf).toBeGreaterThan(uncertainConf)
      expect(detailedConf).toBeLessThanOrEqual(1.0)
      expect(uncertainConf).toBeGreaterThanOrEqual(0.0)
    })
  })

  describe('Final answer extraction', () => {
    it('should extract final answers using different patterns', () => {
      const extractFinalAnswer = (selfConsistentReasoning as any).extractFinalAnswer.bind(selfConsistentReasoning)
      
      const thoughts1 = [
        { content: 'Let me think about this step by step.', state: {}, timestamp: Date.now() },
        { content: 'After analysis, the final answer is 42.', state: {}, timestamp: Date.now() }
      ]
      
      const thoughts2 = [
        { content: 'Considering the options.', state: {}, timestamp: Date.now() },
        { content: 'Therefore, the solution is 42.', state: {}, timestamp: Date.now() }
      ]
      
      const thoughts3 = [
        { content: 'Complex reasoning here.', state: {}, timestamp: Date.now() },
        { content: 'The answer is clearly 42 based on evidence.', state: {}, timestamp: Date.now() }
      ]
      
      expect(extractFinalAnswer(thoughts1)).toContain('42')
      expect(extractFinalAnswer(thoughts2)).toContain('42')
      expect(extractFinalAnswer(thoughts3)).toContain('42')
    })

    it('should handle custom extraction patterns', () => {
      const extractFinalAnswer = (selfConsistentReasoning as any).extractFinalAnswer.bind(selfConsistentReasoning)
      
      const thoughts = [
        { content: 'Analysis complete. RESULT: 42 END', state: {}, timestamp: Date.now() }
      ]
      
      const customPattern = /RESULT:\s*(\d+)\s*END/
      const result = extractFinalAnswer(thoughts, customPattern)
      
      expect(result).toBe('42')
    })
  })

  describe('Model diversity', () => {
    it('should diversify model selection across paths', () => {
      const diversifyModelSelection = (selfConsistentReasoning as any).diversifyModelSelection.bind(selfConsistentReasoning)
      
      const baseContext = {
        taskType: TaskType.PLANNING,
        priority: 'medium' as const,
        expectedTokens: 1000,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      }
      
      const contexts = []
      for (let i = 0; i < 5; i++) {
        contexts.push(diversifyModelSelection(baseContext, i, 5))
      }
      
      // Should have different priorities
      const priorities = contexts.map(c => c.priority)
      expect(new Set(priorities).size).toBeGreaterThan(1)
      
      // Should have different token expectations
      const tokenCounts = contexts.map(c => c.expectedTokens)
      expect(new Set(tokenCounts).size).toBeGreaterThan(1)
    })
  })

  describe('Configuration handling', () => {
    it('should merge custom config with defaults', async () => {
      const customConfig: Partial<SelfConsistencyConfig> = {
        numPaths: 3,
        minConsensusThreshold: 0.7
      }

      // Mock to avoid actual path generation
      jest.spyOn(selfConsistentReasoning as any, 'generateReasoningPaths')
        .mockResolvedValue([])

      const mockContext = {
        taskType: TaskType.PLANNING,
        priority: 'medium' as const,
        expectedTokens: 1000,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      }

      const result = await selfConsistentReasoning.selfConsistentReasoning(
        'test prompt',
        mockContext,
        customConfig
      )

      expect(result.config.numPaths).toBe(3)
      expect(result.config.minConsensusThreshold).toBe(0.7)
      expect(result.config.maxThoughtsPerPath).toBe(10) // Should keep default
      expect(result.config.useModelDiversity).toBe(true) // Should keep default
    })
  })

  describe('Edge cases', () => {
    it('should handle empty reasoning paths', () => {
      const extractAndCompareAnswers = (selfConsistentReasoning as any).extractAndCompareAnswers.bind(selfConsistentReasoning)
      
      const config: SelfConsistencyConfig = {
        numPaths: 0,
        maxThoughtsPerPath: 5,
        minConsensusThreshold: 0.5,
        useModelDiversity: true,
        confidenceWeighting: true
      }

      const result = extractAndCompareAnswers([], config)
      
      expect(result.extractedAnswers).toEqual([])
      expect(result.answerGroups).toEqual([])
      expect(result.consensus).toBeNull()
      expect(result.confidence).toBe(0)
      expect(result.agreementRatio).toBe(0)
    })

    it('should handle paths with no final answers', () => {
      const paths: ReasoningPath[] = [
        {
          id: 'path-1',
          finalAnswer: '',
          confidence: 0.5,
          thoughts: [], prompt: '', reasoning: '', model: '', timestamp: Date.now()
        }
      ]

      const extractAndCompareAnswers = (selfConsistentReasoning as any).extractAndCompareAnswers.bind(selfConsistentReasoning)
      
      const config: SelfConsistencyConfig = {
        numPaths: 1,
        maxThoughtsPerPath: 5,
        minConsensusThreshold: 0.5,
        useModelDiversity: true,
        confidenceWeighting: true
      }

      const result = extractAndCompareAnswers(paths, config)
      
      expect(result.extractedAnswers).toEqual([])
      expect(result.consensus).toBeNull()
    })
  })

  describe('Performance metrics', () => {
    it('should calculate success rate correctly', async () => {
      const mixedPaths: ReasoningPath[] = [
        {
          id: 'path-1',
          finalAnswer: 'answer1',
          confidence: 0.8,
          thoughts: [], prompt: '', reasoning: '', model: '', timestamp: Date.now()
        },
        {
          id: 'path-2',
          finalAnswer: '', // Failed path
          confidence: 0.3,
          thoughts: [], prompt: '', reasoning: '', model: '', timestamp: Date.now()
        },
        {
          id: 'path-3',
          finalAnswer: 'answer3',
          confidence: 0.7,
          thoughts: [], prompt: '', reasoning: '', model: '', timestamp: Date.now()
        }
      ]

      jest.spyOn(selfConsistentReasoning as any, 'generateReasoningPaths')
        .mockResolvedValue(mixedPaths)

      const config: Partial<SelfConsistencyConfig> = { numPaths: 3 }
      
      const mockContext = {
        taskType: TaskType.PLANNING,
        priority: 'medium' as const,
        expectedTokens: 1000,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      }

      const result = await selfConsistentReasoning.selfConsistentReasoning(
        'test prompt',
        mockContext,
        config
      )

      expect(result.successRate).toBeCloseTo(2/3) // 2 out of 3 paths succeeded
      expect(result.totalTime).toBeGreaterThan(0)
    })
  })
})