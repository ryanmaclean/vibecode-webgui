// Observation Tracker - Manages state, observations, and learning for ReAct agents
// Provides memory, pattern recognition, and adaptive behavior

import { UnifiedAIClient, type UnifiedChatMessage } from '../unified-ai-client'

export interface Observation {
  id: string
  timestamp: Date
  type: 'action_result' | 'environment_change' | 'user_feedback' | 'system_event'
  content: any
  source: string
  confidence: number
  metadata?: Record<string, any>
}

export interface StateSnapshot {
  id: string
  timestamp: Date
  goal: string
  currentStep: number
  observations: Observation[]
  hypotheses: string[]
  confidence: number
  nextActions: string[]
}

export interface LearningPattern {
  id: string
  pattern: string
  examples: string[]
  successRate: number
  conditions: string[]
  lastSeen: Date
}

export interface StateTransition {
  from: string
  to: string
  action: string
  observation: string
  success: boolean
  timestamp: Date
}

export class ObservationTracker {
  private aiClient: UnifiedAIClient
  private model: string
  private observations: Map<string, Observation> = new Map()
  private stateHistory: StateSnapshot[] = []
  private learningPatterns: Map<string, LearningPattern> = new Map()
  private transitions: StateTransition[] = []
  private maxObservations: number
  private maxStateHistory: number

  constructor(
    aiClient: UnifiedAIClient,
    model: string = 'gpt-4',
    maxObservations: number = 100,
    maxStateHistory: number = 50
  ) {
    this.aiClient = aiClient
    this.model = model
    this.maxObservations = maxObservations
    this.maxStateHistory = maxStateHistory
  }

  /**
   * Add a new observation to the tracking system
   */
  addObservation(
    type: Observation['type'],
    content: any,
    source: string,
    confidence: number = 1.0,
    metadata?: Record<string, any>
  ): string {
    const id = `obs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const observation: Observation = {
      id,
      timestamp: new Date(),
      type,
      content,
      source,
      confidence,
      metadata
    }

    this.observations.set(id, observation)

    // Maintain size limit
    if (this.observations.size > this.maxObservations) {
      const oldestId = Array.from(this.observations.keys())[0]
      this.observations.delete(oldestId)
    }

    console.log(`📝 Added observation: ${type} from ${source}`)
    return id
  }

  /**
   * Create a snapshot of the current state
   */
  createStateSnapshot(
    goal: string,
    currentStep: number,
    hypotheses: string[],
    confidence: number,
    nextActions: string[]
  ): string {
    const id = `state-${Date.now()}`
    
    const snapshot: StateSnapshot = {
      id,
      timestamp: new Date(),
      goal,
      currentStep,
      observations: Array.from(this.observations.values()).slice(-10), // Last 10 observations
      hypotheses: [...hypotheses],
      confidence,
      nextActions: [...nextActions]
    }

    this.stateHistory.push(snapshot)

    // Maintain size limit
    if (this.stateHistory.length > this.maxStateHistory) {
      this.stateHistory.shift()
    }

    return id
  }

  /**
   * Analyze observations to extract insights and patterns
   */
  async analyzeObservations(
    recentOnly: boolean = false,
    analysisType: 'patterns' | 'anomalies' | 'trends' = 'patterns'
  ): Promise<{
    insights: string[]
    patterns: string[]
    recommendations: string[]
    confidence: number
  }> {
    const observationsToAnalyze = recentOnly 
      ? Array.from(this.observations.values()).slice(-20)
      : Array.from(this.observations.values())

    if (observationsToAnalyze.length === 0) {
      return {
        insights: ['No observations available for analysis'],
        patterns: [],
        recommendations: ['Continue collecting observations'],
        confidence: 0
      }
    }

    const prompt = `
Analyze these observations to identify ${analysisType}:

Observations:
${observationsToAnalyze.map((obs, i) => 
  `${i + 1}. [${obs.type}] ${obs.source}: ${JSON.stringify(obs.content).slice(0, 200)}...`
).join('\n')}

Based on the observations, identify:
1. Key insights about the current situation
2. Recurring patterns or trends
3. Recommendations for future actions
4. Your confidence in these insights (0-1)

Focus on actionable insights that can improve decision-making.

Respond in JSON format:
{
  "insights": ["insight 1", "insight 2"],
  "patterns": ["pattern 1", "pattern 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "confidence": 0.85
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are an expert data analyst specializing in pattern recognition and insight extraction.' },
      { role: 'user', content: prompt }
    ]

    const response = await this.aiClient.chat(messages, this.model)
    
    try {
      const result = JSON.parse(response.content)
      
      // Store any new patterns discovered
      if (result.patterns) {
        for (const pattern of result.patterns) {
          await this.recordLearningPattern(pattern, [pattern])
        }
      }

      return result
    } catch (error) {
      console.warn('Failed to parse observation analysis JSON, using fallback')
      return {
        insights: [response.content.slice(0, 200)],
        patterns: [],
        recommendations: ['Continue current approach'],
        confidence: 0.5
      }
    }
  }

  /**
   * Detect anomalies in recent observations
   */
  async detectAnomalies(): Promise<{
    anomalies: string[]
    severity: 'low' | 'medium' | 'high'
    recommendations: string[]
  }> {
    const recentObservations = Array.from(this.observations.values()).slice(-20)
    
    if (recentObservations.length < 5) {
      return {
        anomalies: [],
        severity: 'low',
        recommendations: ['Need more observations to detect anomalies']
      }
    }

    const prompt = `
Analyze these recent observations for anomalies or unexpected patterns:

${recentObservations.map((obs, i) => 
  `${i + 1}. [${obs.type}] ${obs.source}: ${JSON.stringify(obs.content).slice(0, 200)}`
).join('\n')}

Look for:
- Unexpected results or behaviors
- Deviations from normal patterns
- Error conditions or failures
- Inconsistencies in data

Respond in JSON format:
{
  "anomalies": ["anomaly description 1", "anomaly description 2"],
  "severity": "low|medium|high",
  "recommendations": ["what to do about each anomaly"]
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are an expert at detecting anomalies and unusual patterns in data.' },
      { role: 'user', content: prompt }
    ]

    const response = await this.aiClient.chat(messages, this.model)
    
    try {
      return JSON.parse(response.content)
    } catch (error) {
      console.warn('Failed to parse anomaly detection JSON, using fallback')
      return {
        anomalies: [],
        severity: 'low',
        recommendations: ['Monitor for patterns in future observations']
      }
    }
  }

  /**
   * Learn from successful and failed action patterns
   */
  async recordLearningPattern(
    pattern: string,
    examples: string[],
    successRate: number = 0.5,
    conditions: string[] = []
  ): Promise<void> {
    const patternId = this.generatePatternId(pattern)
    
    const existingPattern = this.learningPatterns.get(patternId)
    if (existingPattern) {
      // Update existing pattern
      existingPattern.examples.push(...examples)
      existingPattern.successRate = (existingPattern.successRate + successRate) / 2
      existingPattern.conditions.push(...conditions)
      existingPattern.lastSeen = new Date()
      
      // Keep only recent examples
      if (existingPattern.examples.length > 10) {
        existingPattern.examples = existingPattern.examples.slice(-10)
      }
    } else {
      // Create new pattern
      const newPattern: LearningPattern = {
        id: patternId,
        pattern,
        examples: [...examples],
        successRate,
        conditions: [...conditions],
        lastSeen: new Date()
      }
      
      this.learningPatterns.set(patternId, newPattern)
    }

    console.log(`🧠 Recorded learning pattern: ${pattern.slice(0, 50)}...`)
  }

  /**
   * Get relevant learning patterns for current context
   */
  async getRelevantPatterns(
    currentGoal: string,
    currentContext: string
  ): Promise<LearningPattern[]> {
    if (this.learningPatterns.size === 0) {
      return []
    }

    const prompt = `
Find learning patterns relevant to this current context:

Current goal: ${currentGoal}
Current context: ${currentContext}

Available patterns:
${Array.from(this.learningPatterns.values()).map(p => 
  `- ${p.pattern} (success rate: ${p.successRate}, conditions: ${p.conditions.join(', ')})`
).join('\n')}

Which patterns are most relevant? Respond with pattern IDs in order of relevance.

Respond in JSON format:
{
  "relevantPatterns": ["pattern_id_1", "pattern_id_2"],
  "reasoning": "Why these patterns are relevant"
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are matching learned patterns to current contexts for better decision-making.' },
      { role: 'user', content: prompt }
    ]

    try {
      const response = await this.aiClient.chat(messages, this.model)
      const result = JSON.parse(response.content)
      
      return result.relevantPatterns
        .map((id: string) => this.learningPatterns.get(id))
        .filter((pattern: LearningPattern | undefined) => pattern !== undefined)
    } catch (error) {
      console.warn('Failed to get relevant patterns, returning all patterns')
      return Array.from(this.learningPatterns.values())
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 3)
    }
  }

  /**
   * Record a state transition for learning
   */
  recordTransition(
    fromState: string,
    toState: string,
    action: string,
    observation: string,
    success: boolean
  ): void {
    const transition: StateTransition = {
      from: fromState,
      to: toState,
      action,
      observation,
      success,
      timestamp: new Date()
    }

    this.transitions.push(transition)

    // Maintain size limit
    if (this.transitions.length > 200) {
      this.transitions.shift()
    }

    // Learn from successful transitions
    if (success) {
      this.recordLearningPattern(
        `${fromState} -> ${toState} via ${action}`,
        [observation],
        1.0,
        [fromState, action]
      )
    }
  }

  /**
   * Get state trend analysis
   */
  async analyzeStateTrends(): Promise<{
    trends: string[]
    predictions: string[]
    confidence: number
  }> {
    if (this.stateHistory.length < 3) {
      return {
        trends: ['Insufficient data for trend analysis'],
        predictions: ['Continue current approach'],
        confidence: 0
      }
    }

    const recentStates = this.stateHistory.slice(-10)
    
    const prompt = `
Analyze trends in these state snapshots:

${recentStates.map((state, i) => 
  `State ${i + 1}: Goal="${state.goal}", Step=${state.currentStep}, Confidence=${state.confidence}`
).join('\n')}

Identify:
1. Trends in confidence levels
2. Progress patterns
3. Potential future states
4. Recommendations for improvement

Respond in JSON format:
{
  "trends": ["trend 1", "trend 2"],
  "predictions": ["prediction 1", "prediction 2"],
  "confidence": 0.75
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are analyzing state progression trends to predict future outcomes.' },
      { role: 'user', content: prompt }
    ]

    const response = await this.aiClient.chat(messages, this.model)
    
    try {
      return JSON.parse(response.content)
    } catch (error) {
      console.warn('Failed to parse state trend analysis, using fallback')
      return {
        trends: ['State progression appears normal'],
        predictions: ['Continue current approach'],
        confidence: 0.5
      }
    }
  }

  /**
   * Get summary of current state and recommendations
   */
  async getSummaryAndRecommendations(): Promise<{
    summary: string
    keyObservations: string[]
    recommendations: string[]
    riskFactors: string[]
    confidence: number
  }> {
    const recentObservations = Array.from(this.observations.values()).slice(-10)
    const currentState = this.stateHistory[this.stateHistory.length - 1]
    const topPatterns = Array.from(this.learningPatterns.values())
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3)

    const prompt = `
Provide a comprehensive summary and recommendations based on current state:

Current State: ${currentState ? `Goal: ${currentState.goal}, Step: ${currentState.currentStep}, Confidence: ${currentState.confidence}` : 'No state available'}

Recent Observations:
${recentObservations.map(obs => `- [${obs.type}] ${obs.source}: ${JSON.stringify(obs.content).slice(0, 100)}`).join('\n')}

Top Learning Patterns:
${topPatterns.map(p => `- ${p.pattern} (${p.successRate} success rate)`).join('\n')}

Provide:
1. Overall summary of current situation
2. Key observations worth noting
3. Specific recommendations for next actions
4. Potential risk factors to monitor
5. Your confidence in these recommendations

Respond in JSON format:
{
  "summary": "Overall situation summary",
  "keyObservations": ["observation 1", "observation 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "riskFactors": ["risk 1", "risk 2"],
  "confidence": 0.8
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are providing strategic guidance based on accumulated observations and learning.' },
      { role: 'user', content: prompt }
    ]

    const response = await this.aiClient.chat(messages, this.model)
    
    try {
      return JSON.parse(response.content)
    } catch (error) {
      console.warn('Failed to parse summary analysis, using fallback')
      return {
        summary: response.content.slice(0, 200),
        keyObservations: ['Multiple observations recorded'],
        recommendations: ['Continue monitoring and learning'],
        riskFactors: ['Limited data for risk assessment'],
        confidence: 0.5
      }
    }
  }

  // Utility methods
  private generatePatternId(pattern: string): string {
    // Simple hash function for pattern ID
    let hash = 0
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `pattern-${Math.abs(hash)}`
  }

  // Getters for state inspection
  getObservations(): Observation[] {
    return Array.from(this.observations.values())
  }

  getRecentObservations(count: number = 10): Observation[] {
    return Array.from(this.observations.values()).slice(-count)
  }

  getStateHistory(): StateSnapshot[] {
    return [...this.stateHistory]
  }

  getLearningPatterns(): LearningPattern[] {
    return Array.from(this.learningPatterns.values())
  }

  getTransitions(): StateTransition[] {
    return [...this.transitions]
  }

  // Reset for new session
  reset(): void {
    this.observations.clear()
    this.stateHistory = []
    this.transitions = []
    // Keep learning patterns across sessions for continuity
  }

  // Clear all data including learned patterns
  clearAll(): void {
    this.observations.clear()
    this.stateHistory = []
    this.learningPatterns.clear()
    this.transitions = []
  }
}