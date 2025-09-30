/**
 * AI Tool Selection Logic for Tool-Augmented Generation (TAG)
 * 
 * Intelligent orchestration system that selects and sequences tools
 * based on context, intent, and task requirements.
 */

import { EventEmitter } from 'events';
import { 
  ToolRegistry, 
  EnhancedToolDefinition as EnhancedTool, 
  ToolSelectionCriteria, 
  ToolExecutionContext 
} from './tool-registry';

export interface TaskIntent {
  /** Primary intent category */
  category: 'code' | 'analysis' | 'search' | 'security' | 'debugging' | 'optimization';
  
  /** Specific action within the category */
  action: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Additional context */
  context?: Record<string, any>;
}

export interface TaskPlan {
  /** Unique identifier for the task */
  id: string;
  
  /** Sequence of tool executions */
  steps: ToolExecutionStep[];
  
  /** Estimated total execution time */
  estimatedDuration: number;
  
  /** Required resources */
  resourceRequirements: {
    cpu: number;
    memory: number;
    networkAccess: boolean;
  };
  
  /** Success criteria */
  successCriteria: string[];
  
  /** Fallback plans */
  fallbacks?: TaskPlan[];
}

export interface ToolExecutionStep {
  /** Tool to execute */
  toolName: string;
  
  /** Parameters for the tool */
  parameters: Record<string, any>;
  
  /** Dependencies on other steps */
  dependencies?: string[];
  
  /** Whether this step is optional */
  optional?: boolean;
  
  /** Timeout for this step */
  timeout?: number;
  
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    backoff: number;
  };
}

export interface ExecutionResult {
  /** Step identifier */
  stepId: string;
  
  /** Tool that was executed */
  toolName: string;
  
  /** Execution result */
  result: any;
  
  /** Whether the step succeeded */
  success: boolean;
  
  /** Error if the step failed */
  error?: string;
  
  /** Execution duration */
  duration: number;
  
  /** Resource usage */
  resourceUsage?: {
    cpu: number;
    memory: number;
    networkRequests: number;
  };
}

export interface OrchestrationResult {
  /** Task plan that was executed */
  plan: TaskPlan;
  
  /** Results from each step */
  results: ExecutionResult[];
  
  /** Overall success status */
  success: boolean;
  
  /** Total execution time */
  totalDuration: number;
  
  /** Summary of the orchestration */
  summary: string;
  
  /** Any recommendations for future tasks */
  recommendations?: string[];
}

/**
 * Intent classifier for determining what tools to use
 */
export class IntentClassifier {
  private intentPatterns: Map<string, RegExp[]> = new Map();
  
  constructor() {
    this.initializePatterns();
  }
  
  /**
   * Classify user intent from natural language input
   */
  classifyIntent(input: string): TaskIntent[] {
    const intents: TaskIntent[] = [];
    const lowerInput = input.toLowerCase();
    
    const patterns = Array.from(this.intentPatterns.entries());
    for (const [category, patternList] of patterns) {
      for (const pattern of patternList) {
        const match = pattern.exec(lowerInput);
        if (match) {
          const confidence = this.calculateConfidence(match, lowerInput);
          intents.push({
            category: category as any,
            action: this.extractAction(match, lowerInput),
            confidence,
            context: this.extractContext(match, lowerInput),
          });
        }
      }
    }
    
    // Sort by confidence and return top intents
    return intents
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Return top 3 intents
  }
  
  private initializePatterns(): void {
    this.intentPatterns.set('code', [
      /(?:execute|run|compile)\s+(?:this\s+)?code/i,
      /(?:test|check)\s+(?:this\s+)?(?:code|function|script)/i,
      /(?:debug|fix)\s+(?:this\s+)?(?:code|bug|error)/i,
    ]);
    
    this.intentPatterns.set('analysis', [
      /(?:analyze|check|review)\s+(?:performance|speed|efficiency)/i,
      /(?:profile|benchmark|measure)\s+(?:this\s+)?code/i,
      /(?:find|detect)\s+(?:bottlenecks|slow\s+parts|inefficiencies)/i,
    ]);
    
    this.intentPatterns.set('search', [
      /(?:find|search|look\s+up)\s+(?:documentation|docs|info)/i,
      /(?:how\s+to|example\s+of|tutorial\s+for)/i,
      /(?:explain|what\s+is|tell\s+me\s+about)/i,
    ]);
    
    this.intentPatterns.set('security', [
      /(?:check|scan|audit)\s+(?:security|vulnerabilities)/i,
      /(?:find|detect)\s+(?:security\s+issues|vulnerabilities|exploits)/i,
      /(?:is\s+this\s+)?(?:secure|safe|vulnerable)/i,
    ]);
    
    this.intentPatterns.set('optimization', [
      /(?:optimize|improve|enhance)\s+(?:this\s+)?code/i,
      /(?:make\s+)?(?:faster|more\s+efficient|better\s+performance)/i,
      /(?:reduce|minimize)\s+(?:complexity|time|memory)/i,
    ]);
  }
  
  private calculateConfidence(match: RegExpMatchArray, input: string): number {
    // Base confidence from match strength
    let confidence = 0.7;
    
    // Boost confidence for exact matches
    if (match[0].length === input.trim().length) {
      confidence += 0.2;
    }
    
    // Consider context words
    const contextWords = ['please', 'can you', 'help me', 'i need', 'i want'];
    for (const word of contextWords) {
      if (input.includes(word)) {
        confidence += 0.05;
      }
    }
    
    return Math.min(confidence, 1.0);
  }
  
  private extractAction(match: RegExpMatchArray, input: string): string {
    // Extract the primary action verb from the match
    const actionWords = match[0].match(/(?:execute|run|analyze|check|find|search|optimize)/i);
    return actionWords ? actionWords[0].toLowerCase() : 'unknown';
  }
  
  private extractContext(match: RegExpMatchArray, input: string): Record<string, any> {
    const context: Record<string, any> = {};
    
    // Extract programming language mentions
    const languages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'rust', 'go'];
    for (const lang of languages) {
      if (input.includes(lang)) {
        context.language = lang;
        break;
      }
    }
    
    // Extract urgency indicators
    const urgentWords = ['urgent', 'asap', 'quickly', 'fast', 'immediately'];
    if (urgentWords.some(word => input.includes(word))) {
      context.priority = 'high';
    }
    
    return context;
  }
}

/**
 * Task planner that creates execution plans based on intents
 */
export class TaskPlanner {
  private registry: ToolRegistry;
  
  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }
  
  /**
   * Create an execution plan based on intents
   */
  createPlan(intents: TaskIntent[], context: ToolExecutionContext): TaskPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const steps: ToolExecutionStep[] = [];
    
    for (const intent of intents) {
      const toolSteps = this.planForIntent(intent, context);
      steps.push(...toolSteps);
    }
    
    // Optimize step order and dependencies
    const optimizedSteps = this.optimizeSteps(steps);
    
    // Calculate resource requirements
    const resourceRequirements = this.calculateResourceRequirements(optimizedSteps);
    
    // Estimate duration
    const estimatedDuration = this.estimateDuration(optimizedSteps);
    
    return {
      id: planId,
      steps: optimizedSteps,
      estimatedDuration,
      resourceRequirements,
      successCriteria: this.generateSuccessCriteria(intents),
    };
  }
  
  private planForIntent(intent: TaskIntent, context: ToolExecutionContext): ToolExecutionStep[] {
    const steps: ToolExecutionStep[] = [];
    
    switch (intent.category) {
      case 'code':
        if (intent.action === 'execute' || intent.action === 'run') {
          steps.push({
            toolName: 'execute_code',
            parameters: {
              code: context.taskContext.type, // Assuming code is in task context
              language: intent.context?.language || 'javascript',
              timeout: 30000,
            },
          });
        }
        break;
        
      case 'analysis':
        steps.push({
          toolName: 'analyze_performance',
          parameters: {
            code: context.taskContext.type,
            language: intent.context?.language || 'javascript',
            analysisType: 'both',
          },
        });
        break;
        
      case 'search':
        steps.push({
          toolName: 'search_docs',
          parameters: {
            query: intent.action,
            maxResults: 5,
          },
        });
        break;
        
      case 'security':
        steps.push({
          toolName: 'check_security',
          parameters: {
            code: context.taskContext.type,
            language: intent.context?.language || 'javascript',
            scanLevel: 'standard',
          },
        });
        break;
        
      case 'optimization':
        // Multi-step optimization process
        steps.push(
          {
            toolName: 'analyze_performance',
            parameters: {
              code: context.taskContext.type,
              language: intent.context?.language || 'javascript',
            },
          },
          {
            toolName: 'check_security',
            parameters: {
              code: context.taskContext.type,
              language: intent.context?.language || 'javascript',
            },
            dependencies: ['analyze_performance'],
          }
        );
        break;
    }
    
    return steps;
  }
  
  private optimizeSteps(steps: ToolExecutionStep[]): ToolExecutionStep[] {
    // Sort steps by dependencies and optimize for parallel execution
    const sortedSteps = [...steps];
    
    // Simple topological sort based on dependencies
    sortedSteps.sort((a, b) => {
      if (a.dependencies?.includes(b.toolName)) return 1;
      if (b.dependencies?.includes(a.toolName)) return -1;
      return 0;
    });
    
    return sortedSteps;
  }
  
  private calculateResourceRequirements(steps: ToolExecutionStep[]): TaskPlan['resourceRequirements'] {
    let maxCpu = 0;
    let maxMemory = 0;
    let networkAccess = false;
    
    for (const step of steps) {
      const tool = this.registry.getTool(step.toolName);
      if (tool) {
        const resources = tool.metadata.resources;
        maxCpu = Math.max(maxCpu, this.resourceLevelToNumber(resources.cpu));
        maxMemory = Math.max(maxMemory, this.resourceLevelToNumber(resources.memory));
        networkAccess = networkAccess || resources.network;
      }
    }
    
    return {
      cpu: maxCpu,
      memory: maxMemory,
      networkAccess,
    };
  }
  
  private estimateDuration(steps: ToolExecutionStep[]): number {
    let totalDuration = 0;
    
    for (const step of steps) {
      const tool = this.registry.getTool(step.toolName);
      if (tool) {
        totalDuration += tool.metadata.expectedDuration;
      }
    }
    
    return totalDuration;
  }
  
  private resourceLevelToNumber(level: string): number {
    switch (level) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      default: return 1;
    }
  }
  
  private generateSuccessCriteria(intents: TaskIntent[]): string[] {
    const criteria: string[] = [];
    
    for (const intent of intents) {
      switch (intent.category) {
        case 'code':
          criteria.push('Code executes without errors');
          break;
        case 'analysis':
          criteria.push('Performance analysis completed successfully');
          break;
        case 'search':
          criteria.push('Relevant documentation found');
          break;
        case 'security':
          criteria.push('Security scan completed');
          break;
      }
    }
    
    return criteria;
  }
}

/**
 * Main orchestrator that coordinates tool execution
 */
export class ToolOrchestrator extends EventEmitter {
  private registry: ToolRegistry;
  private classifier: IntentClassifier;
  private planner: TaskPlanner;
  
  constructor(registry: ToolRegistry) {
    super();
    this.registry = registry;
    this.classifier = new IntentClassifier();
    this.planner = new TaskPlanner(registry);
  }
  
  /**
   * Execute a task based on natural language input
   */
  async executeTask(input: string, context: ToolExecutionContext): Promise<OrchestrationResult> {
    const startTime = Date.now();
    
    try {
      // Classify intent
      const intents = this.classifier.classifyIntent(input);
      this.emit('intentsClassified', { input, intents });
      
      if (intents.length === 0) {
        throw new Error('Unable to understand the task intent');
      }
      
      // Create execution plan
      const plan = this.planner.createPlan(intents, context);
      this.emit('planCreated', { plan });
      
      // Execute the plan
      const results = await this.executePlan(plan, context);
      
      const totalDuration = Date.now() - startTime;
      const success = results.every(r => r.success);
      
      const result: OrchestrationResult = {
        plan,
        results,
        success,
        totalDuration,
        summary: this.generateSummary(plan, results, success),
        recommendations: this.generateRecommendations(plan, results),
      };
      
      this.emit('taskCompleted', result);
      return result;
      
    } catch (error) {
      const result: OrchestrationResult = {
        plan: { id: 'failed', steps: [], estimatedDuration: 0, resourceRequirements: { cpu: 0, memory: 0, networkAccess: false }, successCriteria: [] },
        results: [],
        success: false,
        totalDuration: Date.now() - startTime,
        summary: `Task failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      
      this.emit('taskFailed', { error, result });
      return result;
    }
  }
  
  private async executePlan(plan: TaskPlan, context: ToolExecutionContext): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const completedSteps = new Set<string>();
    
    for (const step of plan.steps) {
      // Check if dependencies are met
      if (step.dependencies) {
        const unmetDeps = step.dependencies.filter(dep => !completedSteps.has(dep));
        if (unmetDeps.length > 0) {
          // Skip this step if dependencies aren't met
          results.push({
            stepId: step.toolName,
            toolName: step.toolName,
            result: null,
            success: false,
            error: `Unmet dependencies: ${unmetDeps.join(', ')}`,
            duration: 0,
          });
          continue;
        }
      }
      
      // Execute the step
      try {
        const stepResult = await this.executeStep(step, context);
        results.push(stepResult);
        
        if (stepResult.success) {
          completedSteps.add(step.toolName);
        }
      } catch (error) {
        results.push({
          stepId: step.toolName,
          toolName: step.toolName,
          result: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
        });
      }
    }
    
    return results;
  }
  
  private async executeStep(step: ToolExecutionStep, context: ToolExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.emit('stepStarted', { step });
      
      const result = await this.registry.executeTool(step.toolName, step.parameters, context);
      
      const duration = Date.now() - startTime;
      
      const executionResult: ExecutionResult = {
        stepId: step.toolName,
        toolName: step.toolName,
        result,
        success: true,
        duration,
        resourceUsage: {
          cpu: 0, // Would be measured in real implementation
          memory: 0,
          networkRequests: 0,
        },
      };
      
      this.emit('stepCompleted', { step, result: executionResult });
      return executionResult;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const executionResult: ExecutionResult = {
        stepId: step.toolName,
        toolName: step.toolName,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
      
      this.emit('stepFailed', { step, result: executionResult });
      return executionResult;
    }
  }
  
  private generateSummary(plan: TaskPlan, results: ExecutionResult[], success: boolean): string {
    const successfulSteps = results.filter(r => r.success).length;
    const totalSteps = results.length;
    
    if (success) {
      return `Successfully completed all ${totalSteps} steps in ${plan.estimatedDuration}ms`;
    } else {
      return `Completed ${successfulSteps}/${totalSteps} steps successfully`;
    }
  }
  
  private generateRecommendations(plan: TaskPlan, results: ExecutionResult[]): string[] {
    const recommendations: string[] = [];
    
    // Analyze failed steps
    const failedSteps = results.filter(r => !r.success);
    if (failedSteps.length > 0) {
      recommendations.push(`Consider retry strategies for ${failedSteps.length} failed steps`);
    }
    
    // Analyze performance
    const slowSteps = results.filter(r => r.duration > 5000);
    if (slowSteps.length > 0) {
      recommendations.push('Some steps took longer than expected - consider optimization');
    }
    
    return recommendations;
  }
}

// Export factory function for easy setup
export function createToolOrchestrator(registry: ToolRegistry): ToolOrchestrator {
  return new ToolOrchestrator(registry);
}