import { describe, test, expect, beforeEach } from '@jest/globals';
import { CodeDevelopmentWorkflow, createCodeDevelopmentWorkflow } from '../../../src/lib/ai/workflows/code-development-workflow';
import { WorkflowInput } from '../../../src/lib/ai/workflows/workflow-state';

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-key';

describe('LangGraph Workflow System', () => {
  let workflow: CodeDevelopmentWorkflow;

  beforeEach(() => {
    workflow = createCodeDevelopmentWorkflow({
      debug: true,
      maxRetries: 1,
      stepTimeout: 10000, // 10 seconds for tests
    });
  });

  test('should create workflow instance', () => {
    expect(workflow).toBeDefined();
    expect(workflow).toBeInstanceOf(CodeDevelopmentWorkflow);
  });

  test('should validate workflow input schema', () => {
    const validInput: WorkflowInput = {
      requirements: 'Create a simple React todo app',
      language: 'TypeScript',
      framework: 'React',
    };

    expect(() => {
      const { WorkflowInputSchema } = require('../../../src/lib/ai/workflows/workflow-state');
      WorkflowInputSchema.parse(validInput);
    }).not.toThrow();
  });

  test('should reject invalid workflow input', () => {
    const invalidInput = {
      requirements: 'too short', // Less than 10 characters
    };

    expect(() => {
      const { WorkflowInputSchema } = require('../../../src/lib/ai/workflows/workflow-state');
      WorkflowInputSchema.parse(invalidInput);
    }).toThrow();
  });

  test('should create workflow step definitions', () => {
    const { CODE_DEVELOPMENT_STEPS } = require('../../../src/lib/ai/workflows/workflow-state');
    
    expect(CODE_DEVELOPMENT_STEPS).toBeDefined();
    expect(CODE_DEVELOPMENT_STEPS.analyze).toBeDefined();
    expect(CODE_DEVELOPMENT_STEPS.design).toBeDefined();
    expect(CODE_DEVELOPMENT_STEPS.implement).toBeDefined();
    expect(CODE_DEVELOPMENT_STEPS.test).toBeDefined();
    expect(CODE_DEVELOPMENT_STEPS.review).toBeDefined();

    // Check workflow dependencies
    expect(CODE_DEVELOPMENT_STEPS.analyze.dependencies).toEqual([]);
    expect(CODE_DEVELOPMENT_STEPS.design.dependencies).toEqual(['analyze']);
    expect(CODE_DEVELOPMENT_STEPS.implement.dependencies).toEqual(['design']);
    expect(CODE_DEVELOPMENT_STEPS.test.dependencies).toEqual(['implement']);
    expect(CODE_DEVELOPMENT_STEPS.review.dependencies).toEqual(['test']);
  });

  test('should initialize workflow debugger', () => {
    const { workflowDebugger } = require('../../../src/lib/ai/workflows/workflow-debugger');
    
    expect(workflowDebugger).toBeDefined();
    expect(typeof workflowDebugger.recordState).toBe('function');
    expect(typeof workflowDebugger.getExecutionTrace).toBe('function');
    expect(typeof workflowDebugger.getWorkflowGraph).toBe('function');
  });

  test('should generate workflow graph structure', () => {
    const { workflowDebugger } = require('../../../src/lib/ai/workflows/workflow-debugger');
    
    const graph = workflowDebugger.getWorkflowGraph();
    
    expect(graph).toBeDefined();
    expect(graph.nodes).toHaveLength(5); // analyze, design, implement, test, review
    expect(graph.edges).toHaveLength(4); // 4 connections between 5 steps
    
    // Check node structure
    const analyzeNode = graph.nodes.find((n: any) => n.id === 'analyze');
    expect(analyzeNode).toBeDefined();
    expect(analyzeNode.label).toBe('Analyze');
    expect(analyzeNode.status).toBe('pending');
  });

  // Note: We skip the actual workflow execution test since it requires OpenAI API
  test.skip('should execute simple workflow', async () => {
    const input: WorkflowInput = {
      requirements: 'Create a simple calculator function that adds two numbers',
      language: 'TypeScript',
    };

    const result = await workflow.execute(input);
    
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.duration).toBe('number');
    expect(result.state).toBeDefined();
  });
});