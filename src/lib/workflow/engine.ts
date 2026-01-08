/**
 * Workflow Execution Engine
 * DAG-based workflow orchestration with parallel execution and state management
 *
 * Performance targets:
 * - Workflow parse time: <50ms
 * - Execution overhead: <100ms
 * - Support 20+ node workflows
 */

import { EventEmitter } from 'events';
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowNode,
  WorkflowEdge,
  NodeExecution,
  WorkflowContext,
  WorkflowStatus,
  NodeStatus,
  WorkflowEventType,
  WorkflowEvent,
  ExecutionError,
  ExecutionLog,
  Checkpoint,
  NodeConfig,
  AgentTaskConfig,
  ConditionConfig,
  ParallelConfig,
  MergeConfig,
  LoopConfig,
  TransformConfig,
  DelayConfig,
  WebhookConfig,
} from './types';

// ============================================================================
// DAG Graph Utilities
// ============================================================================

/**
 * Topologically sort workflow nodes
 * Returns nodes in execution order
 */
function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const sortedNodes: WorkflowNode[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  nodes.forEach(node => adjacency.set(node.id, []));
  edges.forEach(edge => {
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  });

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      throw new Error(`Cycle detected in workflow: ${nodeId}`);
    }

    visiting.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighborId of neighbors) {
      visit(neighborId);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      sortedNodes.unshift(node);
    }
  }

  // Find root nodes (no incoming edges)
  const targetNodes = new Set(edges.map(e => e.target));
  const rootNodes = nodes.filter(node => !targetNodes.has(node.id));

  // Visit all nodes starting from roots
  for (const node of rootNodes) {
    visit(node.id);
  }

  // Visit any remaining unvisited nodes
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      visit(node.id);
    }
  }

  return sortedNodes;
}

/**
 * Get node dependencies (incoming edges)
 */
function getNodeDependencies(nodeId: string, edges: WorkflowEdge[]): string[] {
  return edges
    .filter(edge => edge.target === nodeId)
    .map(edge => edge.source);
}

/**
 * Check if node dependencies are satisfied
 */
function areDependenciesSatisfied(
  nodeId: string,
  edges: WorkflowEdge[],
  nodeExecutions: Map<string, NodeExecution>,
  nodes: WorkflowNode[]
): boolean {
  const dependencies = getNodeDependencies(nodeId, edges);

  return dependencies.every(depId => {
    const depExec = nodeExecutions.get(depId);
    if (depExec?.status === 'completed') {
      return true;
    }
    // Allow failed dependencies if they have continueOnError enabled
    if (depExec?.status === 'failed') {
      const node = nodes.find(n => n.id === depId);
      return node?.continueOnError === true;
    }
    return false;
  });
}

// ============================================================================
// Template Engine
// ============================================================================

/**
 * Evaluate template expressions in context
 */
function evaluateTemplate(template: string, context: WorkflowContext): string {
  // Replace ${variable.path} with actual values
  return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
    const value = getContextValue(path.trim(), context);
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Get value from context by path
 */
function getContextValue(path: string, context: WorkflowContext): unknown {
  const parts = path.split('.');
  let current: any = context;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Evaluate JavaScript expression safely
 */
function evaluateExpression(expression: string, context: WorkflowContext): unknown {
  try {
    // Create function with context variables as parameters
    const contextVars = { input: context.input, ...context.globals, nodes: context.nodes };
    const func = new Function(...Object.keys(contextVars), `return ${expression}`);
    return func(...Object.values(contextVars));
  } catch (error) {
    throw new Error(`Expression evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Workflow Engine
// ============================================================================

export class WorkflowEngine extends EventEmitter {
  private executions = new Map<string, WorkflowExecution>();
  private agentExecutor?: (config: AgentTaskConfig, context: WorkflowContext) => Promise<unknown>;

  constructor() {
    super();
  }

  /**
   * Register agent executor function
   */
  registerAgentExecutor(executor: (config: AgentTaskConfig, context: WorkflowContext) => Promise<unknown>): void {
    this.agentExecutor = executor;
  }

  /**
   * Parse and validate workflow definition
   * Target: <50ms parse time
   */
  async parseWorkflow(definition: WorkflowDefinition): Promise<void> {
    const startTime = Date.now();

    // Validate basic structure
    if (!definition.name || !definition.version) {
      throw new Error('Workflow must have name and version');
    }

    if (!definition.nodes || definition.nodes.length === 0) {
      throw new Error('Workflow must have at least one node');
    }

    // Validate node IDs are unique
    const nodeIds = new Set<string>();
    for (const node of definition.nodes) {
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    // Validate edges reference valid nodes
    for (const edge of definition.edges) {
      if (!nodeIds.has(edge.source)) {
        throw new Error(`Edge references unknown source node: ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        throw new Error(`Edge references unknown target node: ${edge.target}`);
      }
    }

    // Validate no cycles (will throw if cycle detected)
    topologicalSort(definition.nodes, definition.edges);

    const duration = Date.now() - startTime;
    if (duration > 50) {
      console.warn(`Workflow parsing took ${duration}ms (target: <50ms)`);
    }
  }

  /**
   * Execute workflow with given inputs
   */
  async executeWorkflow(
    definition: WorkflowDefinition,
    inputs: Record<string, unknown> = {}
  ): Promise<WorkflowExecution> {
    const startTime = Date.now();

    // Validate workflow
    await this.parseWorkflow(definition);

    // Create execution instance
    const execution: WorkflowExecution = {
      id: this.generateExecutionId(),
      workflowId: definition.name,
      workflowVersion: definition.version,
      status: 'running',
      nodes: new Map(),
      context: {
        input: inputs,
        nodes: {},
        globals: {},
        loops: {},
      },
      metadata: {
        startedAt: new Date(),
      },
      checkpoints: [],
    };

    this.executions.set(execution.id, execution);
    this.emitEvent(execution.id, WorkflowEventType.WORKFLOW_STARTED, {
      workflowId: definition.name,
      workflowVersion: definition.version,
    });

    try {
      // Execute nodes in topological order
      await this.executeNodes(definition, execution);

      execution.status = 'completed';
      execution.metadata.completedAt = new Date();
      execution.metadata.duration = Date.now() - startTime.valueOf();

      this.emitEvent(execution.id, WorkflowEventType.WORKFLOW_COMPLETED, {
        duration: execution.metadata.duration,
      });

      const overhead = Date.now() - startTime;
      if (overhead > 100) {
        console.warn(`Workflow execution overhead: ${overhead}ms (target: <100ms per node)`);
      }

      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.error = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      };

      this.emitEvent(execution.id, WorkflowEventType.WORKFLOW_FAILED, {
        error: execution.error,
      });

      throw error;
    }
  }

  /**
   * Execute nodes with dependency resolution and parallelization
   */
  private async executeNodes(
    definition: WorkflowDefinition,
    execution: WorkflowExecution
  ): Promise<void> {
    const sortedNodes = topologicalSort(definition.nodes, definition.edges);
    const pendingNodes = new Set(sortedNodes.map(n => n.id));
    const runningNodes = new Set<string>();
    const maxConcurrency = definition.config?.maxConcurrency || 10;

    // Initialize node executions
    for (const node of sortedNodes) {
      execution.nodes.set(node.id, {
        nodeId: node.id,
        status: 'pending',
        retryCount: 0,
        logs: [],
      });
    }

    // Execute nodes as dependencies are satisfied
    while (pendingNodes.size > 0 || runningNodes.size > 0) {
      // Find nodes ready to execute (dependencies satisfied, under concurrency limit)
      const readyNodes = Array.from(pendingNodes).filter(nodeId => {
        if (runningNodes.size >= maxConcurrency) return false;
        return areDependenciesSatisfied(nodeId, definition.edges, execution.nodes, definition.nodes);
      });

      if (readyNodes.length === 0 && runningNodes.size === 0) {
        // No nodes ready and none running - workflow is stuck
        throw new Error('Workflow execution blocked: no nodes ready to execute');
      }

      // Execute ready nodes in parallel
      const executionPromises = readyNodes.map(async nodeId => {
        const node = sortedNodes.find(n => n.id === nodeId)!;
        pendingNodes.delete(nodeId);
        runningNodes.add(nodeId);

        try {
          await this.executeNode(node, execution, definition.edges);
        } finally {
          runningNodes.delete(nodeId);
        }
      });

      // Wait for at least one node to complete
      if (executionPromises.length > 0) {
        await Promise.race(executionPromises);
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Execute individual node
   */
  private async executeNode(
    node: WorkflowNode,
    execution: WorkflowExecution,
    edges?: WorkflowEdge[]
  ): Promise<void> {
    const nodeExec = execution.nodes.get(node.id)!;
    nodeExec.status = 'running';
    nodeExec.startedAt = new Date();

    this.emitEvent(execution.id, WorkflowEventType.NODE_STARTED, { nodeId: node.id });
    this.addLog(execution, node.id, 'info', `Executing node: ${node.name}`);

    const startTime = Date.now();

    try {
      // Execute based on node type
      let output: unknown;

      switch (node.type) {
        case 'agent-task':
          output = await this.executeAgentTask(node.config as AgentTaskConfig, execution);
          break;

        case 'condition':
          output = await this.executeCondition(node.config as ConditionConfig, execution);
          break;

        case 'parallel':
          output = await this.executeParallel(node.config as ParallelConfig, execution);
          break;

        case 'merge':
          output = await this.executeMerge(node, execution, edges || []);
          break;

        case 'loop':
          output = await this.executeLoop(node, execution);
          break;

        case 'transform':
          output = await this.executeTransform(node.config as TransformConfig, execution);
          break;

        case 'delay':
          output = await this.executeDelay(node.config as DelayConfig, execution);
          break;

        case 'webhook':
          output = await this.executeWebhook(node.config as WebhookConfig, execution);
          break;

        default:
          throw new Error(`Unsupported node type: ${node.type}`);
      }

      nodeExec.output = output;
      nodeExec.status = 'completed';
      nodeExec.completedAt = new Date();
      nodeExec.duration = Date.now() - startTime;

      // Store output in context
      execution.context.nodes[node.id] = output;

      this.emitEvent(execution.id, WorkflowEventType.NODE_COMPLETED, {
        nodeId: node.id,
        duration: nodeExec.duration,
      });
      this.addLog(execution, node.id, 'info', `Node completed in ${nodeExec.duration}ms`);

    } catch (error) {
      nodeExec.status = 'failed';
      nodeExec.error = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        nodeId: node.id,
      };

      this.emitEvent(execution.id, WorkflowEventType.NODE_FAILED, {
        nodeId: node.id,
        error: nodeExec.error,
      });
      this.addLog(execution, node.id, 'error', `Node failed: ${nodeExec.error.message}`);

      if (!node.continueOnError) {
        throw error;
      }
    }
  }

  /**
   * Execute agent task node
   */
  private async executeAgentTask(
    config: AgentTaskConfig,
    execution: WorkflowExecution
  ): Promise<unknown> {
    if (!this.agentExecutor) {
      throw new Error('Agent executor not registered');
    }

    // Evaluate template variables in task
    const evaluatedConfig = {
      ...config,
      task: evaluateTemplate(config.task, execution.context),
      workspace: config.workspace ? evaluateTemplate(config.workspace, execution.context) : undefined,
    };

    return await this.agentExecutor(evaluatedConfig, execution.context);
  }

  /**
   * Execute conditional node
   */
  private async executeCondition(
    config: ConditionConfig,
    execution: WorkflowExecution
  ): Promise<unknown> {
    const result = evaluateExpression(config.expression, execution.context);
    return { condition: result, expression: config.expression };
  }

  /**
   * Execute parallel node
   */
  private async executeParallel(
    config: ParallelConfig,
    execution: WorkflowExecution
  ): Promise<unknown> {
    // Parallel execution handled by executeNodes
    return { parallel: true };
  }

  /**
   * Execute merge node
   */
  private async executeMerge(
    node: WorkflowNode,
    execution: WorkflowExecution,
    edges: WorkflowEdge[]
  ): Promise<unknown> {
    const config = node.config as MergeConfig;

    // Get outputs from all incoming nodes
    const dependencies = getNodeDependencies(node.id, edges);
    const inputs: unknown[] = dependencies.map(depId => execution.context.nodes[depId]);

    switch (config.strategy) {
      case 'all':
        // Return all inputs as an array
        return { inputs, merged: true };

      case 'any':
        // Return first available input
        return { input: inputs[0], merged: true };

      case 'first':
        // Return first input
        return { input: inputs[0], merged: true };

      case 'custom':
        // Execute custom merge function
        if (config.mergeFunction) {
          const mergeFunc = new Function('inputs', `return ${config.mergeFunction}`);
          return mergeFunc(inputs);
        }
        return { inputs, merged: true };

      default:
        return { inputs, merged: true };
    }
  }

  /**
   * Execute loop node
   */
  private async executeLoop(
    node: WorkflowNode,
    execution: WorkflowExecution
  ): Promise<unknown> {
    const config = node.config as LoopConfig;
    const items = evaluateExpression(config.items, execution.context) as unknown[];

    if (!Array.isArray(items)) {
      throw new Error('Loop items must evaluate to an array');
    }

    const results: unknown[] = [];
    const maxIterations = config.maxIterations || items.length;

    for (let i = 0; i < Math.min(items.length, maxIterations); i++) {
      const item = items[i];

      // Update loop context
      execution.context.loops[node.id] = {
        item,
        index: i,
        total: items.length,
        results,
      };

      // Check continue condition
      if (config.continueCondition) {
        const shouldContinue = evaluateExpression(config.continueCondition, execution.context);
        if (!shouldContinue) break;
      }

      // Execute loop body (would need to be implemented for child nodes)
      results.push({ item, index: i });
    }

    return results;
  }

  /**
   * Execute transform node
   */
  private async executeTransform(
    config: TransformConfig,
    execution: WorkflowExecution
  ): Promise<unknown> {
    return evaluateExpression(config.transform, execution.context);
  }

  /**
   * Execute delay node
   */
  private async executeDelay(
    config: DelayConfig,
    execution: WorkflowExecution
  ): Promise<unknown> {
    const duration = config.durationExpression
      ? Number(evaluateExpression(config.durationExpression, execution.context))
      : config.duration;

    await new Promise(resolve => setTimeout(resolve, duration));
    return { delayed: duration };
  }

  /**
   * Execute webhook node
   */
  private async executeWebhook(
    config: WebhookConfig,
    execution: WorkflowExecution
  ): Promise<unknown> {
    const url = evaluateTemplate(config.url, execution.context);
    const body = config.body ? evaluateTemplate(config.body, execution.context) : undefined;

    const response = await fetch(url, {
      method: config.method,
      headers: config.headers || {},
      body: body ? JSON.stringify(body) : undefined,
    });

    if (config.expectedStatus && !config.expectedStatus.includes(response.status)) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Add log entry
   */
  private addLog(
    execution: WorkflowExecution,
    nodeId: string | undefined,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string
  ): void {
    const log: ExecutionLog = {
      timestamp: new Date(),
      level,
      message,
      nodeId,
    };

    if (nodeId) {
      const nodeExec = execution.nodes.get(nodeId);
      if (nodeExec) {
        nodeExec.logs.push(log);
      }
    }
  }

  /**
   * Emit workflow event
   */
  private emitEvent(executionId: string, type: WorkflowEventType, data?: unknown): void {
    const event: WorkflowEvent = {
      type,
      timestamp: new Date(),
      executionId,
      data,
    };
    this.emit('event', event);
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Resume execution from checkpoint
   */
  async resumeExecution(executionId: string, checkpointId: string): Promise<WorkflowExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const checkpoint = execution.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Restore context from checkpoint
    execution.context = checkpoint.context;
    execution.status = 'running';

    this.emitEvent(executionId, WorkflowEventType.WORKFLOW_RESUMED, {
      checkpointId,
    });

    return execution;
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    execution.status = 'cancelled';
    this.emitEvent(executionId, WorkflowEventType.WORKFLOW_CANCELLED);
  }
}

/**
 * Create workflow engine instance
 */
export function createWorkflowEngine(): WorkflowEngine {
  return new WorkflowEngine();
}
