/**
 * Chain-of-Thought with Self-Consistency Implementation
 * Generates multiple reasoning paths and selects consensus answer for higher reliability
 */

import { ModelOrchestrator, ModelSelection, RequestContext, TaskType } from './model-orchestration'
import { SequentialThinkingProcess } from '../mcp/sequential/thinking-process'
import { Thought } from '../mcp/sequential/interfaces'

/**
 * Reasoning path represents a single chain of thought
 */
export interface ReasoningPath {
  id: string
  prompt: string
  thoughts: Thought[]
  finalAnswer: string
  confidence: number
  reasoning: string
  model: string
  timestamp: number
}

/**
 * Configuration for self-consistent reasoning
 */
export interface SelfConsistencyConfig {
  numPaths: number // Number of parallel reasoning paths (default: 5)
  maxThoughtsPerPath: number // Maximum thoughts per reasoning path (default: 10)
  minConsensusThreshold: number // Minimum agreement threshold for consensus (default: 0.6)
  useModelDiversity: boolean // Use different models for different paths (default: true)
  extractAnswerPattern?: RegExp // Pattern to extract final answers (optional)
  confidenceWeighting: boolean // Weight answers by confidence scores (default: true)
}

/**
 * Result of answer extraction and comparison
 */
export interface AnswerComparison {
  extractedAnswers: string[]
  answerGroups: AnswerGroup[]
  consensus: string | null
  confidence: number
  agreementRatio: number
}

/**
 * Group of similar answers
 */
export interface AnswerGroup {
  answer: string
  paths: string[] // IDs of reasoning paths with this answer
  frequency: number
  avgConfidence: number
  normalizedAnswer: string // Cleaned/normalized version
}

/**
 * Final result of self-consistent reasoning
 */
export interface SelfConsistentResult {
  consensusAnswer: string
  confidence: number
  reasoning: string
  paths: ReasoningPath[]
  answerComparison: AnswerComparison
  config: SelfConsistencyConfig
  totalTime: number
  successRate: number // Percentage of successful paths
}

/**
 * Self-Consistent Reasoning Engine
 */
export class SelfConsistentReasoning {
  private modelOrchestrator: ModelOrchestrator
  private defaultConfig: SelfConsistencyConfig

  constructor(modelOrchestrator: ModelOrchestrator) {
    this.modelOrchestrator = modelOrchestrator
    this.defaultConfig = {
      numPaths: 5,
      maxThoughtsPerPath: 10,
      minConsensusThreshold: 0.6,
      useModelDiversity: true,
      confidenceWeighting: true
    }
  }

  /**
   * Main function to perform self-consistent reasoning
   * @param prompt The reasoning prompt/question
   * @param context Request context for model selection
   * @param config Optional configuration overrides
   * @returns Self-consistent reasoning result
   */
  async selfConsistentReasoning(
    prompt: string,
    context: RequestContext,
    config: Partial<SelfConsistencyConfig> = {}
  ): Promise<SelfConsistentResult> {
    const startTime = Date.now()
    const finalConfig = { ...this.defaultConfig, ...config }
    
    // Generate N parallel reasoning paths
    const paths = await this.generateReasoningPaths(prompt, context, finalConfig)
    
    // Extract and compare answers
    const answerComparison = this.extractAndCompareAnswers(paths, finalConfig)
    
    // Calculate final confidence score
    const confidence = this.calculateFinalConfidence(answerComparison, paths, finalConfig)
    
    // Generate consensus reasoning
    const reasoning = this.generateConsensusReasoning(answerComparison, paths)
    
    const totalTime = Date.now() - startTime
    const successRate = paths.filter(p => p.finalAnswer).length / finalConfig.numPaths

    return {
      consensusAnswer: answerComparison.consensus || "No consensus reached",
      confidence,
      reasoning,
      paths,
      answerComparison,
      config: finalConfig,
      totalTime,
      successRate
    }
  }

  /**
   * Generate multiple parallel reasoning paths
   */
  private async generateReasoningPaths(
    prompt: string,
    context: RequestContext,
    config: SelfConsistencyConfig
  ): Promise<ReasoningPath[]> {
    const paths: Promise<ReasoningPath>[] = []
    
    for (let i = 0; i < config.numPaths; i++) {
      // Select model for this path
      const modelContext = config.useModelDiversity 
        ? this.diversifyModelSelection(context, i, config.numPaths)
        : context
      
      paths.push(this.generateSingleReasoningPath(prompt, modelContext, config, i))
    }
    
    // Execute all paths in parallel and filter out failed ones
    const results = await Promise.allSettled(paths)
    return results
      .filter((result): result is PromiseFulfilledResult<ReasoningPath> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value)
  }

  /**
   * Generate a single reasoning path using sequential thinking
   */
  private async generateSingleReasoningPath(
    prompt: string,
    context: RequestContext,
    config: SelfConsistencyConfig,
    pathIndex: number
  ): Promise<ReasoningPath> {
    const pathId = `path-${pathIndex}-${Date.now()}`
    
    // Select the best model for this reasoning task
    const modelSelection = this.modelOrchestrator.selectModel({
      ...context,
      taskType: TaskType.PLANNING // Use planning task type for reasoning
    })
    
    // Create a new sequential thinking process for this path
    const thinkingProcess = new SequentialThinkingProcess()
    
    // Generate chain of thoughts
    const thoughts: Thought[] = []
    let currentThought = 1
    let continueThinking = true
    
    const enhancedPrompt = this.createReasoningPrompt(prompt, pathIndex)
    
    while (continueThinking && currentThought <= config.maxThoughtsPerPath) {
      const thoughtContent = await this.generateThought(
        enhancedPrompt,
        thoughts,
        currentThought,
        config.maxThoughtsPerPath,
        modelSelection
      )
      
      const thought = thinkingProcess.addThought(
        thoughtContent,
        currentThought,
        config.maxThoughtsPerPath,
        currentThought < config.maxThoughtsPerPath
      )
      
      thoughts.push(thought)
      
      // Determine if we need more thoughts or have reached a conclusion
      continueThinking = this.shouldContinueThinking(thoughtContent, currentThought, config.maxThoughtsPerPath)
      currentThought++
    }
    
    // Extract final answer from the reasoning chain
    const finalAnswer = this.extractFinalAnswer(thoughts, config.extractAnswerPattern)
    
    // Calculate confidence for this path
    const confidence = this.calculatePathConfidence(thoughts, finalAnswer)
    
    return {
      id: pathId,
      prompt: enhancedPrompt,
      thoughts,
      finalAnswer,
      confidence,
      reasoning: this.summarizeReasoning(thoughts),
      model: modelSelection.primaryModel.name,
      timestamp: Date.now()
    }
  }

  /**
   * Create a reasoning prompt with some variation for diversity
   */
  private createReasoningPrompt(basePrompt: string, pathIndex: number): string {
    const variations = [
      "Think step by step and provide your reasoning:",
      "Let's work through this systematically:",
      "Analyze this problem carefully:",
      "Consider different approaches and explain your thinking:",
      "Break down the problem and reason through it:"
    ]
    
    const variation = variations[pathIndex % variations.length]
    return `${variation}\n\n${basePrompt}\n\nProvide your final answer clearly at the end.`
  }

  /**
   * Generate a single thought using the selected model
   */
  private async generateThought(
    prompt: string,
    previousThoughts: Thought[],
    thoughtNumber: number,
    totalThoughts: number,
    modelSelection: ModelSelection
  ): Promise<string> {
    // This is a simplified implementation - in practice, you'd call the actual AI model
    // For now, we'll simulate reasoning thoughts
    const context = previousThoughts.map(t => t.content).join('\n')
    const thoughtPrompt = `${prompt}\n\nPrevious thoughts:\n${context}\n\nThought ${thoughtNumber}:`
    
    // Simulate AI model call - replace with actual model invocation
    return this.simulateAIResponse(thoughtPrompt, thoughtNumber)
  }

  /**
   * Simulate AI response for demonstration (replace with actual AI calls)
   */
  private simulateAIResponse(prompt: string, thoughtNumber: number): Promise<string> {
    // This is a placeholder - replace with actual AI model calls
    const responses = [
      "Let me analyze the key components of this problem...",
      "I need to consider multiple factors here...",
      "Based on the information provided, I can see that...",
      "The logical approach would be to...",
      "Considering the constraints and requirements..."
    ]
    
    return Promise.resolve(responses[thoughtNumber % responses.length])
  }

  /**
   * Determine if we should continue thinking
   */
  private shouldContinueThinking(
    thoughtContent: string,
    currentThought: number,
    maxThoughts: number
  ): boolean {
    if (currentThought >= maxThoughts) return false
    
    // Check if the thought indicates a conclusion
    const conclusionIndicators = [
      'therefore', 'in conclusion', 'final answer', 'the answer is',
      'my conclusion', 'to summarize', 'the result is'
    ]
    
    const hasConclusion = conclusionIndicators.some(indicator =>
      thoughtContent.toLowerCase().includes(indicator)
    )
    
    return !hasConclusion
  }

  /**
   * Extract final answer from reasoning chain
   */
  private extractFinalAnswer(thoughts: Thought[], pattern?: RegExp): string {
    const lastThought = thoughts[thoughts.length - 1]
    if (!lastThought) return ""
    
    const fullText = thoughts.map(t => t.content).join(' ')
    
    if (pattern) {
      const match = fullText.match(pattern)
      return match ? match[1] || match[0] : ""
    }
    
    // Default extraction logic
    const answerIndicators = [
      /(?:final answer|answer|conclusion|result):\s*(.+?)(?:\.|$)/i,
      /(?:therefore|thus|so),?\s*(.+?)(?:\.|$)/i,
      /the answer is\s*(.+?)(?:\.|$)/i
    ]
    
    for (const indicator of answerIndicators) {
      const match = fullText.match(indicator)
      if (match) return match[1].trim()
    }
    
    // Fallback to last sentence of last thought
    const sentences = lastThought.content.split('.')
    return sentences[sentences.length - 2]?.trim() || lastThought.content.substring(0, 100)
  }

  /**
   * Calculate confidence score for a single path
   */
  private calculatePathConfidence(thoughts: Thought[], finalAnswer: string): number {
    let confidence = 0.5 // Base confidence
    
    // Higher confidence for more detailed reasoning
    if (thoughts.length >= 3) confidence += 0.2
    
    // Higher confidence for clear final answer
    if (finalAnswer && finalAnswer.length > 10) confidence += 0.2
    
    // Check for uncertainty indicators
    const fullText = thoughts.map(t => t.content).join(' ')
    const uncertaintyIndicators = ['maybe', 'might', 'possibly', 'unclear', 'uncertain']
    const hasUncertainty = uncertaintyIndicators.some(indicator =>
      fullText.toLowerCase().includes(indicator)
    )
    
    if (hasUncertainty) confidence -= 0.1
    
    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Summarize reasoning from thoughts
   */
  private summarizeReasoning(thoughts: Thought[]): string {
    if (thoughts.length === 0) return "No reasoning available"
    
    const summary = thoughts
      .map((t, i) => `Step ${i + 1}: ${t.content}`)
      .join('\n')
    
    return summary.length > 500 
      ? summary.substring(0, 500) + '...'
      : summary
  }

  /**
   * Diversify model selection for different paths
   */
  private diversifyModelSelection(
    baseContext: RequestContext,
    pathIndex: number,
    totalPaths: number
  ): RequestContext {
    // Vary priority and constraints to encourage model diversity
    const priorities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']
    const priority = priorities[pathIndex % priorities.length]
    
    return {
      ...baseContext,
      priority,
      expectedTokens: baseContext.expectedTokens + (pathIndex * 100) // Slight variation
    }
  }

  /**
   * Extract and compare answers from all reasoning paths
   */
  private extractAndCompareAnswers(
    paths: ReasoningPath[],
    config: SelfConsistencyConfig
  ): AnswerComparison {
    const extractedAnswers = paths.map(p => p.finalAnswer).filter(Boolean)
    
    // Group similar answers
    const answerGroups = this.groupSimilarAnswers(paths)
    
    // Find consensus
    const consensus = this.findConsensus(answerGroups, config.minConsensusThreshold)
    
    // Calculate agreement ratio
    const agreementRatio = consensus 
      ? (answerGroups.find(g => g.normalizedAnswer === this.normalizeAnswer(consensus))?.frequency || 0) / paths.length
      : 0
    
    return {
      extractedAnswers,
      answerGroups,
      consensus,
      confidence: agreementRatio,
      agreementRatio
    }
  }

  /**
   * Group similar answers together
   */
  private groupSimilarAnswers(paths: ReasoningPath[]): AnswerGroup[] {
    const groups: Map<string, AnswerGroup> = new Map()
    
    for (const path of paths) {
      if (!path.finalAnswer) continue
      
      const normalizedAnswer = this.normalizeAnswer(path.finalAnswer)
      
      if (groups.has(normalizedAnswer)) {
        const group = groups.get(normalizedAnswer)!
        group.paths.push(path.id)
        group.frequency++
        group.avgConfidence = (group.avgConfidence * (group.frequency - 1) + path.confidence) / group.frequency
      } else {
        groups.set(normalizedAnswer, {
          answer: path.finalAnswer,
          paths: [path.id],
          frequency: 1,
          avgConfidence: path.confidence,
          normalizedAnswer
        })
      }
    }
    
    return Array.from(groups.values()).sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Normalize answer for comparison
   */
  private normalizeAnswer(answer: string): string {
    return answer
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  /**
   * Find consensus answer based on frequency and confidence
   */
  private findConsensus(
    answerGroups: AnswerGroup[],
    threshold: number
  ): string | null {
    if (answerGroups.length === 0) return null
    
    const totalAnswers = answerGroups.reduce((sum, group) => sum + group.frequency, 0)
    const topGroup = answerGroups[0]
    
    const agreement = topGroup.frequency / totalAnswers
    
    return agreement >= threshold ? topGroup.answer : null
  }

  /**
   * Calculate final confidence score
   */
  private calculateFinalConfidence(
    answerComparison: AnswerComparison,
    paths: ReasoningPath[],
    config: SelfConsistencyConfig
  ): number {
    if (!answerComparison.consensus) return 0
    
    const baseConfidence = answerComparison.agreementRatio
    
    // Boost confidence based on average path confidence
    const avgPathConfidence = paths.reduce((sum, p) => sum + p.confidence, 0) / paths.length
    
    // Weight by configuration
    const weighted = config.confidenceWeighting
      ? (baseConfidence * 0.7) + (avgPathConfidence * 0.3)
      : baseConfidence
    
    return Math.max(0, Math.min(1, weighted))
  }

  /**
   * Generate consensus reasoning explanation
   */
  private generateConsensusReasoning(
    answerComparison: AnswerComparison,
    paths: ReasoningPath[]
  ): string {
    if (!answerComparison.consensus) {
      return "No consensus was reached among the reasoning paths. The answers were too diverse to establish agreement."
    }
    
    const consensusGroup = answerComparison.answerGroups[0]
    const pathCount = consensusGroup.frequency
    const totalPaths = paths.length
    
    let reasoning = `Consensus reached with ${pathCount}/${totalPaths} paths agreeing on the answer: "${answerComparison.consensus}"\n\n`
    
    reasoning += `Agreement ratio: ${(answerComparison.agreementRatio * 100).toFixed(1)}%\n`
    reasoning += `Average confidence of supporting paths: ${(consensusGroup.avgConfidence * 100).toFixed(1)}%\n\n`
    
    reasoning += "Supporting reasoning paths:\n"
    const supportingPaths = paths.filter(p => consensusGroup.paths.includes(p.id))
    
    supportingPaths.forEach((path, index) => {
      reasoning += `${index + 1}. (${path.model}): ${path.reasoning.substring(0, 150)}...\n`
    })
    
    if (answerComparison.answerGroups.length > 1) {
      reasoning += `\nAlternative answers considered:\n`
      answerComparison.answerGroups.slice(1, 3).forEach((group, index) => {
        reasoning += `${index + 1}. "${group.answer}" (${group.frequency} paths)\n`
      })
    }
    
    return reasoning
  }
}