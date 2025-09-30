import { StateGraph, END, START } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { 
  CodeDevelopmentState, 
  WorkflowConfig, 
  WorkflowResult, 
  WorkflowInput,
  DEFAULT_WORKFLOW_CONFIG,
  CODE_DEVELOPMENT_STEPS
} from './workflow-state';
import { RetryHandler } from '../../vector-db/vector-retry-handler';
import { randomUUID } from 'crypto';

/**
 * LangGraph-based code development workflow
 * Implements: analyze → design → implement → test → review flow
 */
export class CodeDevelopmentWorkflow {
  private graph: StateGraph<CodeDevelopmentState>;
  private config: WorkflowConfig;
  private retryHandler: RetryHandler;
  private models: Map<string, ChatOpenAI> = new Map();

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = { ...DEFAULT_WORKFLOW_CONFIG, ...config };
    this.retryHandler = new RetryHandler({
      maxRetries: this.config.maxRetries,
      baseDelay: 1000,
      maxDelay: 30000,
    });
    
    this.initializeModels();
    this.graph = this.createWorkflowGraph();
  }

  /**
   * Initialize AI models for each agent
   */
  private initializeModels(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    Object.entries(this.config.agentConfigs || {}).forEach(([agent, config]) => {
      this.models.set(agent, new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens || 4000,
      }));
    });
  }

  /**
   * Create the LangGraph workflow
   */
  private createWorkflowGraph(): StateGraph<CodeDevelopmentState> {
    const graph = new StateGraph<CodeDevelopmentState>({
      channels: {
        sessionId: { reducer: (x: string) => x, default: () => '' },
        currentStep: { reducer: (x: string) => x, default: () => '' },
        originalInput: { reducer: (x: string) => x, default: () => '' },
        outputs: { reducer: (x: Record<string, any>, y?: Record<string, any>) => ({ ...x, ...y }), default: () => ({}) },
        error: { reducer: (x: any) => x, default: () => undefined },
        metadata: { reducer: (x: any, y?: any) => ({ ...x, ...y }), default: () => ({}) },
        requirements: { reducer: (x: string) => x, default: () => '' },
        language: { reducer: (x?: string) => x, default: () => undefined },
        framework: { reducer: (x?: string) => x, default: () => undefined },
        analysis: { reducer: (x: any) => x, default: () => undefined },
        design: { reducer: (x: any) => x, default: () => undefined },
        implementation: { reducer: (x: any) => x, default: () => undefined },
        testing: { reducer: (x: any) => x, default: () => undefined },
        review: { reducer: (x: any) => x, default: () => undefined },
      }
    });

    // Add workflow nodes
    graph.addNode('analyze', this.analyzeStep.bind(this));
    graph.addNode('design', this.designStep.bind(this));
    graph.addNode('implement', this.implementStep.bind(this));
    graph.addNode('test', this.testStep.bind(this));
    graph.addNode('review', this.reviewStep.bind(this));

    // Define workflow edges
    graph.addEdge(START, 'analyze');
    graph.addEdge('analyze', 'design');
    graph.addEdge('design', 'implement');
    graph.addEdge('implement', 'test');
    graph.addEdge('test', 'review');
    graph.addEdge('review', END);

    return graph;
  }

  /**
   * Execute the code development workflow
   */
  async execute(input: WorkflowInput): Promise<WorkflowResult> {
    const startTime = Date.now();
    const sessionId = input.sessionId || randomUUID();

    // Initialize state
    const initialState: CodeDevelopmentState = {
      sessionId,
      currentStep: 'analyze',
      originalInput: input.requirements,
      outputs: {},
      requirements: input.requirements,
      language: input.language,
      framework: input.framework,
      metadata: {
        startTime: new Date().toISOString(),
        totalSteps: Object.keys(CODE_DEVELOPMENT_STEPS).length,
        completedSteps: [],
        failedSteps: [],
      },
    };

    try {
      // Compile and execute the graph
      const app = this.graph.compile();
      const finalState = await app.invoke(initialState) as CodeDevelopmentState;

      return {
        success: !finalState.error,
        state: finalState,
        duration: Date.now() - startTime,
        error: finalState.error?.message,
      };
    } catch (error) {
      return {
        success: false,
        state: {
          ...initialState,
          error: {
            step: 'execution',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            retryCount: 0,
          },
        },
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Analyze step: Analyze requirements and create project specification
   */
  private async analyzeStep(state: CodeDevelopmentState): Promise<Partial<CodeDevelopmentState>> {
    const stepName = 'analyze';
    console.log(`[Workflow ${state.sessionId}] Starting ${stepName} step`);

    try {
      const analysis = await this.retryHandler.executeWithRetry(
        async () => {
          const model = this.models.get('analyst');
          if (!model) throw new Error('Analyst model not initialized');

          const prompt = `As a senior software analyst, analyze the following requirements and provide a detailed specification:

Requirements: ${state.requirements}
Language: ${state.language || 'Not specified'}
Framework: ${state.framework || 'Not specified'}

Please analyze and provide:
1. Project complexity assessment (low/medium/high)
2. Estimated development hours
3. Technical risks and challenges
4. Required dependencies and tools
5. Implementation recommendations

Format your response as a structured analysis.`;

          const response = await model.invoke([{ role: 'user', content: prompt }]);
          
          // Parse the response into structured analysis
          return this.parseAnalysisResponse(response.content as string);
        },
        `${stepName} step for session ${state.sessionId}`
      );

      return {
        currentStep: 'design',
        analysis,
        metadata: {
          ...state.metadata,
          completedSteps: [...state.metadata.completedSteps, stepName],
        },
        outputs: {
          ...state.outputs,
          [stepName]: analysis,
        },
      };
    } catch (error) {
      return this.handleStepError(state, stepName, error as Error);
    }
  }

  /**
   * Design step: Create architectural design and technical specifications
   */
  private async designStep(state: CodeDevelopmentState): Promise<Partial<CodeDevelopmentState>> {
    const stepName = 'design';
    console.log(`[Workflow ${state.sessionId}] Starting ${stepName} step`);

    try {
      const design = await this.retryHandler.executeWithRetry(
        async () => {
          const model = this.models.get('architect');
          if (!model) throw new Error('Architect model not initialized');

          const prompt = `As a senior software architect, create a detailed technical design based on:

Requirements: ${state.requirements}
Analysis: ${JSON.stringify(state.analysis, null, 2)}
Language: ${state.language || 'TypeScript'}
Framework: ${state.framework || 'React/Node.js'}

Please provide:
1. System architecture overview
2. Component breakdown and responsibilities
3. Data model and database design
4. API design and endpoints
5. UI/UX design considerations

Format your response as a structured design document.`;

          const response = await model.invoke([{ role: 'user', content: prompt }]);
          
          return this.parseDesignResponse(response.content as string);
        },
        `${stepName} step for session ${state.sessionId}`
      );

      return {
        currentStep: 'implement',
        design,
        metadata: {
          ...state.metadata,
          completedSteps: [...state.metadata.completedSteps, stepName],
        },
        outputs: {
          ...state.outputs,
          [stepName]: design,
        },
      };
    } catch (error) {
      return this.handleStepError(state, stepName, error as Error);
    }
  }

  /**
   * Implementation step: Generate code based on design
   */
  private async implementStep(state: CodeDevelopmentState): Promise<Partial<CodeDevelopmentState>> {
    const stepName = 'implement';
    console.log(`[Workflow ${state.sessionId}] Starting ${stepName} step`);

    try {
      const implementation = await this.retryHandler.executeWithRetry(
        async () => {
          const model = this.models.get('developer');
          if (!model) throw new Error('Developer model not initialized');

          const prompt = `As a senior software developer, implement the following design:

Requirements: ${state.requirements}
Design: ${JSON.stringify(state.design, null, 2)}
Language: ${state.language || 'TypeScript'}
Framework: ${state.framework || 'React/Node.js'}

Please provide complete, production-ready code including:
1. Frontend components and logic
2. Backend API implementation
3. Database schema and migrations
4. Configuration files
5. Basic documentation

Ensure code follows best practices and includes proper error handling.`;

          const response = await model.invoke([{ role: 'user', content: prompt }]);
          
          return this.parseImplementationResponse(response.content as string);
        },
        `${stepName} step for session ${state.sessionId}`
      );

      return {
        currentStep: 'test',
        implementation,
        metadata: {
          ...state.metadata,
          completedSteps: [...state.metadata.completedSteps, stepName],
        },
        outputs: {
          ...state.outputs,
          [stepName]: implementation,
        },
      };
    } catch (error) {
      return this.handleStepError(state, stepName, error as Error);
    }
  }

  /**
   * Testing step: Create comprehensive test suite
   */
  private async testStep(state: CodeDevelopmentState): Promise<Partial<CodeDevelopmentState>> {
    const stepName = 'test';
    console.log(`[Workflow ${state.sessionId}] Starting ${stepName} step`);

    try {
      const testing = await this.retryHandler.executeWithRetry(
        async () => {
          const model = this.models.get('tester');
          if (!model) throw new Error('Tester model not initialized');

          const prompt = `As a senior QA engineer, create comprehensive tests for:

Implementation: ${JSON.stringify(state.implementation, null, 2)}
Language: ${state.language || 'TypeScript'}
Framework: ${state.framework || 'React/Node.js'}

Please provide:
1. Unit tests for all major functions
2. Integration tests for API endpoints
3. End-to-end tests for user workflows
4. Test coverage analysis
5. Performance and load testing recommendations

Use appropriate testing frameworks and follow testing best practices.`;

          const response = await model.invoke([{ role: 'user', content: prompt }]);
          
          return this.parseTestingResponse(response.content as string);
        },
        `${stepName} step for session ${state.sessionId}`
      );

      return {
        currentStep: 'review',
        testing,
        metadata: {
          ...state.metadata,
          completedSteps: [...state.metadata.completedSteps, stepName],
        },
        outputs: {
          ...state.outputs,
          [stepName]: testing,
        },
      };
    } catch (error) {
      return this.handleStepError(state, stepName, error as Error);
    }
  }

  /**
   * Review step: Final code review and deployment preparation
   */
  private async reviewStep(state: CodeDevelopmentState): Promise<Partial<CodeDevelopmentState>> {
    const stepName = 'review';
    console.log(`[Workflow ${state.sessionId}] Starting ${stepName} step`);

    try {
      const review = await this.retryHandler.executeWithRetry(
        async () => {
          const model = this.models.get('reviewer');
          if (!model) throw new Error('Reviewer model not initialized');

          const prompt = `As a senior code reviewer, perform a comprehensive review of:

Implementation: ${JSON.stringify(state.implementation, null, 2)}
Tests: ${JSON.stringify(state.testing, null, 2)}

Please provide:
1. Code quality assessment and improvements
2. Security audit and vulnerability analysis
3. Performance optimization recommendations
4. Deployment readiness checklist
5. Final recommendations and next steps

Ensure the code is production-ready and follows industry best practices.`;

          const response = await model.invoke([{ role: 'user', content: prompt }]);
          
          return this.parseReviewResponse(response.content as string);
        },
        `${stepName} step for session ${state.sessionId}`
      );

      return {
        currentStep: 'completed',
        review,
        metadata: {
          ...state.metadata,
          completedSteps: [...state.metadata.completedSteps, stepName],
          endTime: new Date().toISOString(),
        },
        outputs: {
          ...state.outputs,
          [stepName]: review,
        },
      };
    } catch (error) {
      return this.handleStepError(state, stepName, error as Error);
    }
  }

  /**
   * Handle step errors with retry logic
   */
  private handleStepError(
    state: CodeDevelopmentState,
    stepName: string,
    error: Error
  ): Partial<CodeDevelopmentState> {
    const currentRetryCount = state.error?.retryCount || 0;
    
    return {
      error: {
        step: stepName,
        message: error.message,
        retryCount: currentRetryCount + 1,
      },
      metadata: {
        ...state.metadata,
        failedSteps: [...state.metadata.failedSteps, stepName],
      },
    };
  }

  /**
   * Parse analysis response into structured format
   */
  private parseAnalysisResponse(response: string): any {
    // Simple parsing - in production, this could use structured output
    return {
      complexity: this.extractComplexity(response),
      estimatedHours: this.extractEstimatedHours(response),
      risks: this.extractRisks(response),
      dependencies: this.extractDependencies(response),
      recommendations: this.extractRecommendations(response),
      rawResponse: response,
    };
  }

  /**
   * Parse design response into structured format
   */
  private parseDesignResponse(response: string): any {
    return {
      architecture: response,
      components: [],
      dataModel: '',
      apiDesign: '',
      rawResponse: response,
    };
  }

  /**
   * Parse implementation response into structured format
   */
  private parseImplementationResponse(response: string): any {
    return {
      frontendCode: response,
      backendCode: '',
      database: '',
      configuration: '',
      documentation: '',
      rawResponse: response,
    };
  }

  /**
   * Parse testing response into structured format
   */
  private parseTestingResponse(response: string): any {
    return {
      unitTests: response,
      integrationTests: '',
      e2eTests: '',
      coverageReport: '',
      testResults: '',
      rawResponse: response,
    };
  }

  /**
   * Parse review response into structured format
   */
  private parseReviewResponse(response: string): any {
    return {
      codeQuality: response,
      securityAudit: '',
      performanceAnalysis: '',
      improvements: [],
      deployment: '',
      rawResponse: response,
    };
  }

  // Helper methods for parsing responses
  private extractComplexity(response: string): 'low' | 'medium' | 'high' {
    const lower = response.toLowerCase();
    if (lower.includes('high complexity') || lower.includes('complex')) return 'high';
    if (lower.includes('medium complexity') || lower.includes('moderate')) return 'medium';
    return 'low';
  }

  private extractEstimatedHours(response: string): number {
    const match = response.match(/(\d+)\s*hours?/i);
    return match ? parseInt(match[1]) : 40;
  }

  private extractRisks(response: string): string[] {
    // Simple risk extraction - could be enhanced with better parsing
    return ['Basic implementation risks identified'];
  }

  private extractDependencies(response: string): string[] {
    return ['Standard framework dependencies'];
  }

  private extractRecommendations(response: string): string[] {
    return ['Follow best practices', 'Implement proper testing'];
  }
}

/**
 * Factory function to create workflow instances
 */
export function createCodeDevelopmentWorkflow(config?: Partial<WorkflowConfig>): CodeDevelopmentWorkflow {
  return new CodeDevelopmentWorkflow(config);
}

export default CodeDevelopmentWorkflow;