// Reasoning Engine - Advanced reasoning capabilities for ReAct agents
// Implements sophisticated reasoning patterns including hypothesis testing and self-correction

import { UnifiedAIClient, type UnifiedChatMessage } from '../unified-ai-client'

export interface ReasoningHypothesis {
  id: string
  description: string
  confidence: number
  evidence: string[]
  counterEvidence: string[]
  tested: boolean
  outcome?: 'confirmed' | 'rejected' | 'inconclusive'
}

export interface ReasoningBranch {
  id: string
  parentId?: string
  description: string
  steps: string[]
  evaluation: number // 0-1 score
  active: boolean
}

export interface ReasoningContext {
  goal: string
  constraints: string[]
  availableActions: string[]
  previousAttempts: string[]
  domainKnowledge: Record<string, any>
}

export class ReasoningEngine {
  private aiClient: UnifiedAIClient
  private model: string
  private hypotheses: Map<string, ReasoningHypothesis> = new Map()
  private branches: Map<string, ReasoningBranch> = new Map()
  private reasoningHistory: string[] = []

  constructor(aiClient: UnifiedAIClient, model: string = 'gpt-4') {
    this.aiClient = aiClient
    this.model = model
  }

  /**
   * Generate initial reasoning about how to approach a goal
   */
  async generateInitialReasoning(context: ReasoningContext): Promise<{
    reasoning: string
    hypotheses: ReasoningHypothesis[]
    recommendedApproach: string
  }> {
    const prompt = `
You are an expert reasoning system. Analyze this goal and generate a comprehensive approach.

Goal: ${context.goal}
Constraints: ${context.constraints.join(', ')}
Available actions: ${context.availableActions.join(', ')}
Previous attempts: ${context.previousAttempts.join(', ')}

Provide:
1. Initial reasoning about the problem
2. 2-3 hypotheses about the best approach
3. A recommended first step

Be thorough but practical. Consider multiple approaches and potential obstacles.

Respond in JSON format:
{
  "reasoning": "Your detailed reasoning about the problem",
  "hypotheses": [
    {
      "description": "Hypothesis about approach",
      "confidence": 0.8,
      "rationale": "Why this approach might work"
    }
  ],
  "recommendedApproach": "Specific next action to take"
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are an expert reasoning system that helps AI agents make better decisions.' },
      { role: 'user', content: prompt }
    ]

    const response = await this.aiClient.chat(messages, this.model)
    
    try {
      const result = JSON.parse(response.content)
      
      // Store hypotheses
      const hypotheses: ReasoningHypothesis[] = result.hypotheses.map((h: any, index: number) => ({
        id: `hyp-${Date.now()}-${index}`,
        description: h.description,
        confidence: h.confidence,
        evidence: [h.rationale],
        counterEvidence: [],
        tested: false
      }))

      hypotheses.forEach(h => this.hypotheses.set(h.id, h))
      this.reasoningHistory.push(result.reasoning)

      return {
        reasoning: result.reasoning,
        hypotheses,
        recommendedApproach: result.recommendedApproach
      }
    } catch (error) {
      console.warn('Failed to parse reasoning JSON, using fallback')
      const fallbackHypothesis: ReasoningHypothesis = {
        id: `hyp-${Date.now()}`,
        description: 'Direct approach to the goal',
        confidence: 0.6,
        evidence: ['Standard problem-solving approach'],
        counterEvidence: [],
        tested: false
      }

      this.hypotheses.set(fallbackHypothesis.id, fallbackHypothesis)
      
      return {
        reasoning: response.content,
        hypotheses: [fallbackHypothesis],
        recommendedApproach: 'Proceed with the most straightforward approach'
      }
    }
  }

  /**
   * Continue reasoning based on new observations
   */
  async continueReasoning(
    observation: string,
    previousAction: string,
    context: ReasoningContext
  ): Promise<{
    reasoning: string
    nextAction: string
    hypothesisUpdates: ReasoningHypothesis[]
    confidenceAdjustments: Record<string, number>
  }> {
    const prompt = `
Continue reasoning based on this new observation:

Previous action: ${previousAction}
Observation: ${observation}
Goal: ${context.goal}

Current hypotheses:
${Array.from(this.hypotheses.values()).map(h => 
  `- ${h.description} (confidence: ${h.confidence})`
).join('\n')}

Previous reasoning:
${this.reasoningHistory.slice(-2).join('\n')}

Based on this observation:
1. How should we update our understanding?
2. Which hypotheses are strengthened or weakened?
3. What should the next action be?
4. Are any corrections needed?

Respond in JSON format:
{
  "reasoning": "Updated reasoning based on observation",
  "nextAction": "Specific next action to take",
  "hypothesisUpdates": [
    {
      "id": "hypothesis_id",
      "newEvidence": "evidence supporting or contradicting",
      "confidenceChange": 0.1 or -0.1
    }
  ],
  "needsCorrection": boolean,
  "correctionReason": "why correction is needed if applicable"
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are continuing a reasoning process. Update your understanding based on new evidence.' },
      { role: 'user', content: prompt }
    ]

    const response = await this.aiClient.chat(messages, this.model)
    
    try {
      const result = JSON.parse(response.content)
      
      // Update hypotheses based on new evidence
      const hypothesisUpdates: ReasoningHypothesis[] = []
      const confidenceAdjustments: Record<string, number> = {}

      if (result.hypothesisUpdates) {
        for (const update of result.hypothesisUpdates) {
          const hypothesis = this.hypotheses.get(update.id)
          if (hypothesis) {
            if (update.confidenceChange > 0) {
              hypothesis.evidence.push(update.newEvidence)
            } else {
              hypothesis.counterEvidence.push(update.newEvidence)
            }
            
            hypothesis.confidence = Math.max(0, Math.min(1, 
              hypothesis.confidence + update.confidenceChange
            ))
            
            hypothesisUpdates.push(hypothesis)
            confidenceAdjustments[update.id] = update.confidenceChange
          }
        }
      }

      this.reasoningHistory.push(result.reasoning)

      return {
        reasoning: result.reasoning,
        nextAction: result.nextAction,
        hypothesisUpdates,
        confidenceAdjustments
      }
    } catch (error) {
      console.warn('Failed to parse continued reasoning JSON, using fallback')
      return {
        reasoning: response.content,
        nextAction: 'Continue with the current approach',
        hypothesisUpdates: [],
        confidenceAdjustments: {}
      }
    }
  }

  /**
   * Test a specific hypothesis by analyzing evidence
   */
  async testHypothesis(
    hypothesisId: string,
    newEvidence: string
  ): Promise<{
    outcome: 'confirmed' | 'rejected' | 'inconclusive'
    reasoning: string
    confidence: number
  }> {
    const hypothesis = this.hypotheses.get(hypothesisId)
    if (!hypothesis) {
      throw new Error(`Hypothesis ${hypothesisId} not found`)
    }

    const prompt = `
Test this hypothesis based on available evidence:

Hypothesis: ${hypothesis.description}
Current confidence: ${hypothesis.confidence}

Supporting evidence:
${hypothesis.evidence.join('\n')}

Counter evidence:
${hypothesis.counterEvidence.join('\n')}

New evidence: ${newEvidence}

Based on all evidence, is this hypothesis:
- CONFIRMED: Strong evidence supports it
- REJECTED: Evidence contradicts it
- INCONCLUSIVE: Not enough evidence either way

Respond in JSON format:
{
  "outcome": "confirmed|rejected|inconclusive",
  "reasoning": "Detailed analysis of the evidence",
  "newConfidence": 0.85
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are testing a hypothesis based on evidence. Be objective and thorough.' },
      { role: 'user', content: prompt }
    ]

    const response = await this.aiClient.chat(messages, this.model)
    
    try {
      const result = JSON.parse(response.content)
      
      // Update hypothesis
      hypothesis.tested = true
      hypothesis.outcome = result.outcome
      hypothesis.confidence = result.newConfidence
      
      if (result.outcome === 'confirmed') {
        hypothesis.evidence.push(newEvidence)
      } else if (result.outcome === 'rejected') {
        hypothesis.counterEvidence.push(newEvidence)
      }

      return {
        outcome: result.outcome,
        reasoning: result.reasoning,
        confidence: result.newConfidence
      }
    } catch (error) {
      console.warn('Failed to parse hypothesis test JSON, using fallback')
      return {
        outcome: 'inconclusive',
        reasoning: response.content,
        confidence: hypothesis.confidence
      }
    }
  }

  /**
   * Generate alternative approaches when current approach isn't working
   */
  async generateAlternativeApproaches(
    currentApproach: string,
    failureReason: string,
    context: ReasoningContext
  ): Promise<{
    alternatives: string[]
    reasoning: string
    recommendedAlternative: string
  }> {
    const prompt = `
The current approach is not working. Generate alternative approaches.

Current approach: ${currentApproach}
Why it failed: ${failureReason}
Goal: ${context.goal}
Constraints: ${context.constraints.join(', ')}
Available actions: ${context.availableActions.join(', ')}

Generate 2-3 completely different approaches that might work better.
Consider:
- Different strategies or methodologies
- Alternative tools or capabilities
- Different sequencing of actions
- Workarounds for the current failure

Respond in JSON format:
{
  "reasoning": "Analysis of why current approach failed and what alternatives might work",
  "alternatives": [
    "Alternative approach 1",
    "Alternative approach 2", 
    "Alternative approach 3"
  ],
  "recommendedAlternative": "The best alternative to try next"
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are an expert problem solver who finds creative alternatives when the obvious approach fails.' },
      { role: 'user', content: prompt }
    ]

    const response = await this.aiClient.chat(messages, this.model)
    
    try {
      const result = JSON.parse(response.content)
      
      // Create new hypotheses for alternatives
      result.alternatives.forEach((alt: string, index: number) => {
        const hypothesis: ReasoningHypothesis = {
          id: `alt-${Date.now()}-${index}`,
          description: alt,
          confidence: 0.5, // Start with medium confidence for alternatives
          evidence: [`Alternative to failed approach: ${currentApproach}`],
          counterEvidence: [],
          tested: false
        }
        this.hypotheses.set(hypothesis.id, hypothesis)
      })

      return result
    } catch (error) {
      console.warn('Failed to parse alternatives JSON, using fallback')
      return {
        reasoning: response.content,
        alternatives: ['Try a different sequence of actions', 'Use different tools if available'],
        recommendedAlternative: 'Try a different sequence of actions'
      }
    }
  }

  /**
   * Perform self-correction analysis
   */
  async analyzeSelfCorrection(
    originalAction: string,
    observedResult: string,
    expectedResult: string
  ): Promise<{
    needsCorrection: boolean
    correctionType: 'retry' | 'modify' | 'abandon' | 'none'
    correctionAction: string
    reasoning: string
  }> {
    const prompt = `
Analyze if self-correction is needed:

Original action: ${originalAction}
Expected result: ${expectedResult}
Actual result: ${observedResult}

Determine:
1. Does the actual result significantly differ from expected?
2. What type of correction is needed?
   - RETRY: Same action but with adjustments
   - MODIFY: Change the approach slightly
   - ABANDON: This approach won't work, try something else
   - NONE: The result is acceptable

3. What specific correction should be made?

Respond in JSON format:
{
  "needsCorrection": boolean,
  "correctionType": "retry|modify|abandon|none",
  "correctionAction": "Specific action to take for correction",
  "reasoning": "Why this correction is or isn't needed"
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are an expert at analyzing results and determining when corrections are needed.' },
      { role: 'user', content: prompt }
    ]

    const response = await this.aiClient.chat(messages, this.model)
    
    try {
      return JSON.parse(response.content)
    } catch (error) {
      console.warn('Failed to parse self-correction JSON, using fallback')
      return {
        needsCorrection: false,
        correctionType: 'none',
        correctionAction: 'Continue with current approach',
        reasoning: response.content
      }
    }
  }

  /**
   * Create a reasoning branch for exploring alternative paths
   */
  createReasoningBranch(
    description: string,
    parentId?: string
  ): string {
    const branchId = `branch-${Date.now()}`
    const branch: ReasoningBranch = {
      id: branchId,
      parentId,
      description,
      steps: [],
      evaluation: 0.5,
      active: true
    }
    
    this.branches.set(branchId, branch)
    return branchId
  }

  /**
   * Evaluate and compare reasoning branches
   */
  async evaluateBranches(): Promise<{
    bestBranch: string
    evaluation: Record<string, number>
    reasoning: string
  }> {
    if (this.branches.size === 0) {
      throw new Error('No branches to evaluate')
    }

    const branchDescriptions = Array.from(this.branches.values())
      .map(b => `${b.id}: ${b.description}`)
      .join('\n')

    const prompt = `
Evaluate these reasoning branches and determine which is most promising:

${branchDescriptions}

Consider:
- Likelihood of success
- Efficiency of approach
- Risk factors
- Alignment with goal

Respond in JSON format:
{
  "bestBranch": "branch_id",
  "evaluations": {
    "branch_id": 0.85
  },
  "reasoning": "Why this branch is best"
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are evaluating different reasoning paths to find the most promising approach.' },
      { role: 'user', content: prompt }
    ]

    const response = await this.aiClient.chat(messages, this.model)
    
    try {
      const result = JSON.parse(response.content)
      
      // Update branch evaluations
      for (const [branchId, score] of Object.entries(result.evaluations)) {
        const branch = this.branches.get(branchId)
        if (branch) {
          branch.evaluation = score as number
        }
      }

      return {
        bestBranch: result.bestBranch,
        evaluation: result.evaluations,
        reasoning: result.reasoning
      }
    } catch (error) {
      console.warn('Failed to parse branch evaluation JSON, using fallback')
      const firstBranch = Array.from(this.branches.keys())[0]
      return {
        bestBranch: firstBranch,
        evaluation: { [firstBranch]: 0.5 },
        reasoning: response.content
      }
    }
  }

  // Getters for state inspection
  getHypotheses(): ReasoningHypothesis[] {
    return Array.from(this.hypotheses.values())
  }

  getBranches(): ReasoningBranch[] {
    return Array.from(this.branches.values())
  }

  getReasoningHistory(): string[] {
    return [...this.reasoningHistory]
  }

  // Reset state for new reasoning session
  reset(): void {
    this.hypotheses.clear()
    this.branches.clear()
    this.reasoningHistory = []
  }
}