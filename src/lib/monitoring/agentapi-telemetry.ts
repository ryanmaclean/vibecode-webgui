/**
 * AgentAPI OpenTelemetry Instrumentation
 * Provides comprehensive observability for agent lifecycle, performance, and errors
 */

import { trace, metrics, context, SpanStatusCode, type Span } from '@opentelemetry/api';
import type { Counter, Histogram, ObservableGauge } from '@opentelemetry/api';

const TRACER_NAME = 'agentapi-instrumentation';
const METER_NAME = 'agentapi-metrics';

// Agent states for tracking
export enum AgentState {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

// Agent types
export enum AgentType {
  AIDER = 'aider',
  GOOSE = 'goose',
  CLINE = 'cline'
}

interface AgentMetrics {
  agentId: string;
  agentType: AgentType;
  state: AgentState;
  startTime: number;
  lastActivity: number;
  taskDuration?: number;
  errorCount: number;
  outputLines: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

class AgentAPITelemetry {
  private tracer = trace.getTracer(TRACER_NAME);
  private meter = metrics.getMeter(METER_NAME);

  // Metrics
  private agentTaskDuration: Histogram;
  private agentSuccessTotal: Counter;
  private agentFailureTotal: Counter;
  private agentActiveGauge: ObservableGauge;
  private agentOutputLinesTotal: Counter;
  private agentErrorsTotal: Counter;
  private httpRequestsTotal: Counter;
  private httpRequestDuration: Histogram;

  // In-memory state for observable gauges
  private activeAgents = new Map<string, AgentMetrics>();

  constructor() {
    // Initialize metrics
    this.agentTaskDuration = this.meter.createHistogram(
      'agent_task_duration_seconds',
      {
        description: 'Duration of agent task execution in seconds',
        unit: 's',
        advice: {
          explicitBucketBoundaries: [1, 5, 10, 30, 60, 120, 300, 600, 1800]
        }
      }
    );

    this.agentSuccessTotal = this.meter.createCounter(
      'agent_success_total',
      {
        description: 'Total number of successfully completed agent tasks',
        unit: '1'
      }
    );

    this.agentFailureTotal = this.meter.createCounter(
      'agent_failure_total',
      {
        description: 'Total number of failed agent tasks',
        unit: '1'
      }
    );

    this.agentOutputLinesTotal = this.meter.createCounter(
      'agent_output_lines_total',
      {
        description: 'Total lines of output produced by agents',
        unit: '1'
      }
    );

    this.agentErrorsTotal = this.meter.createCounter(
      'agent_errors_total',
      {
        description: 'Total errors encountered by agents',
        unit: '1'
      }
    );

    this.httpRequestsTotal = this.meter.createCounter(
      'http_requests_total',
      {
        description: 'Total HTTP requests to AgentAPI',
        unit: '1'
      }
    );

    this.httpRequestDuration = this.meter.createHistogram(
      'http_request_duration_seconds',
      {
        description: 'HTTP request duration in seconds',
        unit: 's',
        advice: {
          explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
        }
      }
    );

    this.agentActiveGauge = this.meter.createObservableGauge(
      'agent_active_count',
      {
        description: 'Current number of active agents by type and state',
        unit: '1'
      }
    );

    // Register observable callback
    this.agentActiveGauge.addCallback((result) => {
      const stateCount = new Map<string, number>();

      for (const agent of this.activeAgents.values()) {
        const key = `${agent.agentType}:${agent.state}`;
        stateCount.set(key, (stateCount.get(key) || 0) + 1);
      }

      for (const [key, count] of stateCount.entries()) {
        const [agentType, state] = key.split(':');
        result.observe(count, {
          agent_type: agentType,
          state: state
        });
      }
    });
  }

  /**
   * Start tracing an agent task with full context
   */
  startAgentTask(
    agentId: string,
    agentType: AgentType,
    workspace: string,
    files: string[],
    task: string,
    model?: string
  ): Span {
    const span = this.tracer.startSpan('agent.task', {
      attributes: {
        'agent.id': agentId,
        'agent.type': agentType,
        'agent.workspace': workspace,
        'agent.files': files.join(','),
        'agent.task': task,
        'agent.model': model || 'default',
        'agent.files_count': files.length
      }
    });

    // Initialize agent metrics
    this.activeAgents.set(agentId, {
      agentId,
      agentType,
      state: AgentState.STARTING,
      startTime: Date.now(),
      lastActivity: Date.now(),
      errorCount: 0,
      outputLines: 0
    });

    return span;
  }

  /**
   * Update agent state transition
   */
  updateAgentState(agentId: string, newState: AgentState, span?: Span): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    const oldState = agent.state;
    agent.state = newState;
    agent.lastActivity = Date.now();

    if (span) {
      span.addEvent('agent.state_change', {
        'agent.state.from': oldState,
        'agent.state.to': newState,
        'agent.uptime_ms': Date.now() - agent.startTime
      });
    }
  }

  /**
   * Record agent output line
   */
  recordAgentOutput(agentId: string, lineCount: number = 1, span?: Span): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    agent.outputLines += lineCount;
    agent.lastActivity = Date.now();

    this.agentOutputLinesTotal.add(lineCount, {
      agent_id: agentId,
      agent_type: agent.agentType
    });

    if (span) {
      span.setAttribute('agent.output_lines', agent.outputLines);
    }
  }

  /**
   * Record agent error
   */
  recordAgentError(
    agentId: string,
    errorType: string,
    errorMessage: string,
    span?: Span
  ): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    agent.errorCount++;

    this.agentErrorsTotal.add(1, {
      agent_id: agentId,
      agent_type: agent.agentType,
      error_type: errorType
    });

    if (span) {
      span.recordException(new Error(errorMessage));
      span.setAttribute('agent.error_count', agent.errorCount);
      span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
    }
  }

  /**
   * Complete agent task successfully
   */
  completeAgentTask(agentId: string, span?: Span): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    const duration = (Date.now() - agent.startTime) / 1000;
    agent.taskDuration = duration;
    agent.state = AgentState.STOPPED;

    this.agentTaskDuration.record(duration, {
      agent_type: agent.agentType,
      success: 'true'
    });

    this.agentSuccessTotal.add(1, {
      agent_type: agent.agentType
    });

    if (span) {
      span.setAttributes({
        'agent.duration_seconds': duration,
        'agent.output_lines': agent.outputLines,
        'agent.error_count': agent.errorCount
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }

    // Remove from active agents after 5 seconds (allow metrics to be collected)
    setTimeout(() => this.activeAgents.delete(agentId), 5000);
  }

  /**
   * Fail agent task
   */
  failAgentTask(
    agentId: string,
    reason: string,
    span?: Span
  ): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    const duration = (Date.now() - agent.startTime) / 1000;
    agent.taskDuration = duration;
    agent.state = AgentState.FAILED;

    this.agentTaskDuration.record(duration, {
      agent_type: agent.agentType,
      success: 'false',
      failure_reason: reason
    });

    this.agentFailureTotal.add(1, {
      agent_type: agent.agentType,
      failure_reason: reason
    });

    if (span) {
      span.setAttributes({
        'agent.duration_seconds': duration,
        'agent.failure_reason': reason,
        'agent.error_count': agent.errorCount
      });
      span.setStatus({ code: SpanStatusCode.ERROR, message: reason });
      span.end();
    }

    // Remove from active agents after 5 seconds
    setTimeout(() => this.activeAgents.delete(agentId), 5000);
  }

  /**
   * Update resource usage for agent
   */
  updateAgentResources(
    agentId: string,
    cpuPercent: number,
    memoryMB: number
  ): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    agent.cpuUsage = cpuPercent;
    agent.memoryUsage = memoryMB;
  }

  /**
   * Trace HTTP request to AgentAPI
   */
  traceHTTPRequest(
    method: string,
    path: string,
    handler: (span: Span) => Promise<Response>
  ): Promise<Response> {
    const startTime = Date.now();

    return this.tracer.startActiveSpan(
      `HTTP ${method} ${path}`,
      {
        attributes: {
          'http.method': method,
          'http.route': path,
          'http.target': path,
          'service.name': 'agentapi'
        }
      },
      async (span) => {
        try {
          const response = await handler(span);

          const duration = (Date.now() - startTime) / 1000;
          const statusCode = response.status;

          span.setAttributes({
            'http.status_code': statusCode,
            'http.response_content_length': response.headers.get('content-length') || 0
          });

          this.httpRequestsTotal.add(1, {
            method,
            route: path,
            status_code: statusCode.toString()
          });

          this.httpRequestDuration.record(duration, {
            method,
            route: path,
            status_code: statusCode.toString()
          });

          if (statusCode >= 400) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${statusCode}` });
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }

          span.end();
          return response;

        } catch (error) {
          const duration = (Date.now() - startTime) / 1000;

          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });

          this.httpRequestsTotal.add(1, {
            method,
            route: path,
            status_code: '500'
          });

          this.httpRequestDuration.record(duration, {
            method,
            route: path,
            status_code: '500'
          });

          span.end();
          throw error;
        }
      }
    );
  }

  /**
   * Get current metrics snapshot
   */
  getMetricsSnapshot(): {
    activeAgents: number;
    agentsByType: Record<string, number>;
    agentsByState: Record<string, number>;
  } {
    const agentsByType: Record<string, number> = {};
    const agentsByState: Record<string, number> = {};

    for (const agent of this.activeAgents.values()) {
      agentsByType[agent.agentType] = (agentsByType[agent.agentType] || 0) + 1;
      agentsByState[agent.state] = (agentsByState[agent.state] || 0) + 1;
    }

    return {
      activeAgents: this.activeAgents.size,
      agentsByType,
      agentsByState
    };
  }
}

// Export singleton instance
export const agentAPITelemetry = new AgentAPITelemetry();

// Export types
export type { AgentMetrics };
