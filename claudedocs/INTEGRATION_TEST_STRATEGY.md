# Integration Test Strategy - AgentAPI & Multi-Agent System

**Company**: Mozilla (Staff QA Engineer)
**Date**: 2025-10-02
**Branch**: feature/integration-test-strategy
**Status**: Strategy Definition Complete - Implementation Pending

---

## Executive Summary

Comprehensive integration test strategy for the AgentAPI system covering 30 agents, containerized workloads, real-time communication, and workflow orchestration. This strategy addresses critical gaps identified in test coverage analysis and provides a systematic approach to validating system integration points.

### Strategic Objectives

1. **Full System Integration Coverage**: Validate all integration points between AgentAPI, containers, workflows, and observability
2. **Real-Time Communication Validation**: Test SSE/WebSocket streaming under load (100+ concurrent connections)
3. **Multi-Agent Orchestration**: Validate workflow engine with 3+ concurrent agents
4. **Performance Baselines**: Establish P95 latency targets (<200ms) for critical paths
5. **Container Runtime Validation**: Test Apple Container Runtime across macOS versions

### Current State vs Target

| Area | Current Coverage | Target | Priority |
|------|-----------------|--------|----------|
| AgentAPI Integration | 0% | 80% | CRITICAL |
| SSE/WebSocket Streaming | 15% | 90% | CRITICAL |
| Workflow Engine | 25% | 85% | CRITICAL |
| Container Orchestration | 0% | 75% | HIGH |
| Database Integration | 60% | 85% | MEDIUM |
| Real-time Communication | 40% | 90% | HIGH |
| Performance Baselines | 0% | 100% | HIGH |

---

## Test Coverage Matrix

### By Agent Integration

| Agent | Component | Integration Points | Current | Target | Priority |
|-------|-----------|-------------------|---------|--------|----------|
| Agent 4 | AgentAPI | REST + gRPC | 0% | 90% | CRITICAL |
| Agent 13 | Streaming | SSE + WebSocket | 15% | 95% | CRITICAL |
| Agent 15 | Workflow | DAG Execution | 25% | 90% | CRITICAL |
| Agent 27 | Logging | Rust/Swift Bridge | 40% | 80% | HIGH |
| Agent 7 | Observability | Datadog/OTel | 60% | 85% | MEDIUM |
| Apple Runtime | Container | VM Orchestration | 0% | 80% | CRITICAL |

### By Component Type

| Component | Test Types | Test Count | Priority |
|-----------|-----------|-----------|----------|
| AgentAPI Server | Integration, E2E, Performance | 80+ | CRITICAL |
| SSE/WebSocket | Integration, Load, E2E | 60+ | CRITICAL |
| Workflow Engine | Integration, E2E, Unit | 70+ | CRITICAL |
| Database (Prisma) | Integration, Transaction, Migration | 50+ | HIGH |
| Cache (Redis) | Integration, Performance | 30+ | HIGH |
| Container Runtime | Integration, Performance | 40+ | CRITICAL |
| Real-time UI | E2E, Accessibility, Visual | 45+ | HIGH |

---

## 1. AgentAPI Integration Tests

### 1.1 REST API Integration

**Coverage**: Agent 4 AgentAPI server with REST endpoints

**Test Suite**: `tests/integration/agentapi/rest-api.test.ts`

```typescript
describe('AgentAPI REST Integration', () => {
  // Test infrastructure setup
  describe('Infrastructure', () => {
    test('Testcontainers: Spin up AgentAPI container', async () => {
      const container = await new GenericContainer('vibecode-agentapi:latest')
        .withExposedPorts(3284, 9090)
        .withEnvironment({
          AGENTAPI_PORT: '3284',
          AGENTAPI_LOG_LEVEL: 'debug',
        })
        .start();

      expect(container.getState()).toBe('running');

      // Health check validation
      const health = await fetch(`http://localhost:${container.getMappedPort(3284)}/health`);
      expect(health.status).toBe(200);
    });
  });

  // Agent lifecycle management
  describe('Agent Lifecycle', () => {
    test('POST /api/agent/start - Start Aider agent', async () => {
      const response = await request(agentApiUrl)
        .post('/api/agent/start')
        .send({
          agentType: 'aider',
          config: {
            model: 'claude-3-5-sonnet-20241022',
            workspace: '/workspace/test-project',
          },
        })
        .expect(200);

      expect(response.body).toMatchObject({
        agentId: expect.any(String),
        status: 'starting',
        pid: expect.any(Number),
      });
    });

    test('GET /api/agent/status/:id - Poll agent status', async () => {
      const agentId = await startAgent('aider');

      const response = await request(agentApiUrl)
        .get(`/api/agent/status/${agentId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        agentId,
        status: expect.stringMatching(/starting|running/),
        uptime: expect.any(Number),
      });
    });

    test('POST /api/agent/stop - Stop agent gracefully', async () => {
      const agentId = await startAgent('goose');
      await waitForAgentReady(agentId);

      const response = await request(agentApiUrl)
        .post(`/api/agent/stop/${agentId}`)
        .send({ timeout: 10 })
        .expect(200);

      expect(response.body.status).toBe('stopped');

      // Verify agent process cleaned up
      const status = await request(agentApiUrl)
        .get(`/api/agent/status/${agentId}`)
        .expect(404);
    });
  });

  // Command execution
  describe('Command Execution', () => {
    test('POST /api/agent/execute - Execute command via agent', async () => {
      const agentId = await startAgent('aider');

      const response = await request(agentApiUrl)
        .post(`/api/agent/execute`)
        .send({
          agentId,
          command: 'ls -la',
          timeout: 30,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        output: expect.any(String),
        exitCode: 0,
        duration: expect.any(Number),
      });
    });

    test('Command timeout handling', async () => {
      const agentId = await startAgent('aider');

      const response = await request(agentApiUrl)
        .post(`/api/agent/execute`)
        .send({
          agentId,
          command: 'sleep 60',
          timeout: 2, // 2 second timeout
        })
        .expect(408); // Request Timeout

      expect(response.body.error).toContain('timeout');
    });
  });

  // Error scenarios
  describe('Error Handling', () => {
    test('Start agent with invalid config', async () => {
      const response = await request(agentApiUrl)
        .post('/api/agent/start')
        .send({
          agentType: 'invalid-agent',
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid agent type');
    });

    test('Execute on non-existent agent', async () => {
      const response = await request(agentApiUrl)
        .post(`/api/agent/execute`)
        .send({
          agentId: 'non-existent-id',
          command: 'echo test',
        })
        .expect(404);
    });
  });

  // Performance validation
  describe('Performance', () => {
    test('Agent startup latency < 2s', async () => {
      const start = Date.now();
      const agentId = await startAgent('aider');
      await waitForAgentReady(agentId);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
    });

    test('Command execution overhead < 100ms', async () => {
      const agentId = await startAgent('aider');
      const command = 'echo "test"';

      const start = Date.now();
      await request(agentApiUrl)
        .post(`/api/agent/execute`)
        .send({ agentId, command });
      const duration = Date.now() - start;

      // Execution time should be dominated by command, not overhead
      expect(duration).toBeLessThan(150);
    });
  });
});
```

**Test Data Strategy**:
- Fixture agents: Aider, Goose, Cline configurations
- Mock workspaces with sample projects
- Test commands with known outputs
- Error scenarios with invalid inputs

**Success Criteria**:
- All API endpoints tested with happy/error paths
- Performance baselines established
- Agent lifecycle validated end-to-end
- Error handling verified

---

### 1.2 gRPC Integration

**Coverage**: Agent 4 gRPC protocol for high-performance agent communication

**Test Suite**: `tests/integration/agentapi/grpc-api.test.ts`

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

describe('AgentAPI gRPC Integration', () => {
  let client: any;

  beforeAll(() => {
    const packageDefinition = protoLoader.loadSync(
      'proto/agentapi.proto',
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      }
    );

    const proto = grpc.loadPackageDefinition(packageDefinition);
    client = new proto.agentapi.AgentService(
      'localhost:50051',
      grpc.credentials.createInsecure()
    );
  });

  describe('Agent Management', () => {
    test('StartAgent RPC call', (done) => {
      client.StartAgent(
        {
          agentType: 'aider',
          config: {
            model: 'claude-3-5-sonnet-20241022',
            workspace: '/workspace/test',
          },
        },
        (error: any, response: any) => {
          expect(error).toBeNull();
          expect(response).toMatchObject({
            agentId: expect.any(String),
            status: 'STARTING',
          });
          done();
        }
      );
    });

    test('Streaming logs via gRPC', (done) => {
      const agentId = 'test-agent-id';
      const call = client.StreamLogs({ agentId });

      const logs: any[] = [];
      call.on('data', (chunk: any) => {
        logs.push(chunk);
      });

      call.on('end', () => {
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0]).toMatchObject({
          timestamp: expect.any(Number),
          level: expect.stringMatching(/INFO|DEBUG|ERROR/),
          message: expect.any(String),
        });
        done();
      });
    });
  });

  describe('Performance', () => {
    test('gRPC latency < 10ms for local calls', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await new Promise((resolve) => {
          client.GetAgentStatus({ agentId: 'test' }, () => resolve(null));
        });
        latencies.push(Date.now() - start);
      }

      const p95 = latencies.sort()[Math.floor(iterations * 0.95)];
      expect(p95).toBeLessThan(10);
    });
  });
});
```

---

## 2. Real-Time Communication Tests

### 2.1 SSE (Server-Sent Events) Integration

**Coverage**: Agent 13 optimized SSE client with connection pooling

**Test Suite**: `tests/integration/streaming/sse-integration.test.ts`

```typescript
describe('SSE Integration Tests', () => {
  describe('Connection Management', () => {
    test('Establish SSE connection to agent stream', async () => {
      const eventSource = new EventSource('http://localhost:3284/api/agent/stream/aider-123');

      const firstMessage = await new Promise((resolve) => {
        eventSource.onmessage = (event) => {
          resolve(JSON.parse(event.data));
        };
      });

      expect(firstMessage).toMatchObject({
        type: 'agent-output',
        agentId: 'aider-123',
        data: expect.any(String),
      });

      eventSource.close();
    });

    test('SSE reconnection on connection drop', async () => {
      const events: any[] = [];
      const eventSource = new EventSource('http://localhost:3284/api/agent/stream/test', {
        headers: {
          'X-Test-Reconnect': 'true',
        },
      });

      eventSource.onmessage = (event) => {
        events.push(JSON.parse(event.data));
      };

      // Wait for initial connection
      await waitForEvents(events, 1);

      // Simulate server disconnect
      await fetch('http://localhost:3284/api/test/disconnect', {
        method: 'POST',
      });

      // Wait for reconnection and new events
      await waitForEvents(events, 5);

      // Verify reconnection gap is tracked
      const reconnectEvent = events.find((e) => e.type === 'reconnect');
      expect(reconnectEvent).toBeDefined();
      expect(reconnectEvent.lastEventId).toBeDefined();
    });

    test('Connection pooling: 10 concurrent SSE connections', async () => {
      const connections = Array.from({ length: 10 }, (_, i) =>
        new EventSource(`http://localhost:3284/api/agent/stream/agent-${i}`)
      );

      // Verify all connections established
      const firstMessages = await Promise.all(
        connections.map((es) =>
          new Promise((resolve) => {
            es.onmessage = (event) => resolve(event.data);
          })
        )
      );

      expect(firstMessages).toHaveLength(10);
      connections.forEach((es) => es.close());
    });
  });

  describe('Message Handling', () => {
    test('Binary message compression', async () => {
      const eventSource = new EventSource('http://localhost:3284/api/agent/stream/test?compress=true');

      const compressedMessage = await new Promise((resolve) => {
        eventSource.onmessage = (event) => {
          resolve(event.data);
        };
      });

      // Verify compressed format (base64 encoded gzip)
      expect(typeof compressedMessage).toBe('string');
      const decompressed = await decompressMessage(compressedMessage as string);
      expect(decompressed).toMatchObject({
        type: expect.any(String),
        data: expect.any(String),
      });
    });

    test('Message batching for high-frequency updates', async () => {
      const eventSource = new EventSource('http://localhost:3284/api/agent/stream/test?batch=true');

      const batchedMessage = await new Promise((resolve) => {
        eventSource.onmessage = (event) => {
          resolve(JSON.parse(event.data));
        };
      });

      expect(batchedMessage).toMatchObject({
        type: 'batch',
        messages: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            timestamp: expect.any(Number),
          }),
        ]),
      });
    });
  });

  describe('Performance', () => {
    test('SSE latency < 50ms P95 for local events', async () => {
      const eventSource = new EventSource('http://localhost:3284/api/agent/stream/test');
      const latencies: number[] = [];

      const measureLatency = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        const serverTimestamp = data.timestamp;
        const clientTimestamp = Date.now();
        latencies.push(clientTimestamp - serverTimestamp);
      };

      eventSource.onmessage = measureLatency;

      await waitForEvents(latencies, 100);

      const p95 = latencies.sort()[Math.floor(100 * 0.95)];
      expect(p95).toBeLessThan(50);
    });

    test('100 concurrent SSE connections sustained', async () => {
      const connections = Array.from({ length: 100 }, (_, i) =>
        new EventSource(`http://localhost:3284/api/agent/stream/agent-${i}`)
      );

      // Monitor for 30 seconds
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Verify all connections still active
      const activeConnections = connections.filter((es) => es.readyState === EventSource.OPEN);
      expect(activeConnections.length).toBe(100);

      connections.forEach((es) => es.close());
    });
  });

  describe('Error Scenarios', () => {
    test('Handle 503 Service Unavailable gracefully', async () => {
      const eventSource = new EventSource('http://localhost:3284/api/agent/stream/unavailable');

      const errorEvent = await new Promise((resolve) => {
        eventSource.onerror = (event) => {
          resolve(event);
        };
      });

      expect(eventSource.readyState).toBe(EventSource.CLOSED);
    });
  });
});
```

---

### 2.2 WebSocket Integration

**Coverage**: Agent 13 WebSocket bidirectional communication

**Test Suite**: `tests/integration/streaming/websocket-integration.test.ts`

```typescript
import { WebSocket } from 'ws';

describe('WebSocket Integration Tests', () => {
  describe('Connection Management', () => {
    test('Establish WebSocket connection to agent', async () => {
      const ws = new WebSocket('ws://localhost:3284/api/agent/ws/aider-123');

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    test('Heartbeat/ping-pong keep-alive', async () => {
      const ws = new WebSocket('ws://localhost:3284/api/agent/ws/test');
      await waitForOpen(ws);

      let pongReceived = false;
      ws.on('pong', () => {
        pongReceived = true;
      });

      ws.ping();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(pongReceived).toBe(true);
    });

    test('Automatic reconnection with exponential backoff', async () => {
      const reconnectAttempts: number[] = [];
      let ws = new WebSocket('ws://localhost:3284/api/agent/ws/test');

      const reconnect = async (attempt: number) => {
        reconnectAttempts.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 30000)));
        ws = new WebSocket('ws://localhost:3284/api/agent/ws/test');
      };

      // Simulate connection drops
      for (let i = 0; i < 3; i++) {
        ws.close();
        await reconnect(i);
      }

      // Verify exponential backoff
      const delays = reconnectAttempts.slice(1).map((time, i) => time - reconnectAttempts[i]);
      expect(delays[0]).toBeLessThan(delays[1]);
      expect(delays[1]).toBeLessThan(delays[2]);
    });
  });

  describe('Message Exchange', () => {
    test('Send command to agent via WebSocket', async () => {
      const ws = new WebSocket('ws://localhost:3284/api/agent/ws/aider-123');
      await waitForOpen(ws);

      ws.send(JSON.stringify({
        type: 'command',
        data: {
          command: 'echo "test"',
        },
      }));

      const response = await new Promise((resolve) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(response).toMatchObject({
        type: 'command-result',
        data: {
          output: expect.stringContaining('test'),
          exitCode: 0,
        },
      });
    });

    test('Binary message support', async () => {
      const ws = new WebSocket('ws://localhost:3284/api/agent/ws/test');
      await waitForOpen(ws);

      const binaryData = Buffer.from('Hello, World!');
      ws.send(binaryData);

      const response = await new Promise((resolve) => {
        ws.on('message', (data) => {
          resolve(data);
        });
      });

      expect(Buffer.isBuffer(response)).toBe(true);
      expect((response as Buffer).toString()).toBe('Hello, World!');
    });
  });

  describe('Backpressure Handling', () => {
    test('Flow control with pause/resume', async () => {
      const ws = new WebSocket('ws://localhost:3284/api/agent/ws/test');
      await waitForOpen(ws);

      // Send pause signal
      ws.send(JSON.stringify({ type: 'flow-control', action: 'pause' }));

      // Verify server stops sending
      let messageCount = 0;
      ws.on('message', () => {
        messageCount++;
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
      const pausedCount = messageCount;

      // Resume
      ws.send(JSON.stringify({ type: 'flow-control', action: 'resume' }));
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(messageCount).toBeGreaterThan(pausedCount);
    });

    test('Buffer overflow protection', async () => {
      const ws = new WebSocket('ws://localhost:3284/api/agent/ws/test', {
        perMessageDeflate: false, // Disable compression for test
      });
      await waitForOpen(ws);

      // Send large burst
      for (let i = 0; i < 1000; i++) {
        ws.send(JSON.stringify({ type: 'test', data: 'x'.repeat(1024) }));
      }

      // Verify connection doesn't break
      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe('Performance', () => {
    test('WebSocket latency < 10ms for local messages', async () => {
      const ws = new WebSocket('ws://localhost:3284/api/agent/ws/test');
      await waitForOpen(ws);

      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        ws.send(JSON.stringify({ type: 'ping', timestamp: start }));

        await new Promise((resolve) => {
          ws.once('message', (data) => {
            const response = JSON.parse(data.toString());
            latencies.push(Date.now() - response.timestamp);
            resolve(null);
          });
        });
      }

      const p95 = latencies.sort()[Math.floor(100 * 0.95)];
      expect(p95).toBeLessThan(10);
    });

    test('1000 messages/second throughput', async () => {
      const ws = new WebSocket('ws://localhost:3284/api/agent/ws/test');
      await waitForOpen(ws);

      let messageCount = 0;
      ws.on('message', () => {
        messageCount++;
      });

      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const throughput = messageCount / ((Date.now() - start) / 1000);

      expect(throughput).toBeGreaterThan(1000);
    });
  });
});
```

---

## 3. Workflow Engine Integration Tests

### 3.1 DAG Execution Integration

**Coverage**: Agent 15 workflow orchestration with multi-agent coordination

**Test Suite**: `tests/integration/workflow/dag-execution.test.ts`

```typescript
import { WorkflowEngine } from '@/lib/workflow/engine';
import { codeReviewWorkflow } from '@/lib/workflow/templates';

describe('Workflow Engine Integration', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine({
      maxConcurrency: 3,
      eventEmitter: true,
    });
  });

  describe('Template Execution', () => {
    test('Execute code review workflow end-to-end', async () => {
      const events: any[] = [];
      engine.on('node-start', (event) => events.push({ type: 'start', ...event }));
      engine.on('node-complete', (event) => events.push({ type: 'complete', ...event }));

      const result = await engine.execute(codeReviewWorkflow, {
        files: ['src/lib/test.ts'],
        workspace: '/workspace/test-project',
      });

      expect(result.status).toBe('completed');
      expect(result.outputs).toMatchObject({
        analyze: {
          issues: expect.any(Array),
        },
        'run-tests': {
          testResults: expect.any(Object),
        },
      });

      // Verify execution order
      const nodeSequence = events.filter((e) => e.type === 'start').map((e) => e.nodeId);
      expect(nodeSequence).toEqual(['analyze', 'check-issues', 'fix-issues', 'run-tests', 'complete']);
    });

    test('Parallel refactoring workflow with 3 agents', async () => {
      const parallelWorkflow = {
        name: 'parallel-refactor',
        nodes: [
          {
            id: 'parallel-refactor',
            type: 'parallel',
            config: {
              nodes: [
                {
                  id: 'refactor-auth',
                  type: 'agent-task',
                  config: { agentType: 'aider', task: 'Refactor auth module' },
                },
                {
                  id: 'refactor-db',
                  type: 'agent-task',
                  config: { agentType: 'goose', task: 'Refactor database layer' },
                },
                {
                  id: 'refactor-api',
                  type: 'agent-task',
                  config: { agentType: 'cline', task: 'Refactor API routes' },
                },
              ],
              maxConcurrency: 3,
            },
          },
        ],
      };

      const start = Date.now();
      const result = await engine.execute(parallelWorkflow, {
        workspace: '/workspace/test-project',
      });
      const duration = Date.now() - start;

      expect(result.status).toBe('completed');

      // Verify parallel execution (should be < 3x serial time)
      // If serial: 3s per agent = 9s total
      // If parallel: max(3s) = ~3s total + overhead
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Agent API Integration', () => {
    test('Start agent via workflow node', async () => {
      const workflow = {
        name: 'simple-agent-task',
        nodes: [
          {
            id: 'start-agent',
            type: 'agent-task',
            config: {
              agentType: 'aider',
              model: 'claude-3-5-sonnet-20241022',
              task: 'List files in workspace',
              workspace: '/workspace/test',
            },
          },
        ],
      };

      const result = await engine.execute(workflow, {});

      expect(result.status).toBe('completed');
      expect(result.outputs['start-agent']).toMatchObject({
        agentId: expect.any(String),
        output: expect.any(String),
        duration: expect.any(Number),
      });
    });

    test('Agent failure triggers error handling', async () => {
      const workflow = {
        name: 'agent-failure-test',
        nodes: [
          {
            id: 'failing-agent',
            type: 'agent-task',
            config: {
              agentType: 'aider',
              task: 'exit 1', // Force failure
              retries: 2,
            },
          },
        ],
      };

      const result = await engine.execute(workflow, {});

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.retryCount).toBe(2);
    });
  });

  describe('Database Persistence', () => {
    test('Workflow execution history saved to database', async () => {
      const workflow = codeReviewWorkflow;
      const result = await engine.execute(workflow, {
        files: ['test.ts'],
        workspace: '/workspace/test',
      });

      // Query database for execution record
      const execution = await prisma.workflowExecution.findUnique({
        where: { id: result.executionId },
        include: {
          nodeExecutions: true,
        },
      });

      expect(execution).toBeDefined();
      expect(execution?.status).toBe('COMPLETED');
      expect(execution?.nodeExecutions).toHaveLength(5);
    });

    test('Resume workflow from checkpoint', async () => {
      // Start workflow
      const executionId = await engine.startExecution(codeReviewWorkflow, {
        files: ['test.ts'],
        workspace: '/workspace/test',
      });

      // Simulate failure after 2 nodes
      await engine.checkpoint(executionId, {
        completedNodes: ['analyze', 'check-issues'],
        currentNode: 'fix-issues',
      });

      // Resume from checkpoint
      const result = await engine.resumeExecution(executionId);

      expect(result.status).toBe('completed');
      expect(result.resumedFrom).toBe('fix-issues');
    });
  });

  describe('Monitoring Integration', () => {
    test('Workflow metrics exported to Datadog', async () => {
      const mockDatadog = jest.spyOn(datadog, 'increment');

      await engine.execute(codeReviewWorkflow, {
        files: ['test.ts'],
        workspace: '/workspace/test',
      });

      expect(mockDatadog).toHaveBeenCalledWith('workflow.execution.started', 1, {
        workflow: 'code-review',
      });
      expect(mockDatadog).toHaveBeenCalledWith('workflow.execution.completed', 1, {
        workflow: 'code-review',
        status: 'success',
      });
    });

    test('OpenTelemetry traces for workflow execution', async () => {
      const tracer = trace.getTracer('workflow-engine');
      const spans: any[] = [];

      // Mock span exporter
      tracer.startSpan = jest.fn((name, options) => {
        const span = { name, ...options };
        spans.push(span);
        return span;
      });

      await engine.execute(codeReviewWorkflow, {
        files: ['test.ts'],
        workspace: '/workspace/test',
      });

      expect(spans).toContainEqual(
        expect.objectContaining({
          name: 'workflow.execute',
          attributes: expect.objectContaining({
            'workflow.name': 'code-review',
          }),
        })
      );
    });
  });

  describe('Performance', () => {
    test('Workflow parsing < 50ms', () => {
      const start = Date.now();
      engine.parse(codeReviewWorkflow);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    test('Workflow execution overhead < 100ms per node', async () => {
      const workflow = {
        name: 'noop-workflow',
        nodes: Array.from({ length: 10 }, (_, i) => ({
          id: `noop-${i}`,
          type: 'transform',
          config: {
            transform: 'input', // No-op transform
          },
        })),
      };

      const start = Date.now();
      await engine.execute(workflow, {});
      const duration = Date.now() - start;

      // 10 nodes * 100ms overhead = 1000ms max
      expect(duration).toBeLessThan(1000);
    });
  });
});
```

---

## 4. Database Integration Tests

### 4.1 Prisma Integration

**Coverage**: Agent 3 database operations with Prisma ORM

**Test Suite**: `tests/integration/database/prisma-integration.test.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

describe('Database Integration Tests', () => {
  let prisma: PrismaClient;
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('vibecode_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    process.env.DATABASE_URL = container.getConnectionUri();
    prisma = new PrismaClient();

    // Run migrations
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
    await runMigrations();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
  });

  describe('Workspace Operations', () => {
    test('Create workspace with container metadata', async () => {
      const workspace = await prisma.workspace.create({
        data: {
          name: 'test-workspace',
          path: '/workspace/test',
          containerRuntime: 'apple-container',
          containerMetadata: {
            vmId: 'vm-123',
            cpuAllocation: 2,
            memoryMB: 4096,
          },
        },
      });

      expect(workspace.id).toBeDefined();
      expect(workspace.containerMetadata).toMatchObject({
        vmId: 'vm-123',
      });
    });

    test('Query workspaces with agents', async () => {
      const workspace = await createTestWorkspace();
      await createTestAgent(workspace.id, 'aider');
      await createTestAgent(workspace.id, 'goose');

      const result = await prisma.workspace.findUnique({
        where: { id: workspace.id },
        include: {
          agents: true,
        },
      });

      expect(result?.agents).toHaveLength(2);
    });
  });

  describe('Agent Execution History', () => {
    test('Store agent execution with streaming logs', async () => {
      const workspace = await createTestWorkspace();
      const agent = await createTestAgent(workspace.id, 'aider');

      const execution = await prisma.agentExecution.create({
        data: {
          agentId: agent.id,
          command: 'echo "test"',
          status: 'RUNNING',
          logs: [],
        },
      });

      // Append logs
      await prisma.agentExecution.update({
        where: { id: execution.id },
        data: {
          logs: {
            push: {
              timestamp: new Date(),
              level: 'INFO',
              message: 'Command output: test',
            },
          },
        },
      });

      const updated = await prisma.agentExecution.findUnique({
        where: { id: execution.id },
      });

      expect(updated?.logs).toHaveLength(1);
    });
  });

  describe('Vector Database Operations', () => {
    test('Store and query vector embeddings', async () => {
      const embedding = Array.from({ length: 1536 }, () => Math.random());

      await prisma.$executeRaw`
        INSERT INTO embeddings (content, embedding)
        VALUES ('test document', ${embedding}::vector)
      `;

      const results = await prisma.$queryRaw`
        SELECT content, embedding <-> ${embedding}::vector AS distance
        FROM embeddings
        ORDER BY distance
        LIMIT 5
      `;

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('test document');
    });
  });

  describe('Transaction Handling', () => {
    test('Rollback on workflow execution failure', async () => {
      const workspace = await createTestWorkspace();

      await expect(
        prisma.$transaction(async (tx) => {
          const execution = await tx.workflowExecution.create({
            data: {
              workspaceId: workspace.id,
              workflowName: 'test',
              status: 'RUNNING',
            },
          });

          // Simulate failure
          throw new Error('Execution failed');
        })
      ).rejects.toThrow();

      // Verify no orphaned records
      const executions = await prisma.workflowExecution.findMany({
        where: { workspaceId: workspace.id },
      });

      expect(executions).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    test('Bulk insert 1000 agent logs < 500ms', async () => {
      const agent = await createTestAgent((await createTestWorkspace()).id, 'aider');
      const logs = Array.from({ length: 1000 }, (_, i) => ({
        agentId: agent.id,
        timestamp: new Date(),
        level: 'INFO',
        message: `Log message ${i}`,
      }));

      const start = Date.now();
      await prisma.agentLog.createMany({ data: logs });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
```

---

## 5. Container Runtime Integration Tests

### 5.1 Apple Container Runtime

**Coverage**: Apple Container Runtime with VM orchestration

**Test Suite**: `tests/integration/container/apple-runtime.test.ts`

```typescript
import { AppleContainerRuntime } from '@/lib/container/apple-container-v2';

describe('Apple Container Runtime Integration', () => {
  let runtime: AppleContainerRuntime;

  beforeAll(() => {
    runtime = new AppleContainerRuntime({
      vmPoolSize: 3,
      cpuAllocation: 2,
      memoryMB: 4096,
    });
  });

  describe('VM Lifecycle', () => {
    test('Create VM from pool', async () => {
      const vm = await runtime.allocateVM({
        workspace: '/workspace/test',
        agentType: 'aider',
      });

      expect(vm).toMatchObject({
        vmId: expect.any(String),
        state: 'RUNNING',
        ipAddress: expect.stringMatching(/^\d+\.\d+\.\d+\.\d+$/),
      });
    });

    test('VM boot time < 300ms', async () => {
      const start = Date.now();
      const vm = await runtime.allocateVM({ workspace: '/workspace/test' });
      const bootTime = Date.now() - start;

      expect(bootTime).toBeLessThan(300);

      await runtime.releaseVM(vm.vmId);
    });

    test('VM resource isolation', async () => {
      const vm1 = await runtime.allocateVM({ cpuLimit: 1, memoryMB: 1024 });
      const vm2 = await runtime.allocateVM({ cpuLimit: 1, memoryMB: 1024 });

      // Run CPU-intensive task in VM1
      await runtime.executeInVM(vm1.vmId, 'stress --cpu 1 --timeout 5s');

      // Verify VM2 not affected
      const vm2Stats = await runtime.getVMStats(vm2.vmId);
      expect(vm2Stats.cpuUsage).toBeLessThan(10); // < 10% CPU usage
    });
  });

  describe('Container Orchestration', () => {
    test('Start container in VM', async () => {
      const vm = await runtime.allocateVM({ workspace: '/workspace/test' });

      const container = await runtime.startContainer(vm.vmId, {
        image: 'vibecode-agentapi:latest',
        ports: [{ host: 3284, container: 3284 }],
        environment: {
          AGENTAPI_PORT: '3284',
        },
      });

      expect(container).toMatchObject({
        containerId: expect.any(String),
        status: 'running',
        vmId: vm.vmId,
      });
    });

    test('Container networking across VMs', async () => {
      const vm1 = await runtime.allocateVM({ workspace: '/workspace/test1' });
      const vm2 = await runtime.allocateVM({ workspace: '/workspace/test2' });

      const container1 = await runtime.startContainer(vm1.vmId, {
        image: 'nginx:latest',
        ports: [{ host: 8080, container: 80 }],
      });

      const container2 = await runtime.startContainer(vm2.vmId, {
        image: 'curlimages/curl:latest',
        command: ['curl', `http://${vm1.ipAddress}:8080`],
      });

      const logs = await runtime.getContainerLogs(container2.containerId);
      expect(logs).toContain('Welcome to nginx');
    });
  });

  describe('ML Acceleration', () => {
    test('Allocate Metal GPU for inference', async () => {
      const vm = await runtime.allocateVM({
        workspace: '/workspace/ml-test',
        gpuAcceleration: true,
      });

      const gpuInfo = await runtime.getGPUInfo(vm.vmId);
      expect(gpuInfo).toMatchObject({
        available: true,
        type: 'metal',
        memory: expect.any(Number),
      });
    });

    test('Neural Engine availability', async () => {
      const vm = await runtime.allocateVM({
        neuralEngineEnabled: true,
      });

      const neInfo = await runtime.getNeuralEngineInfo(vm.vmId);
      expect(neInfo).toMatchObject({
        available: true,
        version: expect.any(String),
      });
    });
  });

  describe('Performance', () => {
    test('VM allocation latency < 100ms', async () => {
      // Pre-warm pool
      await runtime.prewarmPool(3);

      const latencies: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        const vm = await runtime.allocateVM({ workspace: `/workspace/test-${i}` });
        latencies.push(Date.now() - start);
        await runtime.releaseVM(vm.vmId);
      }

      const p95 = latencies.sort()[Math.floor(10 * 0.95)];
      expect(p95).toBeLessThan(100);
    });

    test('Idle power consumption < 5W', async () => {
      const vm = await runtime.allocateVM({ workspace: '/workspace/test' });

      // Let VM idle for 30 seconds
      await new Promise((resolve) => setTimeout(resolve, 30000));

      const powerStats = await runtime.getPowerStats(vm.vmId);
      expect(powerStats.averagePowerWatts).toBeLessThan(5);
    });
  });
});
```

---

## 6. End-to-End Test Scenarios

### 6.1 Complete User Journey

**Test Suite**: `tests/e2e/user-journeys/multi-agent-workflow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Multi-Agent Workflow E2E', () => {
  test('Complete workflow: Create workspace → Start agents → Execute workflow → View results', async ({ page }) => {
    // 1. Navigate to workspace creation
    await page.goto('http://localhost:3000/workspaces/new');

    // 2. Create workspace
    await page.fill('input[name="workspace-name"]', 'E2E Test Workspace');
    await page.selectOption('select[name="runtime"]', 'apple-container');
    await page.click('button:has-text("Create Workspace")');

    // Wait for workspace ready
    await page.waitForSelector('.workspace-status:has-text("Ready")');

    // 3. Start multiple agents
    await page.click('button:has-text("Add Agent")');
    await page.selectOption('select[name="agent-type"]', 'aider');
    await page.click('button:has-text("Start Agent")');

    await page.waitForSelector('.agent-status:has-text("Running")');

    await page.click('button:has-text("Add Agent")');
    await page.selectOption('select[name="agent-type"]', 'goose');
    await page.click('button:has-text("Start Agent")');

    // 4. Open workflow editor
    await page.click('button:has-text("Workflows")');
    await page.click('button:has-text("New Workflow")');

    // 5. Select template
    await page.click('.template-card:has-text("Code Review")');

    // 6. Configure workflow inputs
    await page.fill('input[name="files"]', 'src/lib/test.ts');
    await page.click('button:has-text("Execute Workflow")');

    // 7. Monitor execution
    await page.waitForSelector('.workflow-status:has-text("Running")');

    // Verify real-time updates via SSE
    const nodeStatus = await page.locator('.node-status[data-node-id="analyze"]');
    await expect(nodeStatus).toHaveText('Running', { timeout: 5000 });
    await expect(nodeStatus).toHaveText('Completed', { timeout: 30000 });

    // 8. View results
    await page.click('button:has-text("View Results")');

    const results = await page.locator('.workflow-results');
    await expect(results).toContainText('Analysis Complete');
    await expect(results).toContainText('Tests Passed');

    // 9. Verify logs accessible
    await page.click('button:has-text("View Logs")');
    const logs = await page.locator('.agent-logs');
    await expect(logs).not.toBeEmpty();
  });

  test('Performance: Workflow execution with real-time updates', async ({ page }) => {
    await page.goto('http://localhost:3000/workspaces/test-123');

    // Start workflow
    const startTime = Date.now();
    await page.click('button:has-text("Execute Workflow")');

    // Measure time to first update
    await page.waitForSelector('.workflow-status:has-text("Running")');
    const firstUpdateTime = Date.now() - startTime;

    expect(firstUpdateTime).toBeLessThan(200); // < 200ms to first UI update

    // Monitor SSE latency
    const sseLatencies: number[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/workflow/stream')) {
        const requestTime = Date.now();
        page.on('response', (response) => {
          if (response.url() === request.url()) {
            sseLatencies.push(Date.now() - requestTime);
          }
        });
      }
    });

    await page.waitForSelector('.workflow-status:has-text("Completed")', { timeout: 60000 });

    // Verify SSE latency
    const avgLatency = sseLatencies.reduce((a, b) => a + b, 0) / sseLatencies.length;
    expect(avgLatency).toBeLessThan(50);
  });

  test('Error handling: Agent failure with retry', async ({ page }) => {
    await page.goto('http://localhost:3000/workspaces/test-123');

    // Configure workflow with failing agent
    await page.click('button:has-text("New Workflow")');
    await page.fill('textarea[name="agent-task"]', 'exit 1'); // Force failure
    await page.fill('input[name="retries"]', '2');
    await page.click('button:has-text("Execute")');

    // Verify retry attempts
    const retryStatus = page.locator('.node-status:has-text("Retrying")');
    await expect(retryStatus).toBeVisible();

    // Wait for final failure
    await page.waitForSelector('.workflow-status:has-text("Failed")');

    // Verify error message displayed
    const errorMessage = page.locator('.error-message');
    await expect(errorMessage).toContainText('Agent execution failed after 2 retries');
  });
});
```

---

## 7. Performance & Load Testing

### 7.1 k6 Load Test Scripts

**Coverage**: Agent 21 performance validation with k6

**Test Suite**: `tests/performance/k6/agentapi-load-test.js`

```javascript
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const failRate = new Rate('failed_requests');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests < 200ms
    http_req_failed: ['rate<0.01'],   // Error rate < 1%
    failed_requests: ['rate<0.01'],
  },
};

export default function () {
  // Test 1: Agent startup
  const startResponse = http.post(
    'http://localhost:3284/api/agent/start',
    JSON.stringify({
      agentType: 'aider',
      config: {
        model: 'claude-3-5-sonnet-20241022',
        workspace: `/workspace/test-${__VU}`,
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(startResponse, {
    'agent start status 200': (r) => r.status === 200,
    'agent start latency < 2s': (r) => r.timings.duration < 2000,
  }) || failRate.add(1);

  const agentId = JSON.parse(startResponse.body).agentId;

  // Test 2: SSE streaming
  const sseUrl = `http://localhost:3284/api/agent/stream/${agentId}`;
  const sseResponse = http.get(sseUrl, {
    headers: { Accept: 'text/event-stream' },
  });

  check(sseResponse, {
    'SSE connection established': (r) => r.status === 200,
    'SSE first event < 100ms': (r) => r.timings.waiting < 100,
  }) || failRate.add(1);

  // Test 3: WebSocket streaming
  const wsUrl = `ws://localhost:3284/api/agent/ws/${agentId}`;
  const wsResponse = ws.connect(wsUrl, {}, (socket) => {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'ping' }));
    });

    socket.on('message', (data) => {
      const message = JSON.parse(data);
      check(message, {
        'WebSocket response received': (m) => m.type === 'pong',
      });
    });

    socket.setTimeout(() => {
      socket.close();
    }, 5000);
  });

  // Test 4: Command execution
  const execResponse = http.post(
    'http://localhost:3284/api/agent/execute',
    JSON.stringify({
      agentId,
      command: 'echo "test"',
      timeout: 10,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(execResponse, {
    'command execution status 200': (r) => r.status === 200,
    'command execution < 500ms': (r) => r.timings.duration < 500,
  }) || failRate.add(1);

  // Test 5: Agent shutdown
  const stopResponse = http.post(
    `http://localhost:3284/api/agent/stop/${agentId}`,
    JSON.stringify({ timeout: 5 }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(stopResponse, {
    'agent stop status 200': (r) => r.status === 200,
  }) || failRate.add(1);

  sleep(1);
}
```

**Streaming Load Test**: `tests/performance/k6/streaming-load-test.js`

```javascript
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const wsConnections = new Counter('ws_connections');
const wsLatency = new Trend('ws_latency_ms');
const sseConnections = new Counter('sse_connections');

export const options = {
  scenarios: {
    sse_connections: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      exec: 'testSSE',
    },
    ws_connections: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      exec: 'testWebSocket',
    },
  },
  thresholds: {
    ws_latency_ms: ['p(95)<50'],
    ws_connections: ['count>4500'], // 50 VUs * 90 iterations/VU
  },
};

export function testSSE() {
  const agentId = `agent-${__VU}-${__ITER}`;
  const sseUrl = `http://localhost:3284/api/agent/stream/${agentId}`;

  // Simulate SSE connection for 3 seconds
  const response = http.get(sseUrl, {
    headers: { Accept: 'text/event-stream' },
    timeout: '3s',
  });

  sseConnections.add(1);

  check(response, {
    'SSE connection successful': (r) => r.status === 200,
    'SSE received events': (r) => r.body.includes('data:'),
  });

  sleep(1);
}

export function testWebSocket() {
  const agentId = `agent-${__VU}-${__ITER}`;
  const wsUrl = `ws://localhost:3284/api/agent/ws/${agentId}`;

  const response = ws.connect(wsUrl, {}, (socket) => {
    socket.on('open', () => {
      wsConnections.add(1);

      // Send 10 messages
      for (let i = 0; i < 10; i++) {
        const sendTime = Date.now();
        socket.send(JSON.stringify({ type: 'ping', timestamp: sendTime }));

        socket.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'pong') {
            const latency = Date.now() - message.timestamp;
            wsLatency.add(latency);
          }
        });

        sleep(0.1);
      }
    });

    socket.setTimeout(() => {
      socket.close();
    }, 2000);
  });

  check(response, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });

  sleep(1);
}
```

---

## 8. Test Infrastructure

### 8.1 Testcontainers Setup

**Helper Module**: `tests/utils/testcontainers.ts`

```typescript
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

export class TestInfrastructure {
  private containers: Map<string, StartedTestContainer> = new Map();

  async setupAgentAPI(): Promise<StartedTestContainer> {
    const container = await new GenericContainer('vibecode-agentapi:latest')
      .withExposedPorts(3284, 9090)
      .withEnvironment({
        AGENTAPI_PORT: '3284',
        AGENTAPI_LOG_LEVEL: 'debug',
        AGENTAPI_MAX_CONCURRENT_AGENTS: '3',
      })
      .withWaitStrategy(Wait.forHttp('/health', 3284))
      .withStartupTimeout(30000)
      .start();

    this.containers.set('agentapi', container);
    return container;
  }

  async setupPostgres(): Promise<StartedPostgreSqlContainer> {
    const container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('vibecode_test')
      .withUsername('test')
      .withPassword('test')
      .withExposedPorts(5432)
      .start();

    // Install pgvector extension
    await container.exec(['psql', '-U', 'test', '-d', 'vibecode_test', '-c', 'CREATE EXTENSION IF NOT EXISTS vector']);

    this.containers.set('postgres', container);
    return container;
  }

  async setupRedis(): Promise<StartedTestContainer> {
    const container = await new RedisContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();

    this.containers.set('redis', container);
    return container;
  }

  async teardown(): Promise<void> {
    for (const [name, container] of this.containers.entries()) {
      console.log(`Stopping container: ${name}`);
      await container.stop();
    }
    this.containers.clear();
  }

  getConnectionString(service: string): string {
    const container = this.containers.get(service);
    if (!container) {
      throw new Error(`Container ${service} not started`);
    }

    switch (service) {
      case 'postgres':
        return `postgresql://test:test@localhost:${container.getMappedPort(5432)}/vibecode_test`;
      case 'redis':
        return `redis://localhost:${container.getMappedPort(6379)}`;
      case 'agentapi':
        return `http://localhost:${container.getMappedPort(3284)}`;
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  }
}
```

### 8.2 Test Data Fixtures

**Fixture Library**: `tests/fixtures/index.ts`

```typescript
export const workflowFixtures = {
  codeReview: {
    name: 'code-review-test',
    version: '1.0.0',
    inputs: {
      files: ['src/lib/test.ts'],
      workspace: '/workspace/test',
    },
  },
  parallelRefactor: {
    name: 'parallel-refactor-test',
    version: '1.0.0',
    nodes: [
      {
        id: 'parallel-tasks',
        type: 'parallel',
        config: {
          nodes: [
            { id: 'task-1', type: 'agent-task', config: { agentType: 'aider' } },
            { id: 'task-2', type: 'agent-task', config: { agentType: 'goose' } },
            { id: 'task-3', type: 'agent-task', config: { agentType: 'cline' } },
          ],
        },
      },
    ],
  },
};

export const agentFixtures = {
  aider: {
    agentType: 'aider',
    config: {
      model: 'claude-3-5-sonnet-20241022',
      workspace: '/workspace/test',
    },
  },
  goose: {
    agentType: 'goose',
    config: {
      model: 'gpt-4o',
      workspace: '/workspace/test',
    },
  },
};

export const mockResponses = {
  agentStart: {
    agentId: 'test-agent-123',
    status: 'starting',
    pid: 12345,
  },
  agentStatus: {
    agentId: 'test-agent-123',
    status: 'running',
    uptime: 120,
    memory: 256000000,
    cpu: 5.2,
  },
};
```

---

## 9. CI/CD Integration

### 9.1 GitHub Actions Workflow

**File**: `.github/workflows/integration-tests.yml`

```yaml
name: Integration Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  integration-tests:
    runs-on: macos-14  # Apple Silicon runner
    timeout-minutes: 30

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_USER: test
          POSTGRES_DB: vibecode_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build AgentAPI container
        run: |
          cd docker/agentapi
          docker build -t vibecode-agentapi:latest .

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/vibecode_test
          REDIS_URL: redis://localhost:6379
        run: npm run test:integration

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: |
            test-results/
            playwright-report/

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: integration

  performance-tests:
    runs-on: macos-14
    needs: integration-tests
    if: github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4

      - name: Setup k6
        run: brew install k6

      - name: Start services
        run: |
          docker-compose -f docker-compose.agentapi.apple-silicon.yml up -d
          sleep 10

      - name: Run k6 load tests
        run: |
          k6 run tests/performance/k6/agentapi-load-test.js
          k6 run tests/performance/k6/streaming-load-test.js

      - name: Upload k6 results
        uses: actions/upload-artifact@v4
        with:
          name: k6-results
          path: k6-results.json
```

---

## 10. Test Execution Plan

### Phase 1: Foundation (Weeks 1-2)

**Priority**: CRITICAL
**Deliverables**:

1. **AgentAPI Integration Tests** (40 hours):
   - REST API endpoints (20 test cases)
   - gRPC protocol (15 test cases)
   - Agent lifecycle management (15 test cases)
   - Error handling (10 test cases)

2. **SSE/WebSocket Integration** (32 hours):
   - Connection management (12 test cases)
   - Message handling (10 test cases)
   - Performance validation (8 test cases)
   - Error scenarios (10 test cases)

3. **Testcontainers Infrastructure** (16 hours):
   - Setup helpers
   - Fixture library
   - CI/CD configuration

**Success Criteria**:
- 80+ integration tests passing
- Performance baselines established
- CI pipeline running tests on every PR

---

### Phase 2: Workflow & Database (Weeks 3-4)

**Priority**: HIGH
**Deliverables**:

1. **Workflow Engine Integration** (40 hours):
   - DAG execution (15 test cases)
   - Agent API integration (12 test cases)
   - Database persistence (10 test cases)
   - Performance validation (8 test cases)

2. **Database Integration** (32 hours):
   - Prisma operations (15 test cases)
   - Vector database (10 test cases)
   - Transactions (8 test cases)
   - Performance (5 test cases)

3. **E2E User Journeys** (24 hours):
   - Complete workflows (5 scenarios)
   - Error handling (3 scenarios)
   - Performance validation (3 scenarios)

**Success Criteria**:
- Workflow orchestration validated end-to-end
- Database integration robust
- E2E scenarios covering critical paths

---

### Phase 3: Performance & Container Runtime (Weeks 5-6)

**Priority**: HIGH
**Deliverables**:

1. **k6 Load Testing** (32 hours):
   - API load tests (3 scenarios)
   - Streaming load tests (2 scenarios)
   - Baseline establishment
   - CI integration

2. **Container Runtime Integration** (40 hours):
   - Apple Container Runtime (20 test cases)
   - VM orchestration (12 test cases)
   - Performance validation (8 test cases)

3. **Test Documentation** (16 hours):
   - Test strategy documentation
   - Runbook for test execution
   - Troubleshooting guide

**Success Criteria**:
- Performance baselines established
- Container runtime validated
- Complete test documentation

---

## 11. Test Metrics & Reporting

### Coverage Targets

| Component | Target Coverage | Current | Gap |
|-----------|----------------|---------|-----|
| AgentAPI Integration | 90% | 0% | 90% |
| SSE/WebSocket | 90% | 15% | 75% |
| Workflow Engine | 85% | 25% | 60% |
| Database Integration | 85% | 60% | 25% |
| Container Runtime | 80% | 0% | 80% |

### Performance Baselines

| Metric | Target | Test |
|--------|--------|------|
| Agent startup latency | < 2s | Integration test |
| SSE first event | < 50ms P95 | Load test |
| WebSocket round-trip | < 10ms P95 | Load test |
| Workflow parse time | < 50ms | Unit test |
| VM allocation | < 100ms | Integration test |
| API endpoint latency | < 200ms P95 | Load test |

### Test Execution Dashboard

**Metrics to Track**:
- Total test count
- Pass/fail rate
- Test execution time
- Coverage percentage by component
- Performance regression alerts
- Flaky test detection

---

## 12. Success Criteria

### Phase 1 Complete
- 80+ integration tests passing in CI
- AgentAPI REST/gRPC fully tested
- SSE/WebSocket integration validated
- Performance baselines established

### Phase 2 Complete
- Workflow engine validated end-to-end
- Database integration tests passing
- E2E scenarios covering critical paths
- Multi-agent coordination tested

### Phase 3 Complete
- k6 load tests running in CI
- Container runtime validated
- Performance benchmarks documented
- Test documentation complete

### Production Readiness
- 85%+ integration test coverage
- All critical paths validated
- Performance targets met
- Zero P0 bugs in test reports

---

## Appendix A: Test Commands

```bash
# Run all integration tests
npm run test:integration

# Run AgentAPI integration tests
npm run test:integration -- agentapi

# Run streaming integration tests
npm run test:integration -- streaming

# Run workflow integration tests
npm run test:integration -- workflow

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:performance

# Run k6 load tests
k6 run tests/performance/k6/agentapi-load-test.js

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/integration/agentapi/rest-api.test.ts
```

---

## Appendix B: Environment Setup

**Prerequisites**:
- Node.js 20+
- Docker Desktop or OrbStack
- PostgreSQL 16+ (or Testcontainers)
- Redis 7+ (or Testcontainers)
- k6 (for load testing)

**Environment Variables**:
```bash
# Test environment
export NODE_ENV=test
export DATABASE_URL=postgresql://test:test@localhost:5432/vibecode_test
export REDIS_URL=redis://localhost:6379
export AGENTAPI_URL=http://localhost:3284

# Test configuration
export TEST_TIMEOUT=30000
export MAX_CONCURRENT_AGENTS=3
export TESTCONTAINERS_RYUK_DISABLED=false
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-02
**Status**: Strategy Complete - Implementation Pending
**Next Review**: 2025-10-09
