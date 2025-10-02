/**
 * Workflow Engine Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WorkflowEngine, createWorkflowEngine } from '@/lib/workflow/engine';
import type { WorkflowDefinition, AgentTaskConfig } from '@/lib/workflow/types';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = createWorkflowEngine();
  });

  describe('Workflow Parsing', () => {
    it('should parse valid workflow definition', async () => {
      const workflow: WorkflowDefinition = {
        name: 'test-workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'node1',
            type: 'transform',
            name: 'Test Node',
            config: {
              transform: '{ result: "success" }',
            },
          },
        ],
        edges: [],
      };

      await expect(engine.parseWorkflow(workflow)).resolves.not.toThrow();
    });

    it('should reject workflow without name', async () => {
      const workflow = {
        version: '1.0.0',
        nodes: [],
        edges: [],
      } as WorkflowDefinition;

      await expect(engine.parseWorkflow(workflow)).rejects.toThrow(
        'Workflow must have name and version'
      );
    });

    it('should reject workflow with duplicate node IDs', async () => {
      const workflow: WorkflowDefinition = {
        name: 'test',
        version: '1.0.0',
        nodes: [
          {
            id: 'node1',
            type: 'transform',
            name: 'Node 1',
            config: { transform: '{}' },
          },
          {
            id: 'node1',
            type: 'transform',
            name: 'Node 2',
            config: { transform: '{}' },
          },
        ],
        edges: [],
      };

      await expect(engine.parseWorkflow(workflow)).rejects.toThrow(
        'Duplicate node ID: node1'
      );
    });

    it('should detect cycles in workflow', async () => {
      const workflow: WorkflowDefinition = {
        name: 'test',
        version: '1.0.0',
        nodes: [
          {
            id: 'node1',
            type: 'transform',
            name: 'Node 1',
            config: { transform: '{}' },
          },
          {
            id: 'node2',
            type: 'transform',
            name: 'Node 2',
            config: { transform: '{}' },
          },
        ],
        edges: [
          { id: 'e1', source: 'node1', target: 'node2' },
          { id: 'e2', source: 'node2', target: 'node1' },
        ],
      };

      await expect(engine.parseWorkflow(workflow)).rejects.toThrow('Cycle detected');
    });
  });

  describe('Workflow Execution', () => {
    it('should execute simple workflow', async () => {
      const workflow: WorkflowDefinition = {
        name: 'simple-workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'transform1',
            type: 'transform',
            name: 'Transform',
            config: {
              transform: '{ value: 42 }',
            },
          },
        ],
        edges: [],
      };

      const execution = await engine.executeWorkflow(workflow, {});

      expect(execution.status).toBe('completed');
      expect(execution.nodes.get('transform1')?.status).toBe('completed');
      expect(execution.nodes.get('transform1')?.output).toEqual({ value: 42 });
    });

    it('should execute workflow with dependencies', async () => {
      const workflow: WorkflowDefinition = {
        name: 'dependent-workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'node1',
            type: 'transform',
            name: 'First Node',
            config: {
              transform: '{ step: 1 }',
            },
          },
          {
            id: 'node2',
            type: 'transform',
            name: 'Second Node',
            config: {
              transform: '{ step: 2, previous: nodes.node1.step }',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'node1', target: 'node2' }],
      };

      const execution = await engine.executeWorkflow(workflow, {});

      expect(execution.status).toBe('completed');
      expect(execution.nodes.get('node1')?.status).toBe('completed');
      expect(execution.nodes.get('node2')?.status).toBe('completed');
      expect(execution.nodes.get('node2')?.output).toEqual({
        step: 2,
        previous: 1,
      });
    });

    it('should execute parallel nodes', async () => {
      const workflow: WorkflowDefinition = {
        name: 'parallel-workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'parallel1',
            type: 'transform',
            name: 'Parallel 1',
            config: {
              transform: '{ branch: "A" }',
            },
          },
          {
            id: 'parallel2',
            type: 'transform',
            name: 'Parallel 2',
            config: {
              transform: '{ branch: "B" }',
            },
          },
          {
            id: 'merge',
            type: 'merge',
            name: 'Merge',
            config: {
              strategy: 'all',
            },
          },
        ],
        edges: [
          { id: 'e1', source: 'parallel1', target: 'merge' },
          { id: 'e2', source: 'parallel2', target: 'merge' },
        ],
      };

      const startTime = Date.now();
      const execution = await engine.executeWorkflow(workflow, {});
      const duration = Date.now() - startTime;

      expect(execution.status).toBe('completed');
      expect(execution.nodes.get('parallel1')?.status).toBe('completed');
      expect(execution.nodes.get('parallel2')?.status).toBe('completed');
      expect(execution.nodes.get('merge')?.status).toBe('completed');

      // Should complete quickly due to parallel execution
      expect(duration).toBeLessThan(1000);
    });

    it('should handle workflow failure', async () => {
      const workflow: WorkflowDefinition = {
        name: 'failing-workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'failing-node',
            type: 'transform',
            name: 'Failing Node',
            config: {
              transform: 'throw new Error("Test error")',
            },
          },
        ],
        edges: [],
      };

      await expect(engine.executeWorkflow(workflow, {})).rejects.toThrow();
    });

    it('should continue on error when configured', async () => {
      const workflow: WorkflowDefinition = {
        name: 'continue-on-error',
        version: '1.0.0',
        nodes: [
          {
            id: 'failing-node',
            type: 'transform',
            name: 'Failing Node',
            config: {
              transform: 'throw new Error("Test error")',
            },
            continueOnError: true,
          },
          {
            id: 'next-node',
            type: 'transform',
            name: 'Next Node',
            config: {
              transform: '{ completed: true }',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'failing-node', target: 'next-node' }],
      };

      const execution = await engine.executeWorkflow(workflow, {});

      expect(execution.status).toBe('completed');
      expect(execution.nodes.get('failing-node')?.status).toBe('failed');
      expect(execution.nodes.get('next-node')?.status).toBe('completed');
    });
  });

  describe('Template Variables', () => {
    it('should evaluate input variables', async () => {
      const workflow: WorkflowDefinition = {
        name: 'input-workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'node1',
            type: 'transform',
            name: 'Use Input',
            config: {
              transform: '{ greeting: `Hello ${input.name}` }',
            },
          },
        ],
        edges: [],
      };

      const execution = await engine.executeWorkflow(workflow, {
        name: 'World',
      });

      expect(execution.status).toBe('completed');
      expect(execution.nodes.get('node1')?.output).toEqual({
        greeting: 'Hello World',
      });
    });

    it('should access node outputs', async () => {
      const workflow: WorkflowDefinition = {
        name: 'chained-workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'first',
            type: 'transform',
            name: 'First',
            config: {
              transform: '{ value: 10 }',
            },
          },
          {
            id: 'second',
            type: 'transform',
            name: 'Second',
            config: {
              transform: '{ doubled: nodes.first.value * 2 }',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'first', target: 'second' }],
      };

      const execution = await engine.executeWorkflow(workflow, {});

      expect(execution.nodes.get('second')?.output).toEqual({
        doubled: 20,
      });
    });
  });

  describe('Agent Task Execution', () => {
    it('should execute agent task with registered executor', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({
        result: 'Agent completed',
      });

      engine.registerAgentExecutor(mockExecutor as any);

      const workflow: WorkflowDefinition = {
        name: 'agent-workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'agent1',
            type: 'agent-task',
            name: 'Agent Task',
            config: {
              agentType: 'cline',
              model: 'claude-3-5-sonnet-20241022',
              task: 'Test task',
              workspace: '/test',
            } as AgentTaskConfig,
          },
        ],
        edges: [],
      };

      const execution = await engine.executeWorkflow(workflow, {});

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      expect(execution.status).toBe('completed');
    });

    it('should fail if agent executor not registered', async () => {
      const workflow: WorkflowDefinition = {
        name: 'agent-workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'agent1',
            type: 'agent-task',
            name: 'Agent Task',
            config: {
              agentType: 'cline',
              model: 'claude-3-5-sonnet-20241022',
              task: 'Test task',
            } as AgentTaskConfig,
          },
        ],
        edges: [],
      };

      await expect(engine.executeWorkflow(workflow, {})).rejects.toThrow(
        'Agent executor not registered'
      );
    });
  });

  describe('Performance', () => {
    it('should parse workflow in <50ms', async () => {
      const workflow: WorkflowDefinition = {
        name: 'performance-test',
        version: '1.0.0',
        nodes: Array.from({ length: 20 }, (_, i) => ({
          id: `node${i}`,
          type: 'transform' as const,
          name: `Node ${i}`,
          config: {
            transform: `{ value: ${i} }`,
          },
        })),
        edges: Array.from({ length: 19 }, (_, i) => ({
          id: `e${i}`,
          source: `node${i}`,
          target: `node${i + 1}`,
        })),
      };

      const startTime = Date.now();
      await engine.parseWorkflow(workflow);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should execute 20+ node workflow efficiently', async () => {
      const workflow: WorkflowDefinition = {
        name: 'large-workflow',
        version: '1.0.0',
        nodes: Array.from({ length: 25 }, (_, i) => ({
          id: `node${i}`,
          type: 'transform' as const,
          name: `Node ${i}`,
          config: {
            transform: `{ value: ${i} }`,
          },
        })),
        edges: [],
      };

      const execution = await engine.executeWorkflow(workflow, {});

      expect(execution.status).toBe('completed');
      expect(execution.nodes.size).toBe(25);

      // Check overhead is reasonable
      const avgOverhead =
        (execution.metadata.duration || 0) / execution.nodes.size;
      expect(avgOverhead).toBeLessThan(100);
    });
  });
});
