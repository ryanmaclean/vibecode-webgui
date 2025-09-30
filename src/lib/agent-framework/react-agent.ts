// ReAct Agent - Implements the Think → Act → Observe pattern for reliable AI actions
// Based on the ReAct paper: "ReAct: Synergizing Reasoning and Acting in Language Models"

import { UnifiedAIClient, type UnifiedChatMessage } from '../unified-ai-client'
import { Agent, type AgentCapability, type AgentContext, type AgentTask } from '../agent-framework'

export interface ReActStep {
  type: 'thought' | 'action' | 'observation'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface ReActState {
  goal: string
  steps: ReActStep[]
  currentThought: string | null
  isComplete: boolean
  maxSteps: number
  currentStepIndex: number
  errors: string[]
  corrections: string[]
}

export interface ReActObservation {
  success: boolean
  result: any
  error?: string
  confidence: number
  needsCorrection: boolean
  suggestedAction?: string
}

export class ReActAgent extends Agent {
  private state: ReActState
  private reasoningPrompts: {
    initial: string
    continue: string
    correct: string
    complete: string
  }

  constructor(
    id: string,
    name: string,
    description: string,
    aiClient: UnifiedAIClient,
    model: string = 'gpt-4',
    maxSteps: number = 10
  ) {
    super(id, name, description, aiClient, model)
    
    this.state = {
      goal: '',
      steps: [],
      currentThought: null,
      isComplete: false,
      maxSteps,
      currentStepIndex: 0,
      errors: [],
      corrections: []
    }

    this.reasoningPrompts = {
      initial: this.buildInitialReasoningPrompt(),
      continue: this.buildContinueReasoningPrompt(),
      correct: this.buildCorrectionPrompt(),
      complete: this.buildCompletionPrompt()
    }
  }

  /**
   * Execute a task using the ReAct pattern: Think → Act → Observe → Repeat
   */
  async executeReActTask(task: AgentTask, context: AgentContext): Promise<any> {
    this.initializeState(task.description)
    
    console.log(`🤖 ${this.getName()} starting ReAct execution for: ${task.description}`)
    
    try {
      while (!this.state.isComplete && this.state.currentStepIndex < this.state.maxSteps) {
        await this.performReActCycle(task, context)
        this.state.currentStepIndex++
      }

      if (this.state.isComplete) {
        console.log(`✅ Task completed successfully after ${this.state.currentStepIndex} steps`)
        return this.extractFinalResult()
      } else {
        console.log(`⚠️ Task reached maximum steps (${this.state.maxSteps}) without completion`)
        return { 
          status: 'partial', 
          result: this.extractFinalResult(), 
          reason: 'max_steps_reached' 
        }
      }
    } catch (error) {
      console.error(`❌ ReAct execution failed:`, error)
      this.state.errors.push(error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * Perform one complete Think → Act → Observe cycle
   */
  private async performReActCycle(task: AgentTask, context: AgentContext): Promise<void> {
    // THINK: Reason about the current situation and plan next action
    const thought = await this.think(task, context)
    this.addStep('thought', thought)

    // ACT: Execute the planned action
    const actionResult = await this.act(thought, task, context)
    this.addStep('action', actionResult.description)

    // OBSERVE: Analyze the result and update state
    const observation = await this.observe(actionResult, context)
    this.addStep('observation', observation.result)

    // Check if we need correction or if we're complete
    if (observation.needsCorrection) {
      await this.correctAction(observation, context)
    }

    this.state.isComplete = await this.checkCompletion(task, context)
  }

  /**
   * THINK: Generate reasoning about the current situation and next steps
   */
  private async think(task: AgentTask, context: AgentContext): Promise<string> {
    const prompt = this.state.currentStepIndex === 0 
      ? this.reasoningPrompts.initial 
      : this.reasoningPrompts.continue

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: this.buildThinkingContext(task, context) }
    ]

    const response = await this.getAIClient().chat(messages, this.getModel())
    this.state.currentThought = response.content

    console.log(`🤔 Thinking: ${response.content.slice(0, 150)}...`)
    return response.content
  }

  /**
   * ACT: Execute the action determined by thinking
   */
  private async act(thought: string, task: AgentTask, context: AgentContext): Promise<{
    description: string
    result: any
    capability?: string
  }> {
    // Extract action from thought using AI
    const actionPlan = await this.extractActionFromThought(thought, task, context)
    
    console.log(`🛠️ Acting: ${actionPlan.description}`)

    if (actionPlan.capability && this.hasCapability(actionPlan.capability)) {
      // Execute using agent capability
      const capability = this.getCapability(actionPlan.capability)
      const result = await capability.execute(actionPlan.parameters, context)
      
      return {
        description: actionPlan.description,
        result,
        capability: actionPlan.capability
      }
    } else {
      // Execute as direct AI response
      return {
        description: actionPlan.description,
        result: actionPlan.result || 'Action completed'
      }
    }
  }

  /**
   * OBSERVE: Analyze action results and determine next steps
   */
  private async observe(actionResult: any, context: AgentContext): Promise<ReActObservation> {
    const observationPrompt = `
You are analyzing the result of an action taken by an AI agent. Your job is to:
1. Evaluate if the action was successful
2. Determine if the result is useful for the goal
3. Identify any errors or issues
4. Suggest corrections if needed
5. Assess confidence in the result

Action taken: ${actionResult.description}
Result: ${JSON.stringify(actionResult.result, null, 2)}

Respond in JSON format:
{
  "success": boolean,
  "confidence": number (0-1),
  "needsCorrection": boolean,
  "analysis": "Brief analysis of the result",
  "suggestedAction": "Next recommended action or correction"
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are an expert at analyzing action results and providing feedback.' },
      { role: 'user', content: observationPrompt }
    ]

    const response = await this.getAIClient().chat(messages, this.getModel())
    
    try {
      const observation = JSON.parse(response.content)
      console.log(`👁️ Observing: ${observation.analysis} (confidence: ${observation.confidence})`)
      
      return {
        success: observation.success,
        result: observation.analysis,
        confidence: observation.confidence,
        needsCorrection: observation.needsCorrection,
        suggestedAction: observation.suggestedAction
      }
    } catch (error) {
      console.warn('Failed to parse observation JSON, using fallback')
      return {
        success: true,
        result: response.content,
        confidence: 0.5,
        needsCorrection: false
      }
    }
  }

  /**
   * CORRECT: Apply corrections based on observations
   */
  private async correctAction(observation: ReActObservation, context: AgentContext): Promise<void> {
    if (!observation.suggestedAction) return

    console.log(`🔧 Correcting: ${observation.suggestedAction}`)
    this.state.corrections.push(observation.suggestedAction)
    
    // Add the correction as a thought for the next cycle
    this.addStep('thought', `Correction needed: ${observation.suggestedAction}`)
  }

  /**
   * Check if the task is complete
   */
  private async checkCompletion(task: AgentTask, context: AgentContext): Promise<boolean> {
    const completionPrompt = `
Analyze if the following goal has been achieved based on the conversation history:

Goal: ${this.state.goal}
Current steps taken: ${this.state.steps.length}
Recent steps:
${this.state.steps.slice(-3).map(step => `${step.type}: ${step.content}`).join('\n')}

Has the goal been sufficiently achieved? Respond with only "COMPLETE" or "CONTINUE".
If CONTINUE, briefly explain what still needs to be done.
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: this.reasoningPrompts.complete },
      { role: 'user', content: completionPrompt }
    ]

    const response = await this.getAIClient().chat(messages, this.getModel())
    const isComplete = response.content.toLowerCase().includes('complete')
    
    if (isComplete) {
      console.log('✅ Task marked as complete by completion checker')
    } else {
      console.log(`⏭️ Continuing: ${response.content}`)
    }

    return isComplete
  }

  // Helper methods
  private initializeState(goal: string): void {
    this.state = {
      goal,
      steps: [],
      currentThought: null,
      isComplete: false,
      maxSteps: this.state.maxSteps,
      currentStepIndex: 0,
      errors: [],
      corrections: []
    }
  }

  private addStep(type: ReActStep['type'], content: string, metadata?: Record<string, any>): void {
    this.state.steps.push({
      type,
      content,
      timestamp: new Date(),
      metadata
    })
  }

  private buildThinkingContext(task: AgentTask, context: AgentContext): string {
    return `
Current Goal: ${this.state.goal}
Task Priority: ${task.priority}
Available Capabilities: ${this.getCapabilities().join(', ')}
Step ${this.state.currentStepIndex + 1} of ${this.state.maxSteps}

Previous Steps:
${this.state.steps.map((step, i) => 
  `${i + 1}. ${step.type.toUpperCase()}: ${step.content.slice(0, 100)}...`
).join('\n')}

Recent Corrections: ${this.state.corrections.slice(-2).join('; ')}

What should be the next action to achieve the goal?
`
  }

  private async extractActionFromThought(
    thought: string, 
    task: AgentTask, 
    context: AgentContext
  ): Promise<{
    description: string
    capability?: string
    parameters?: any
    result?: string
  }> {
    const actionPrompt = `
Based on this reasoning: "${thought}"

Available capabilities: ${this.getCapabilities().join(', ')}

Extract the specific action to take. Respond in JSON format:
{
  "description": "Clear description of the action",
  "capability": "capability name if using one, or null",
  "parameters": "parameters for the capability if applicable",
  "result": "direct result if not using a capability"
}
`

    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: 'You are an expert at extracting actionable steps from reasoning.' },
      { role: 'user', content: actionPrompt }
    ]

    const response = await this.getAIClient().chat(messages, this.getModel())
    
    try {
      return JSON.parse(response.content)
    } catch (error) {
      // Fallback to simple action
      return {
        description: thought.slice(0, 200),
        result: 'Action extracted from thought'
      }
    }
  }

  private extractFinalResult(): any {
    const lastObservation = this.state.steps
      .filter(step => step.type === 'observation')
      .pop()

    return {
      goal: this.state.goal,
      steps: this.state.steps.length,
      result: lastObservation?.content || 'Task completed',
      corrections: this.state.corrections.length,
      errors: this.state.errors
    }
  }

  // Prompt templates
  private buildInitialReasoningPrompt(): string {
    return `You are an intelligent agent using the ReAct (Reasoning + Acting) pattern. 
Your job is to think step-by-step about how to achieve a given goal.

For each reasoning step:
1. Analyze the current situation
2. Consider what information you have and what you need
3. Plan the most logical next action
4. Be specific about what you want to accomplish

Think methodically and break down complex goals into smaller, actionable steps.
Focus on one concrete action at a time.`
  }

  private buildContinueReasoningPrompt(): string {
    return `Continue your ReAct reasoning process. 
Review what has been done so far and determine the best next action.

Consider:
- What progress has been made toward the goal
- What new information is available from previous actions
- Whether any corrections are needed
- What the most logical next step should be

Be adaptive and willing to change course if previous actions weren't effective.`
  }

  private buildCorrectionPrompt(): string {
    return `An issue has been identified that requires correction.
Think about how to address this issue and get back on track toward the goal.

Focus on:
- Understanding what went wrong
- Planning a corrective action
- Learning from the mistake to avoid repeating it`
  }

  private buildCompletionPrompt(): string {
    return `Evaluate whether the given goal has been achieved based on the actions taken.
Be thorough but practical in your assessment.

A goal is complete when:
- The main objective has been satisfied
- No critical steps are missing
- The result is usable and meets the requirements

A goal needs more work when:
- Key functionality is missing
- There are significant errors or gaps
- The objective hasn't been met`
  }

  // Public interface methods
  public getState(): ReActState {
    return { ...this.state }
  }

  public getStepHistory(): ReActStep[] {
    return [...this.state.steps]
  }

  // Private method accessors (for internal use)
  private getName(): string {
    // @ts-expect-error - Accessing private property for internal use
    return this.name
  }

  private getAIClient(): UnifiedAIClient {
    // @ts-expect-error - Accessing private property for internal use
    return this.aiClient
  }

  private getModel(): string {
    // @ts-expect-error - Accessing private property for internal use
    return this.model
  }

  private hasCapability(name: string): boolean {
    // @ts-expect-error - Accessing private property for internal use
    return this.capabilities.has(name)
  }

  private getCapability(name: string): AgentCapability {
    // @ts-expect-error - Accessing private property for internal use
    return this.capabilities.get(name)!
  }
}