/**
 * Built-in Workflow Templates
 * Pre-configured workflows for common multi-agent scenarios
 */

import type { WorkflowDefinition } from './types';

/**
 * Code Review Workflow
 * Claude analyze → Aider fix → Continue test
 */
export const codeReviewWorkflow: WorkflowDefinition = {
  name: 'code-review',
  version: '1.0.0',
  description: 'Automated code review with AI agents',
  tags: ['code-review', 'testing', 'quality'],

  inputs: {
    files: {
      type: 'array',
      required: true,
      description: 'Files to review',
    },
    workspace: {
      type: 'string',
      required: true,
      description: 'Workspace path',
    },
  },

  nodes: [
    {
      id: 'analyze',
      type: 'agent-task',
      name: 'Analyze Code',
      description: 'Use Claude to analyze code quality',
      config: {
        agentType: 'cline',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Analyze code quality, identify issues, and suggest improvements for: ${input.files}',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 100 },
    },
    {
      id: 'check-issues',
      type: 'condition',
      name: 'Check Issues Found',
      description: 'Determine if fixes are needed',
      config: {
        expression: 'nodes.analyze.issues && nodes.analyze.issues.length > 0',
        branches: [
          {
            name: 'has-issues',
            condition: 'true',
            target: 'fix-issues',
          },
          {
            name: 'no-issues',
            condition: 'false',
            target: 'complete',
          },
        ],
      },
      position: { x: 100, y: 200 },
    },
    {
      id: 'fix-issues',
      type: 'agent-task',
      name: 'Fix Issues',
      description: 'Use Aider to apply fixes',
      config: {
        agentType: 'aider',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Fix the following issues: ${nodes.analyze.issues}',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 300 },
    },
    {
      id: 'run-tests',
      type: 'agent-task',
      name: 'Run Tests',
      description: 'Use Continue to run tests',
      config: {
        agentType: 'continue',
        model: 'gpt-4o',
        task: 'Run all tests for the modified files',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 400 },
    },
    {
      id: 'complete',
      type: 'transform',
      name: 'Complete',
      description: 'Format final results',
      config: {
        transform: `{
          status: nodes.analyze.issues?.length > 0 ? 'fixed' : 'passed',
          issues: nodes.analyze.issues || [],
          testsRun: nodes['run-tests']?.output || false
        }`,
      },
      position: { x: 100, y: 500 },
    },
  ],

  edges: [
    { id: 'e1', source: 'analyze', target: 'check-issues' },
    { id: 'e2', source: 'check-issues', target: 'fix-issues', condition: 'has-issues' },
    { id: 'e3', source: 'check-issues', target: 'complete', condition: 'no-issues' },
    { id: 'e4', source: 'fix-issues', target: 'run-tests' },
    { id: 'e5', source: 'run-tests', target: 'complete' },
  ],

  config: {
    timeout: 600000, // 10 minutes
    maxConcurrency: 3,
    errorHandling: 'fail-fast',
  },
};

/**
 * Parallel Refactoring Workflow
 * Multiple agents working on different parts simultaneously
 */
export const parallelRefactoringWorkflow: WorkflowDefinition = {
  name: 'parallel-refactoring',
  version: '1.0.0',
  description: 'Parallel refactoring with multiple agents',
  tags: ['refactoring', 'parallel', 'performance'],

  inputs: {
    workspace: {
      type: 'string',
      required: true,
    },
    modules: {
      type: 'array',
      required: true,
      description: 'Modules to refactor',
    },
  },

  nodes: [
    {
      id: 'analyze-architecture',
      type: 'agent-task',
      name: 'Analyze Architecture',
      config: {
        agentType: 'cline',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Analyze overall architecture and create refactoring plan for: ${input.modules}',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 100 },
    },
    {
      id: 'parallel-refactor',
      type: 'parallel',
      name: 'Parallel Refactoring',
      config: {
        maxConcurrency: 5,
        waitForAll: true,
        failFast: false,
      },
      position: { x: 100, y: 200 },
    },
    {
      id: 'refactor-module-1',
      type: 'agent-task',
      name: 'Refactor Module 1',
      config: {
        agentType: 'aider',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Refactor module: ${input.modules[0]}',
        workspace: '${input.workspace}',
      },
      position: { x: 50, y: 300 },
    },
    {
      id: 'refactor-module-2',
      type: 'agent-task',
      name: 'Refactor Module 2',
      config: {
        agentType: 'aider',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Refactor module: ${input.modules[1]}',
        workspace: '${input.workspace}',
      },
      position: { x: 150, y: 300 },
    },
    {
      id: 'refactor-module-3',
      type: 'agent-task',
      name: 'Refactor Module 3',
      config: {
        agentType: 'goose',
        model: 'gpt-4o',
        task: 'Refactor module: ${input.modules[2]}',
        workspace: '${input.workspace}',
      },
      position: { x: 250, y: 300 },
    },
    {
      id: 'merge-changes',
      type: 'merge',
      name: 'Merge Changes',
      config: {
        strategy: 'all',
      },
      position: { x: 100, y: 400 },
    },
    {
      id: 'integration-test',
      type: 'agent-task',
      name: 'Integration Test',
      config: {
        agentType: 'continue',
        model: 'gpt-4o',
        task: 'Run integration tests for all refactored modules',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 500 },
    },
  ],

  edges: [
    { id: 'e1', source: 'analyze-architecture', target: 'parallel-refactor' },
    { id: 'e2', source: 'parallel-refactor', target: 'refactor-module-1' },
    { id: 'e3', source: 'parallel-refactor', target: 'refactor-module-2' },
    { id: 'e4', source: 'parallel-refactor', target: 'refactor-module-3' },
    { id: 'e5', source: 'refactor-module-1', target: 'merge-changes' },
    { id: 'e6', source: 'refactor-module-2', target: 'merge-changes' },
    { id: 'e7', source: 'refactor-module-3', target: 'merge-changes' },
    { id: 'e8', source: 'merge-changes', target: 'integration-test' },
  ],

  config: {
    maxConcurrency: 5,
    enableCheckpoints: true,
    checkpointInterval: 60000,
  },
};

/**
 * Documentation Workflow
 * Multi-agent documentation synthesis
 */
export const documentationWorkflow: WorkflowDefinition = {
  name: 'documentation-synthesis',
  version: '1.0.0',
  description: 'Generate comprehensive documentation using multiple agents',
  tags: ['documentation', 'synthesis'],

  inputs: {
    workspace: {
      type: 'string',
      required: true,
    },
    scope: {
      type: 'string',
      required: true,
      description: 'Documentation scope (api, architecture, user-guide)',
    },
  },

  nodes: [
    {
      id: 'analyze-codebase',
      type: 'agent-task',
      name: 'Analyze Codebase',
      config: {
        agentType: 'cline',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Analyze codebase structure and identify components for ${input.scope} documentation',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 100 },
    },
    {
      id: 'generate-api-docs',
      type: 'agent-task',
      name: 'Generate API Docs',
      config: {
        agentType: 'aider',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Generate API documentation based on analysis',
        workspace: '${input.workspace}',
      },
      position: { x: 50, y: 200 },
    },
    {
      id: 'generate-examples',
      type: 'agent-task',
      name: 'Generate Examples',
      config: {
        agentType: 'continue',
        model: 'gpt-4o',
        task: 'Create code examples for documentation',
        workspace: '${input.workspace}',
      },
      position: { x: 150, y: 200 },
    },
    {
      id: 'synthesize-docs',
      type: 'agent-task',
      name: 'Synthesize Documentation',
      config: {
        agentType: 'cline',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Combine API docs and examples into comprehensive documentation',
        workspace: '${input.workspace}',
        inputs: {
          apiDocs: 'nodes.generate-api-docs.output',
          examples: 'nodes.generate-examples.output',
        },
      },
      position: { x: 100, y: 300 },
    },
  ],

  edges: [
    { id: 'e1', source: 'analyze-codebase', target: 'generate-api-docs' },
    { id: 'e2', source: 'analyze-codebase', target: 'generate-examples' },
    { id: 'e3', source: 'generate-api-docs', target: 'synthesize-docs' },
    { id: 'e4', source: 'generate-examples', target: 'synthesize-docs' },
  ],
};

/**
 * Feature Development Workflow
 * End-to-end feature implementation
 */
export const featureDevelopmentWorkflow: WorkflowDefinition = {
  name: 'feature-development',
  version: '1.0.0',
  description: 'Complete feature development with testing',
  tags: ['development', 'testing', 'deployment'],

  inputs: {
    workspace: {
      type: 'string',
      required: true,
    },
    featureSpec: {
      type: 'string',
      required: true,
      description: 'Feature specification',
    },
  },

  nodes: [
    {
      id: 'design-feature',
      type: 'agent-task',
      name: 'Design Feature',
      config: {
        agentType: 'cline',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Design architecture for: ${input.featureSpec}',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 100 },
    },
    {
      id: 'implement-backend',
      type: 'agent-task',
      name: 'Implement Backend',
      config: {
        agentType: 'aider',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Implement backend based on design',
        workspace: '${input.workspace}',
      },
      position: { x: 50, y: 200 },
    },
    {
      id: 'implement-frontend',
      type: 'agent-task',
      name: 'Implement Frontend',
      config: {
        agentType: 'aider',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Implement frontend based on design',
        workspace: '${input.workspace}',
      },
      position: { x: 150, y: 200 },
    },
    {
      id: 'write-tests',
      type: 'agent-task',
      name: 'Write Tests',
      config: {
        agentType: 'continue',
        model: 'gpt-4o',
        task: 'Write unit and integration tests',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 300 },
    },
    {
      id: 'run-tests',
      type: 'agent-task',
      name: 'Run Tests',
      config: {
        agentType: 'continue',
        model: 'gpt-4o',
        task: 'Execute all tests and verify',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 400 },
    },
    {
      id: 'check-tests',
      type: 'condition',
      name: 'Check Tests',
      config: {
        expression: 'nodes["run-tests"].output.passed === true',
        branches: [
          {
            name: 'passed',
            condition: 'true',
            target: 'complete',
          },
          {
            name: 'failed',
            condition: 'false',
            target: 'fix-issues',
          },
        ],
      },
      position: { x: 100, y: 500 },
    },
    {
      id: 'fix-issues',
      type: 'agent-task',
      name: 'Fix Issues',
      config: {
        agentType: 'aider',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Fix test failures: ${nodes["run-tests"].output.failures}',
        workspace: '${input.workspace}',
      },
      position: { x: 200, y: 600 },
    },
    {
      id: 'complete',
      type: 'transform',
      name: 'Complete',
      config: {
        transform: '{ status: "ready", feature: input.featureSpec }',
      },
      position: { x: 100, y: 700 },
    },
  ],

  edges: [
    { id: 'e1', source: 'design-feature', target: 'implement-backend' },
    { id: 'e2', source: 'design-feature', target: 'implement-frontend' },
    { id: 'e3', source: 'implement-backend', target: 'write-tests' },
    { id: 'e4', source: 'implement-frontend', target: 'write-tests' },
    { id: 'e5', source: 'write-tests', target: 'run-tests' },
    { id: 'e6', source: 'run-tests', target: 'check-tests' },
    { id: 'e7', source: 'check-tests', target: 'complete', condition: 'passed' },
    { id: 'e8', source: 'check-tests', target: 'fix-issues', condition: 'failed' },
    { id: 'e9', source: 'fix-issues', target: 'run-tests' },
  ],

  config: {
    timeout: 1800000, // 30 minutes
    enableCheckpoints: true,
    retryPolicy: {
      maxAttempts: 3,
      delay: 5000,
      backoff: 'exponential',
    },
  },
};

/**
 * Bug Fix Workflow
 * Automated bug investigation and fixing
 */
export const bugFixWorkflow: WorkflowDefinition = {
  name: 'bug-fix',
  version: '1.0.0',
  description: 'Investigate and fix bugs automatically',
  tags: ['bug-fix', 'debugging', 'testing'],

  inputs: {
    workspace: {
      type: 'string',
      required: true,
    },
    bugDescription: {
      type: 'string',
      required: true,
    },
  },

  nodes: [
    {
      id: 'investigate',
      type: 'agent-task',
      name: 'Investigate Bug',
      config: {
        agentType: 'cline',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Investigate bug: ${input.bugDescription}',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 100 },
    },
    {
      id: 'create-fix',
      type: 'agent-task',
      name: 'Create Fix',
      config: {
        agentType: 'aider',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Fix bug based on investigation: ${nodes.investigate.output}',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 200 },
    },
    {
      id: 'verify-fix',
      type: 'agent-task',
      name: 'Verify Fix',
      config: {
        agentType: 'continue',
        model: 'gpt-4o',
        task: 'Verify bug is fixed and run tests',
        workspace: '${input.workspace}',
      },
      position: { x: 100, y: 300 },
    },
  ],

  edges: [
    { id: 'e1', source: 'investigate', target: 'create-fix' },
    { id: 'e2', source: 'create-fix', target: 'verify-fix' },
  ],
};

/**
 * Get all available workflow templates
 */
export const workflowTemplates = {
  'code-review': codeReviewWorkflow,
  'parallel-refactoring': parallelRefactoringWorkflow,
  'documentation': documentationWorkflow,
  'feature-development': featureDevelopmentWorkflow,
  'bug-fix': bugFixWorkflow,
};

/**
 * Get workflow template by name
 */
export function getWorkflowTemplate(name: string): WorkflowDefinition | undefined {
  return workflowTemplates[name as keyof typeof workflowTemplates];
}

/**
 * List all available templates
 */
export function listWorkflowTemplates(): Array<{ name: string; description: string; tags: string[] }> {
  return Object.entries(workflowTemplates).map(([name, workflow]) => ({
    name,
    description: workflow.description || '',
    tags: workflow.tags || [],
  }));
}
