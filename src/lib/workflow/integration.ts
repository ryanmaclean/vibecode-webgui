/**
 * Workflow Integration with Agent API
 * Connect workflow engine to agent execution system
 */

import type { AgentTaskConfig, WorkflowContext } from './types';
import type { StartAgentRequest, AgentResponse, AgentStatus, ModelType } from '@/types/agent-api';

/**
 * Agent API client interface
 */
interface AgentAPIClient {
  startAgent(request: StartAgentRequest): Promise<AgentResponse>;
  getAgentStatus(agentId: string): Promise<AgentStatusResponse>;
  sendMessage(agentId: string, message: string): Promise<AgentMessageResponse>;
  stopAgent(agentId: string): Promise<AgentStopResponse>;
}

interface AgentStatusResponse {
  status: AgentStatus | string;
  last_output?: string;
  exit_code?: number;
}

interface AgentMessageResponse {
  ok: boolean;
}

interface AgentStopResponse {
  ok: boolean;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: string;
  status: string;
  metadata: {
    startedAt?: string | Date;
    completedAt?: string | Date;
    duration?: number;
  };
  context: unknown;
  error?: unknown;
}

interface WorkflowExecutionStore {
  insertWorkflowExecution?: (record: WorkflowExecutionRecord) => Promise<void>;
}

interface WorkflowExecutionRecord {
  id: string;
  workflow_id: string;
  workflow_version: string;
  status: string;
  started_at?: string | Date;
  completed_at?: string | Date;
  duration_ms?: number;
  context: string;
  error: string | null;
  created_at: Date;
}

interface MetricsClient {
  increment: (name: string, tags?: Record<string, string>) => void;
  histogram: (name: string, value: number, tags?: Record<string, string>) => void;
  gauge: (name: string, value: number, tags?: Record<string, string>) => void;
}

/**
 * Create agent executor function for workflow engine
 */
export function createAgentExecutor(apiClient: AgentAPIClient) {
  return async (config: AgentTaskConfig, context: WorkflowContext): Promise<unknown> => {
    // Map workflow agent task config to Agent API request
    const request: StartAgentRequest = {
      agent_type: config.agentType as 'aider' | 'goose' | 'cline',
      model: config.model as ModelType,
      task: config.task,
      workspace: config.workspace || '/home/coder/workspace',
      files: config.files,
      metadata: config.metadata,
    };

    // Start agent
    const agentResponse = await apiClient.startAgent(request);

    // Wait for agent completion (polling)
    const result = await pollAgentCompletion(
      apiClient,
      agentResponse.agent_id,
      {
        timeout: 300000, // 5 minutes
        interval: 2000,  // 2 seconds
      }
    );

    return result;
  };
}

/**
 * Poll agent until completion
 */
async function pollAgentCompletion(
  apiClient: AgentAPIClient,
  agentId: string,
  options: {
    timeout: number;
    interval: number;
  }
): Promise<AgentCompletionResult> {
  const startTime = Date.now();

  while (true) {
    // Check timeout
    if (Date.now() - startTime > options.timeout) {
      throw new Error(`Agent execution timeout: ${agentId}`);
    }

    // Get agent status
    const status = await apiClient.getAgentStatus(agentId);

    // Check if completed
    if (status.status === 'completed') {
      return {
        agentId,
        status: 'completed',
        output: status.last_output,
        exitCode: status.exit_code,
      };
    }

    // Check if failed
    if (status.status === 'failed' || status.status === 'error') {
      throw new Error(`Agent execution failed: ${status.last_output || 'Unknown error'}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, options.interval));
  }
}

interface AgentCompletionResult {
  agentId: string;
  status: 'completed';
  output?: string;
  exitCode?: number;
}

/**
 * Store workflow execution in database (integration with Agent 3's database)
 */
export async function saveWorkflowExecution(
  execution: WorkflowExecution,
  databaseClient: WorkflowExecutionStore
): Promise<void> {
  // This would integrate with Agent 3's database system
  // For now, this is a placeholder

  const record: WorkflowExecutionRecord = {
    id: execution.id,
    workflow_id: execution.workflowId,
    workflow_version: execution.workflowVersion,
    status: execution.status,
    started_at: execution.metadata.startedAt,
    completed_at: execution.metadata.completedAt,
    duration_ms: execution.metadata.duration,
    context: JSON.stringify(execution.context),
    error: execution.error ? JSON.stringify(execution.error) : null,
    created_at: new Date(),
  };

  // await databaseClient.insertWorkflowExecution(record);
  console.log('Workflow execution saved:', record.id);
}

/**
 * Monitor workflow execution (integration with Agent 7's observability)
 */
export function createWorkflowMonitor(metricsClient: MetricsClient | null | undefined) {
  return {
    /**
     * Track workflow start
     */
    trackWorkflowStart(workflowId: string, version: string): void {
      metricsClient?.increment('workflow.started', {
        workflow_id: workflowId,
        version,
      });
    },

    /**
     * Track workflow completion
     */
    trackWorkflowComplete(
      workflowId: string,
      version: string,
      durationMs: number,
      nodeCount: number
    ): void {
      metricsClient?.increment('workflow.completed', {
        workflow_id: workflowId,
        version,
      });

      metricsClient?.histogram('workflow.duration', durationMs, {
        workflow_id: workflowId,
        version,
      });

      metricsClient?.gauge('workflow.nodes', nodeCount, {
        workflow_id: workflowId,
        version,
      });
    },

    /**
     * Track workflow failure
     */
    trackWorkflowFailed(
      workflowId: string,
      version: string,
      errorCode: string
    ): void {
      metricsClient?.increment('workflow.failed', {
        workflow_id: workflowId,
        version,
        error_code: errorCode,
      });
    },

    /**
     * Track node execution
     */
    trackNodeExecution(
      workflowId: string,
      nodeId: string,
      nodeType: string,
      durationMs: number,
      status: string
    ): void {
      metricsClient?.histogram('workflow.node.duration', durationMs, {
        workflow_id: workflowId,
        node_id: nodeId,
        node_type: nodeType,
        status,
      });
    },
  };
}

/**
 * Example: Setup workflow engine with full integration
 */
export function setupWorkflowEngine(
  agentApiClient: AgentAPIClient,
  databaseClient: WorkflowExecutionStore,
  metricsClient: MetricsClient | null | undefined
) {
  const { createWorkflowEngine, registerAgentExecutor } = require('./index');

  // Create engine
  const engine = createWorkflowEngine();

  // Register agent executor
  const executor = createAgentExecutor(agentApiClient);
  registerAgentExecutor(executor);

  // Setup monitoring
  const monitor = createWorkflowMonitor(metricsClient);

  // Listen to workflow events
  engine.on('event', (event: WorkflowEngineEvent) => {
    switch (event.type) {
      case 'workflow.started':
        monitor.trackWorkflowStart(
          event.data.workflowId,
          event.data.workflowVersion
        );
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

      case 'node.completed':
        monitor.trackNodeExecution(
          event.data.workflowId,
          event.data.nodeId,
          event.data.nodeType,
          event.data.duration,
          'completed'
        );
        break;

      case 'node.failed':
        monitor.trackNodeExecution(
          event.data.workflowId,
          event.data.nodeId,
          event.data.nodeType,
          event.data.duration || 0,
          'failed'
        );
        break;
    }
  });

  return { engine, monitor };
}

interface WorkflowEngineEvent {
  type: string;
  data: {
    workflowId: string;
    workflowVersion: string;
    duration: number;
    nodeCount: number;
    error?: { code?: string };
    nodeId: string;
    nodeType: string;
  };
}
