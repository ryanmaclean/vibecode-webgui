/**
 * Workflow Engine Usage Examples
 * Demonstrates various workflow patterns and integrations
 */

import {
  executeWorkflowTemplate,
  executeWorkflowFromYAML,
  createWorkflowEngine,
  registerAgentExecutor,
  WorkflowEngine,
} from '@/lib/workflow';
import type {
  WorkflowDefinition,
  AgentTaskConfig,
  WorkflowContext,
  WorkflowExecution,
} from '@/lib/workflow/types';
import { createAgentExecutor, createWorkflowMonitor } from '@/lib/workflow/integration';

// ============================================================================
// Example 1: Execute Pre-built Template
// ============================================================================

async function example1_executeTemplate() {
  console.log('Example 1: Execute Code Review Template');

  const execution = await executeWorkflowTemplate('code-review', {
    workspace: '/home/coder/workspace/my-project',
    files: ['src/main.ts', 'src/utils.ts'],
  });

  console.log('Workflow Status:', execution.status);
  console.log('Completed Nodes:', execution.nodes.size);
  console.log('Duration:', execution.metadata.duration, 'ms');

  return execution;
}

// ============================================================================
// Example 2: Execute from YAML
// ============================================================================

async function example2_executeYAML() {
  console.log('Example 2: Execute from YAML');

  const yamlWorkflow = `
name: custom-pipeline
version: 1.0.0
description: Custom CI/CD pipeline

inputs:
  workspace:
    type: string
    required: true
  branch:
    type: string
    default: main

nodes:
  - id: lint
    type: agent-task
    name: Lint Code
    config:
      agentType: cline
      model: claude-3-5-sonnet-20241022
      task: "Run linter on codebase"
      workspace: \${input.workspace}

  - id: test
    type: agent-task
    name: Run Tests
    config:
      agentType: continue
      model: gpt-4o
      task: "Execute test suite"
      workspace: \${input.workspace}

  - id: build
    type: agent-task
    name: Build Project
    config:
      agentType: aider
      model: claude-3-5-sonnet-20241022
      task: "Build production bundle"
      workspace: \${input.workspace}

edges:
  - source: lint
    target: test
  - source: test
    target: build
`;

  const execution = await executeWorkflowFromYAML(yamlWorkflow, {
    workspace: '/home/coder/workspace/my-project',
    branch: 'develop',
  });

  console.log('Pipeline completed:', execution.status);
  return execution;
}

// ============================================================================
// Example 3: Programmatic Workflow with Parallel Execution
// ============================================================================

async function example3_parallelExecution() {
  console.log('Example 3: Parallel Execution');

  const workflow: WorkflowDefinition = {
    name: 'parallel-analysis',
    version: '1.0.0',
    description: 'Analyze multiple modules in parallel',

    nodes: [
      // Analyze frontend
      {
        id: 'analyze-frontend',
        type: 'agent-task',
        name: 'Analyze Frontend',
        config: {
          agentType: 'cline',
          model: 'claude-3-5-sonnet-20241022',
          task: 'Analyze frontend code quality',
          workspace: '/home/coder/workspace',
          files: ['src/components/**/*.tsx'],
        },
      },

      // Analyze backend (parallel)
      {
        id: 'analyze-backend',
        type: 'agent-task',
        name: 'Analyze Backend',
        config: {
          agentType: 'cline',
          model: 'claude-3-5-sonnet-20241022',
          task: 'Analyze backend code quality',
          workspace: '/home/coder/workspace',
          files: ['src/api/**/*.ts'],
        },
      },

      // Analyze tests (parallel)
      {
        id: 'analyze-tests',
        type: 'agent-task',
        name: 'Analyze Tests',
        config: {
          agentType: 'cline',
          model: 'claude-3-5-sonnet-20241022',
          task: 'Analyze test coverage',
          workspace: '/home/coder/workspace',
          files: ['tests/**/*.test.ts'],
        },
      },

      // Merge results
      {
        id: 'merge-results',
        type: 'merge',
        name: 'Merge Analysis',
        config: {
          strategy: 'all',
        },
      },

      // Generate report
      {
        id: 'generate-report',
        type: 'transform',
        name: 'Generate Report',
        config: {
          transform: `{
            frontend: nodes['analyze-frontend'].output,
            backend: nodes['analyze-backend'].output,
            tests: nodes['analyze-tests'].output,
            timestamp: new Date().toISOString()
          }`,
        },
      },
    ],

    edges: [
      { id: 'e1', source: 'analyze-frontend', target: 'merge-results' },
      { id: 'e2', source: 'analyze-backend', target: 'merge-results' },
      { id: 'e3', source: 'analyze-tests', target: 'merge-results' },
      { id: 'e4', source: 'merge-results', target: 'generate-report' },
    ],

    config: {
      maxConcurrency: 3, // Run all 3 analysis tasks in parallel
      timeout: 600000, // 10 minutes
    },
  };

  const engine = createWorkflowEngine();

  // Register mock agent executor for example
  engine.registerAgentExecutor(async (config: AgentTaskConfig) => {
    console.log(`Executing agent task: ${config.task}`);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
    return { issues: [], quality: 'good' };
  });

  const execution = await engine.executeWorkflow(workflow, {});

  console.log('Analysis completed:', execution.status);
  console.log('Report:', execution.context.nodes['generate-report']);

  return execution;
}

// ============================================================================
// Example 4: Conditional Workflow
// ============================================================================

async function example4_conditionalWorkflow() {
  console.log('Example 4: Conditional Workflow');

  const workflow: WorkflowDefinition = {
    name: 'conditional-deployment',
    version: '1.0.0',

    nodes: [
      {
        id: 'run-tests',
        type: 'agent-task',
        name: 'Run Tests',
        config: {
          agentType: 'continue',
          model: 'gpt-4o',
          task: 'Run all tests',
        },
      },

      {
        id: 'check-tests',
        type: 'condition',
        name: 'Check Test Results',
        config: {
          expression: 'nodes["run-tests"].output.passed === true',
          branches: [
            {
              name: 'tests-passed',
              condition: 'true',
              target: 'deploy',
            },
            {
              name: 'tests-failed',
              condition: 'false',
              target: 'notify-failure',
            },
          ],
        },
      },

      {
        id: 'deploy',
        type: 'webhook',
        name: 'Deploy to Production',
        config: {
          url: 'https://deploy.example.com/trigger',
          method: 'POST',
          body: '{"environment": "production"}',
        },
      },

      {
        id: 'notify-failure',
        type: 'webhook',
        name: 'Notify Team',
        config: {
          url: 'https://slack.example.com/webhook',
          method: 'POST',
          body: '{"text": "Tests failed, deployment cancelled"}',
        },
      },
    ],

    edges: [
      { id: 'e1', source: 'run-tests', target: 'check-tests' },
      {
        id: 'e2',
        source: 'check-tests',
        target: 'deploy',
        condition: 'tests-passed',
      },
      {
        id: 'e3',
        source: 'check-tests',
        target: 'notify-failure',
        condition: 'tests-failed',
      },
    ],
  };

  const engine = createWorkflowEngine();
  const execution = await engine.executeWorkflow(workflow, {});

  return execution;
}

// ============================================================================
// Example 5: Loop Workflow
// ============================================================================

async function example5_loopWorkflow() {
  console.log('Example 5: Loop Workflow');

  const workflow: WorkflowDefinition = {
    name: 'batch-processing',
    version: '1.0.0',

    inputs: {
      files: {
        type: 'array',
        required: true,
      },
    },

    nodes: [
      {
        id: 'process-files',
        type: 'loop',
        name: 'Process Each File',
        config: {
          items: 'input.files',
          itemVar: 'file',
          indexVar: 'i',
          maxIterations: 50,
        },
      },

      {
        id: 'process-single-file',
        type: 'agent-task',
        name: 'Process File',
        config: {
          agentType: 'aider',
          model: 'claude-3-5-sonnet-20241022',
          task: 'Refactor file: ${loops["process-files"].item}',
        },
      },
    ],

    edges: [
      { id: 'e1', source: 'process-files', target: 'process-single-file' },
    ],
  };

  const engine = createWorkflowEngine();

  const execution = await engine.executeWorkflow(workflow, {
    files: ['file1.ts', 'file2.ts', 'file3.ts'],
  });

  return execution;
}

// ============================================================================
// Example 6: Full Integration with Monitoring
// ============================================================================

async function example6_fullIntegration() {
  console.log('Example 6: Full Integration');

  // Mock clients
  const agentAPIClient = {
    async startAgent(request: any) {
      return {
        agent_id: 'agent-123',
        status: 'running',
        terminal_id: 'term-123',
        created_at: new Date().toISOString(),
      };
    },
    async getAgentStatus(agentId: string) {
      return {
        agent_id: agentId,
        status: 'completed',
        last_output: 'Task completed successfully',
        exit_code: 0,
      };
    },
    async sendMessage() {},
    async stopAgent() {},
  };

  const metricsClient = {
    increment: (metric: string, tags: any) => {
      console.log('Metric:', metric, tags);
    },
    histogram: (metric: string, value: number, tags: any) => {
      console.log('Histogram:', metric, value, tags);
    },
    gauge: (metric: string, value: number, tags: any) => {
      console.log('Gauge:', metric, value, tags);
    },
  };

  // Create engine with integrations
  const engine = createWorkflowEngine();

  // Register agent executor
  const executor = createAgentExecutor(agentAPIClient);
  engine.registerAgentExecutor(executor);

  // Setup monitoring
  const monitor = createWorkflowMonitor(metricsClient);

  engine.on('event', (event: any) => {
    console.log('Workflow Event:', event.type, event.data);

    switch (event.type) {
      case 'workflow.started':
        monitor.trackWorkflowStart(event.data.workflowId, event.data.workflowVersion);
        break;
      case 'workflow.completed':
        monitor.trackWorkflowComplete(
          event.data.workflowId,
          event.data.workflowVersion,
          event.data.duration,
          event.data.nodeCount
        );
        break;
      case 'workflow.failed':
        monitor.trackWorkflowFailed(
          event.data.workflowId,
          event.data.workflowVersion,
          event.data.error?.code || 'unknown'
        );
        break;
    }
  });

  // Execute workflow
  const execution = await executeWorkflowTemplate('bug-fix', {
    workspace: '/home/coder/workspace',
    bugDescription: 'Fix authentication error',
  });

  console.log('Execution completed with monitoring');
  return execution;
}

// ============================================================================
// Example 7: Checkpoint and Resume
// ============================================================================

async function example7_checkpointResume() {
  console.log('Example 7: Checkpoint and Resume');

  const workflow: WorkflowDefinition = {
    name: 'long-running-workflow',
    version: '1.0.0',

    nodes: [
      { id: 'step1', type: 'delay', name: 'Step 1', config: { duration: 1000 } },
      { id: 'step2', type: 'delay', name: 'Step 2', config: { duration: 1000 } },
      { id: 'step3', type: 'delay', name: 'Step 3', config: { duration: 1000 } },
    ],

    edges: [
      { id: 'e1', source: 'step1', target: 'step2' },
      { id: 'e2', source: 'step2', target: 'step3' },
    ],

    config: {
      enableCheckpoints: true,
      checkpointInterval: 500, // Create checkpoint every 500ms
    },
  };

  const engine = createWorkflowEngine();

  // Start execution
  const execution = await engine.executeWorkflow(workflow, {});

  // Simulate resume from checkpoint
  if (execution.checkpoints.length > 0) {
    const checkpointId = execution.checkpoints[0].id;
    console.log('Resuming from checkpoint:', checkpointId);

    const resumed = await engine.resumeExecution(execution.id, checkpointId);
    console.log('Resumed execution:', resumed.status);
  }

  return execution;
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  console.log('='.repeat(80));
  console.log('Workflow Engine Usage Examples');
  console.log('='.repeat(80));

  try {
    // Run examples (comment out to run individually)
    // await example1_executeTemplate();
    // await example2_executeYAML();
    await example3_parallelExecution();
    // await example4_conditionalWorkflow();
    // await example5_loopWorkflow();
    // await example6_fullIntegration();
    // await example7_checkpointResume();

    console.log('\nAll examples completed successfully!');
  } catch (error) {
    console.error('Example failed:', error);
    throw error;
  }
}

// Export for use in other modules
export {
  example1_executeTemplate,
  example2_executeYAML,
  example3_parallelExecution,
  example4_conditionalWorkflow,
  example5_loopWorkflow,
  example6_fullIntegration,
  example7_checkpointResume,
  runAllExamples,
};

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
