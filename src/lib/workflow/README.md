# Workflow Orchestration Engine

Production-grade DAG-based workflow execution system for coordinating multiple AI agents.

## Features

- **DAG Execution**: Topological sort with automatic dependency resolution
- **Parallel Execution**: Concurrent node execution with configurable limits
- **Visual Editor**: React Flow-based drag-and-drop workflow builder
- **Template Library**: 5+ pre-built workflows for common scenarios
- **State Management**: Checkpoint-based execution resumption
- **Real-time Monitoring**: Live execution visualization with detailed logs

## Performance Targets

- ✅ Workflow parse time: <50ms
- ✅ Execution overhead: <100ms per node
- ✅ Support 20+ node workflows

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Engine                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Parser     │→ │   Executor   │→ │   Monitor    │     │
│  │  (YAML/JSON) │  │   (DAG)      │  │ (Real-time)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
         ↓                   ↓                   ↓
┌─────────────────────────────────────────────────────────────┐
│              Integration Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Agent API   │  │   Database   │  │ Observability│     │
│  │  (Agent 4)   │  │  (Agent 3)   │  │  (Agent 7)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Execute Pre-built Template

```typescript
import { executeWorkflowTemplate } from '@/lib/workflow';

// Execute code review workflow
const execution = await executeWorkflowTemplate('code-review', {
  workspace: '/home/coder/workspace/my-project',
  files: ['src/main.ts', 'src/utils.ts'],
});

console.log('Workflow completed:', execution.status);
```

### 2. Create Custom Workflow (YAML)

```yaml
name: custom-workflow
version: 1.0.0
description: My custom workflow

inputs:
  workspace:
    type: string
    required: true

nodes:
  - id: analyze
    type: agent-task
    name: Analyze Code
    config:
      agentType: cline
      model: claude-3-5-sonnet-20241022
      task: Analyze code in ${input.workspace}
      workspace: ${input.workspace}

  - id: fix
    type: agent-task
    name: Fix Issues
    config:
      agentType: aider
      model: claude-3-5-sonnet-20241022
      task: Fix issues found: ${nodes.analyze.output.issues}
      workspace: ${input.workspace}

edges:
  - source: analyze
    target: fix
```

Execute from YAML:

```typescript
import { executeWorkflowFromYAML } from '@/lib/workflow';
import fs from 'fs';

const yaml = fs.readFileSync('workflow.yaml', 'utf-8');
const execution = await executeWorkflowFromYAML(yaml, {
  workspace: '/home/coder/workspace/my-project',
});
```

### 3. Programmatic Workflow Definition

```typescript
import { WorkflowEngine, createWorkflowEngine } from '@/lib/workflow';
import type { WorkflowDefinition } from '@/lib/workflow/types';

const workflow: WorkflowDefinition = {
  name: 'parallel-tasks',
  version: '1.0.0',
  nodes: [
    {
      id: 'task1',
      type: 'agent-task',
      name: 'Task 1',
      config: {
        agentType: 'aider',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Refactor module A',
      },
    },
    {
      id: 'task2',
      type: 'agent-task',
      name: 'Task 2',
      config: {
        agentType: 'aider',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Refactor module B',
      },
    },
    {
      id: 'merge',
      type: 'merge',
      name: 'Merge Results',
      config: {
        strategy: 'all',
      },
    },
  ],
  edges: [
    { source: 'task1', target: 'merge' },
    { source: 'task2', target: 'merge' },
  ],
};

const engine = createWorkflowEngine();
const execution = await engine.executeWorkflow(workflow, {});
```

## Node Types

### 1. Agent Task (`agent-task`)

Execute AI agent with specific task.

```yaml
type: agent-task
config:
  agentType: aider | goose | cline | continue
  model: claude-3-5-sonnet-20241022
  task: "Task description with ${variables}"
  workspace: /path/to/workspace
  files: ['file1.ts', 'file2.ts']
  inputs:
    param1: "nodes.previous.output.value"
  outputs:
    result: "output.result"
```

### 2. Condition (`condition`)

Conditional branching based on expression.

```yaml
type: condition
config:
  expression: "nodes.analyze.issues.length > 0"
  branches:
    - name: has-issues
      condition: "true"
      target: fix-node
    - name: no-issues
      condition: "false"
      target: complete-node
```

### 3. Parallel (`parallel`)

Execute multiple branches concurrently.

```yaml
type: parallel
config:
  maxConcurrency: 5
  waitForAll: true
  failFast: false
```

### 4. Merge (`merge`)

Merge results from parallel branches.

```yaml
type: merge
config:
  strategy: all | any | first | custom
  mergeFunction: "custom JavaScript function"
```

### 5. Loop (`loop`)

Iterate over collection.

```yaml
type: loop
config:
  items: "input.files"
  itemVar: "file"
  indexVar: "i"
  maxIterations: 10
  continueCondition: "item.size < 1000000"
```

### 6. Transform (`transform`)

Transform data using JavaScript expression.

```yaml
type: transform
config:
  transform: "{ total: nodes.task1.count + nodes.task2.count }"
  inputs: ['task1', 'task2']
  output: "summary"
```

### 7. Delay (`delay`)

Wait for specified duration.

```yaml
type: delay
config:
  duration: 5000  # milliseconds
  durationExpression: "nodes.previous.output.delay"
```

### 8. Webhook (`webhook`)

Call external HTTP endpoint.

```yaml
type: webhook
config:
  url: "https://api.example.com/notify"
  method: POST
  headers:
    Authorization: "Bearer ${input.token}"
  body: '{"status": "${nodes.task.status}"}'
  expectedStatus: [200, 201]
```

## Template Variables

Access workflow context using template expressions:

```yaml
# Input variables
task: "Process ${input.filename}"

# Node outputs
task: "Fix issues: ${nodes.analyze.output.issues}"

# Global variables
workspace: "${globals.workspace_root}/project"

# Loop context
task: "Process file ${loops.files.item} (${loops.files.index}/${loops.files.total})"
```

## Built-in Workflows

### 1. Code Review

Claude analyze → Aider fix → Continue test

```typescript
await executeWorkflowTemplate('code-review', {
  workspace: '/home/coder/workspace',
  files: ['src/main.ts'],
});
```

### 2. Parallel Refactoring

Multiple agents working on different modules simultaneously.

```typescript
await executeWorkflowTemplate('parallel-refactoring', {
  workspace: '/home/coder/workspace',
  modules: ['auth', 'database', 'api'],
});
```

### 3. Documentation Synthesis

Multi-agent documentation generation.

```typescript
await executeWorkflowTemplate('documentation', {
  workspace: '/home/coder/workspace',
  scope: 'api',
});
```

### 4. Feature Development

End-to-end feature implementation with testing.

```typescript
await executeWorkflowTemplate('feature-development', {
  workspace: '/home/coder/workspace',
  featureSpec: 'Add user authentication',
});
```

### 5. Bug Fix

Automated bug investigation and fixing.

```typescript
await executeWorkflowTemplate('bug-fix', {
  workspace: '/home/coder/workspace',
  bugDescription: 'Login page crashes on submit',
});
```

## Visual Workflow Builder

```typescript
import { WorkflowEditor } from '@/components/workflow/WorkflowEditor';

function MyWorkflowPage() {
  return (
    <WorkflowEditor
      workflow={initialWorkflow}
      onChange={handleChange}
      onSave={handleSave}
      onExecute={handleExecute}
    />
  );
}
```

Features:
- Drag-and-drop node palette
- Visual connection editor
- Real-time validation
- Node configuration panel
- Export to YAML

## Execution Monitoring

```typescript
import { WorkflowExecutionViewer } from '@/components/workflow/WorkflowExecutionViewer';

function MyExecutionPage() {
  return (
    <WorkflowExecutionViewer
      execution={execution}
      showLogs={true}
    />
  );
}
```

Features:
- Real-time status updates
- Node execution timeline
- Detailed logs per node
- Error tracking
- Progress visualization

## Integration

### With Agent API (Agent 4)

```typescript
import { createAgentExecutor } from '@/lib/workflow/integration';

const agentClient = createAgentAPIClient();
const executor = createAgentExecutor(agentClient);

const engine = createWorkflowEngine();
engine.registerAgentExecutor(executor);
```

### With Database (Agent 3)

```typescript
import { saveWorkflowExecution } from '@/lib/workflow/integration';

engine.on('event', async (event) => {
  if (event.type === 'workflow.completed') {
    await saveWorkflowExecution(execution, databaseClient);
  }
});
```

### With Observability (Agent 7)

```typescript
import { createWorkflowMonitor } from '@/lib/workflow/integration';

const monitor = createWorkflowMonitor(metricsClient);

engine.on('event', (event) => {
  if (event.type === 'workflow.started') {
    monitor.trackWorkflowStart(event.data.workflowId, event.data.version);
  }
});
```

## Error Handling

### Retry Policy

```yaml
config:
  retryPolicy:
    maxAttempts: 3
    delay: 5000
    backoff: exponential
    maxDelay: 30000
    retryOn: ['TIMEOUT', 'AGENT_ERROR']
```

### Continue on Error

```yaml
nodes:
  - id: optional-task
    type: agent-task
    continueOnError: true
    config: ...
```

### Checkpointing

```yaml
config:
  enableCheckpoints: true
  checkpointInterval: 60000  # 1 minute
```

Resume from checkpoint:

```typescript
await engine.resumeExecution(executionId, checkpointId);
```

## Performance Optimization

### Concurrency Control

```yaml
config:
  maxConcurrency: 5  # Global limit
```

Per-node:

```yaml
nodes:
  - type: parallel
    config:
      maxConcurrency: 3  # Per-branch limit
```

### Timeout Configuration

```yaml
config:
  timeout: 1800000  # 30 minutes global

nodes:
  - id: long-task
    timeout: 600000  # 10 minutes per node
```

### Resource Management

Monitor resource usage:

```typescript
const stats = execution.metadata;
console.log('Duration:', stats.duration);
console.log('Nodes:', execution.nodes.size);
```

## Testing

### Unit Tests

```typescript
import { WorkflowEngine } from '@/lib/workflow';
import { describe, it, expect } from '@jest/globals';

describe('WorkflowEngine', () => {
  it('should execute simple workflow', async () => {
    const engine = new WorkflowEngine();

    const workflow = {
      name: 'test',
      version: '1.0.0',
      nodes: [/* ... */],
      edges: [],
    };

    const execution = await engine.executeWorkflow(workflow, {});
    expect(execution.status).toBe('completed');
  });
});
```

### Integration Tests

```typescript
it('should execute workflow with agent integration', async () => {
  const mockAgent = jest.fn().mockResolvedValue({ result: 'success' });

  engine.registerAgentExecutor(mockAgent);

  const execution = await engine.executeWorkflow(workflow, {});

  expect(mockAgent).toHaveBeenCalledTimes(1);
  expect(execution.status).toBe('completed');
});
```

## API Reference

See [types.ts](./types.ts) for complete type definitions.

### WorkflowEngine

- `parseWorkflow(definition)`: Validate workflow definition
- `executeWorkflow(definition, inputs)`: Execute workflow
- `getExecution(id)`: Get execution by ID
- `resumeExecution(id, checkpointId)`: Resume from checkpoint
- `cancelExecution(id)`: Cancel running execution
- `registerAgentExecutor(executor)`: Register agent execution function

### Events

- `workflow.started`: Workflow execution started
- `workflow.completed`: Workflow completed successfully
- `workflow.failed`: Workflow execution failed
- `node.started`: Node execution started
- `node.completed`: Node completed successfully
- `node.failed`: Node execution failed
- `checkpoint.created`: Checkpoint created

## License

MIT
