import { z } from 'zod';

/**
 * Base state interface for all LangGraph workflows
 */
export interface BaseWorkflowState {
  /** Unique identifier for the workflow execution */
  sessionId: string;
  /** Current step in the workflow */
  currentStep: string;
  /** Input that started the workflow */
  originalInput: string;
  /** Collected outputs from each step */
  outputs: Record<string, any>;
  /** Error information if any step fails */
  error?: {
    step: string;
    message: string;
    retryCount: number;
  };
  /** Metadata about the workflow execution */
  metadata: {
    startTime: string;
    endTime?: string;
    totalSteps: number;
    completedSteps: string[];
    failedSteps: string[];
  };
}

/**
 * State for the code development workflow
 * Follows: analyze → design → implement → test → review flow
 */
export interface CodeDevelopmentState extends BaseWorkflowState {
  /** Requirements and specifications */
  requirements: string;
  /** Language and framework preferences */
  language?: string;
  framework?: string;
  /** Analysis phase outputs */
  analysis?: {
    complexity: 'low' | 'medium' | 'high';
    estimatedHours: number;
    risks: string[];
    dependencies: string[];
    recommendations: string[];
  };
  /** Design phase outputs */
  design?: {
    architecture: string;
    components: string[];
    dataModel: string;
    apiDesign: string;
    uiMockups?: string;
  };
  /** Implementation phase outputs */
  implementation?: {
    frontendCode: string;
    backendCode: string;
    database: string;
    configuration: string;
    documentation: string;
  };
  /** Testing phase outputs */
  testing?: {
    unitTests: string;
    integrationTests: string;
    e2eTests: string;
    coverageReport: string;
    testResults: string;
  };
  /** Review phase outputs */
  review?: {
    codeQuality: string;
    securityAudit: string;
    performanceAnalysis: string;
    improvements: string[];
    deployment: string;
  };
}

/**
 * Schema for validating workflow inputs
 */
export const WorkflowInputSchema = z.object({
  requirements: z.string().min(10, 'Requirements must be at least 10 characters'),
  language: z.string().optional(),
  framework: z.string().optional(),
  sessionId: z.string().optional(),
});

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

/**
 * Configuration for workflow execution
 */
export interface WorkflowConfig {
  /** Maximum number of retries per step */
  maxRetries: number;
  /** Timeout for each step in milliseconds */
  stepTimeout: number;
  /** Whether to enable debug logging */
  debug: boolean;
  /** Whether to persist state between steps */
  persistState: boolean;
  /** Custom agent configurations */
  agentConfigs?: Record<string, {
    model: string;
    temperature: number;
    maxTokens?: number;
  }>;
}

/**
 * Default workflow configuration
 */
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxRetries: 3,
  stepTimeout: 300000, // 5 minutes
  debug: false,
  persistState: true,
  agentConfigs: {
    analyst: { model: 'gpt-4', temperature: 0.1 },
    architect: { model: 'gpt-4', temperature: 0.1 },
    developer: { model: 'gpt-4', temperature: 0.2 },
    tester: { model: 'gpt-4', temperature: 0.2 },
    reviewer: { model: 'gpt-4', temperature: 0.1 },
  },
};

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  success: boolean;
  state: CodeDevelopmentState;
  duration: number;
  error?: string;
}

/**
 * Workflow step definition
 */
export interface WorkflowStepDefinition {
  name: string;
  description: string;
  agent: string;
  dependencies: string[];
  retryable: boolean;
  timeout?: number;
}

/**
 * Available workflow steps for code development
 */
export const CODE_DEVELOPMENT_STEPS: Record<string, WorkflowStepDefinition> = {
  analyze: {
    name: 'analyze',
    description: 'Analyze requirements and create project specification',
    agent: 'analyst',
    dependencies: [],
    retryable: true,
  },
  design: {
    name: 'design',
    description: 'Create architectural design and technical specifications',
    agent: 'architect',
    dependencies: ['analyze'],
    retryable: true,
  },
  implement: {
    name: 'implement',
    description: 'Generate code implementation based on design',
    agent: 'developer',
    dependencies: ['design'],
    retryable: true,
  },
  test: {
    name: 'test',
    description: 'Create comprehensive test suite',
    agent: 'tester',
    dependencies: ['implement'],
    retryable: true,
  },
  review: {
    name: 'review',
    description: 'Review code quality, security, and deployment readiness',
    agent: 'reviewer',
    dependencies: ['test'],
    retryable: true,
  },
};