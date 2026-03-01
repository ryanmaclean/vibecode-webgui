# Agent Orchestration Architecture
**Multi-Agent Framework & Coordination System**

**Version:** 1.0
**Date:** February 28, 2026
**Status:** Production

---

## Table of Contents

1. [Overview](#overview)
2. [Agent Framework Architecture](#agent-framework-architecture)
3. [Multi-Agent Coordination System](#multi-agent-coordination-system)
4. [Auto-Claude Orchestration](#auto-claude-orchestration)
5. [Agent Task Management](#agent-task-management)
6. [Communication Patterns](#communication-patterns)
7. [Memory & State Management](#memory--state-management)
8. [Tool & Capability System](#tool--capability-system)
9. [Integration Points](#integration-points)
10. [Security & Isolation](#security--isolation)

---

## Overview

The VibeCode platform implements a sophisticated multi-agent orchestration system that enables parallel task execution, autonomous agent coordination, and intelligent workflow management. The system consists of two primary orchestration layers:

1. **`.agents/` Framework** - Manual multi-agent coordination for complex project tasks
2. **`.auto-claude/` System** - Automated task orchestration with Claude Code integration

### Key Capabilities

- **Parallel Agent Execution** - Run multiple specialized agents simultaneously
- **Dependency Management** - Track and enforce task dependencies
- **Conflict Prevention** - Spatial and temporal separation of agent work
- **Memory Persistence** - Agent memory, beliefs, and learning across sessions
- **Tool Integration** - Unified tool framework for agent capabilities
- **Event-Driven Coordination** - Kafka-based agent communication

---

## Agent Framework Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React Agent Dashboard<br/>Agent Management UI]
        CLI[td CLI<br/>Task Management]
    end

    subgraph "Agent Framework Layer"
        FRAMEWORK[Agent Framework<br/>TypeScript Core]
        MEMORY[Agent Memory<br/>PostgreSQL + pgvector]
        TOOLS[Tool Registry<br/>Unified Tool System]
    end

    subgraph "Orchestration Layer"
        COORD[.agents/ Coordinator<br/>Multi-Agent Planning]
        AUTOCL[.auto-claude/<br/>Automated Orchestration]
        KAFKA[Kafka Event Bus<br/>Agent Communication]
    end

    subgraph "Execution Layer"
        AGENTS[Agent Pool<br/>Specialized Agents]
        WORKERS[Worker Pool<br/>Parallel Execution]
        RUNTIME[Agent Runtime<br/>Isolation & Sandboxing]
    end

    subgraph "Storage Layer"
        PG[(PostgreSQL<br/>Agent Memory & State)]
        REDIS[(Redis/Valkey<br/>Agent Cache)]
        FS[File System<br/>Task Artifacts]
    end

    UI --> FRAMEWORK
    CLI --> KAFKA
    FRAMEWORK --> MEMORY
    FRAMEWORK --> TOOLS
    COORD --> AGENTS
    AUTOCL --> WORKERS
    KAFKA --> AGENTS
    AGENTS --> RUNTIME
    MEMORY --> PG
    TOOLS --> REDIS
    RUNTIME --> FS

    style FRAMEWORK fill:#4A90E2
    style COORD fill:#E94E77
    style AUTOCL fill:#50C878
    style KAFKA fill:#FFB347
```

### Agent Framework Components

```mermaid
graph LR
    subgraph "Agent Core"
        BASE[Base Agent Class<br/>EventEmitter]
        LIFECYCLE[Lifecycle Manager<br/>Init/Run/Stop]
        STATE[State Machine<br/>Agent Status]
    end

    subgraph "Capabilities"
        TOOLS[Tool System<br/>Function Calling]
        MEMORY[Memory System<br/>Vector + Beliefs]
        PLANNING[Planning System<br/>Multi-Step Tasks]
    end

    subgraph "Communication"
        EVENTS[Event System<br/>Agent Events]
        MESSAGES[Message Queue<br/>Inter-Agent]
        API[Agent API<br/>External Interface]
    end

    subgraph "Providers"
        UNIFIED[UnifiedAIClient<br/>OpenAI/Anthropic/etc]
        DATADOG[Datadog APM<br/>Tracing]
        TELEMETRY[Telemetry<br/>Metrics]
    end

    BASE --> LIFECYCLE
    LIFECYCLE --> STATE
    BASE --> TOOLS
    BASE --> MEMORY
    BASE --> PLANNING
    STATE --> EVENTS
    EVENTS --> MESSAGES
    MESSAGES --> API
    TOOLS --> UNIFIED
    MEMORY --> UNIFIED
    PLANNING --> UNIFIED
    API --> DATADOG
    API --> TELEMETRY

    style BASE fill:#4A90E2
    style UNIFIED fill:#E94E77
    style MEMORY fill:#50C878
```

---

## Multi-Agent Coordination System

### .agents/ Directory Structure

The `.agents/` directory provides manual coordination for complex multi-agent projects:

```
.agents/
├── README.md                    # Agent assignment overview
├── COORDINATION.md              # Dependency graph & execution order
└── tasks/
    ├── agent-1-*.md            # Agent 1 task specification
    ├── agent-2-*.md            # Agent 2 task specification
    └── ...                     # Additional agent tasks
```

### Coordination Flow

```mermaid
sequenceDiagram
    participant PM as Project Manager
    participant COORD as Coordination Agent
    participant A1 as Agent 1 (Phase 1)
    participant A2 as Agent 2 (Phase 1)
    participant A3 as Agent 3 (Phase 2)
    participant GIT as Git Repository

    PM->>COORD: Define project goals
    COORD->>COORD: Decompose into tasks
    COORD->>COORD: Analyze dependencies
    COORD->>COORD: Assign agents

    Note over COORD: Create .agents/COORDINATION.md
    COORD->>A1: Assign Task 1 (no deps)
    COORD->>A2: Assign Task 2 (no deps)

    par Phase 1 (Parallel)
        A1->>A1: Execute task
        A1->>GIT: Commit results
        and
        A2->>A2: Execute task
        A2->>GIT: Commit results
    end

    A1->>COORD: Task 1 complete ✓
    A2->>COORD: Task 2 complete ✓

    COORD->>A3: Assign Task 3 (depends on 1,2)
    A3->>A3: Execute task
    A3->>GIT: Commit results
    A3->>COORD: Task 3 complete ✓

    COORD->>PM: All tasks complete
```

### Agent Specialization Types

| Agent Type | Domain | Typical Tasks | Tool Access |
|------------|--------|---------------|-------------|
| **quality-engineer** | Testing & QA | Test migration, coverage analysis | Jest, Playwright, testing tools |
| **security-engineer** | Security & Auth | Security hardening, auth flows | Security scanners, audit tools |
| **technical-writer** | Documentation | API docs, guides, tutorials | Markdown, diagram tools |
| **devops-architect** | Infrastructure | Docker, Kubernetes, CI/CD | kubectl, docker, terraform |
| **frontend-architect** | UI/UX | React components, styling | Browser tools, bundlers |
| **performance-engineer** | Optimization | Profiling, optimization | Datadog, profilers |
| **refactoring-expert** | Code Quality | Refactoring, linting | AST tools, linters |
| **system-architect** | System Design | Architecture, patterns | Design tools, planners |
| **python-expert** | Type Safety | Strong typing, validation | mypy, pylint, TypeScript |

### Dependency Management

```mermaid
graph TD
    subgraph "Phase 1: Foundation (Sequential)"
        A1[Agent 1<br/>VM Networking Test]
        A2[Agent 2<br/>macOS VM Workflow]
        A3[Agent 3<br/>Installation Scripts]
    end

    subgraph "Phase 2: Integration (Parallel)"
        A4[Agent 4<br/>Tailscale Integration]
        A8[Agent 8<br/>Let's Encrypt]
    end

    subgraph "Phase 3: Enhancement (Parallel)"
        A5[Agent 5<br/>Security Hardening]
        A7[Agent 7<br/>Apple Containers]
        A9[Agent 9<br/>Monitoring]
    end

    subgraph "Phase 4: Completion"
        A6[Agent 6<br/>Integration Testing]
        A10[Agent 10<br/>Documentation]
    end

    A1 --> A3
    A2 --> A3
    A3 --> A4
    A3 --> A8
    A3 --> A9
    A4 --> A8
    A4 --> A6
    A8 --> A6
    A5 --> A6
    A7 --> A6
    A9 --> A6
    A6 --> A10

    style A1 fill:#4A90E2
    style A3 fill:#E94E77
    style A6 fill:#50C878
    style A10 fill:#FFB347
```

---

## Auto-Claude Orchestration

### .auto-claude/ Directory Structure

The `.auto-claude/` system provides automated task orchestration:

```
.auto-claude/
├── specs/
│   └── {task-id}/
│       ├── spec.md                 # Task specification
│       ├── implementation_plan.json # Execution plan
│       ├── context.json            # Task context
│       ├── build-progress.txt      # Progress tracking
│       ├── task_metadata.json      # Metadata
│       ├── task_logs.json          # Execution logs
│       └── memory/
│           ├── build_commits.json  # Commit history
│           └── attempt_history.json # Retry tracking
└── worktrees/
    └── tasks/
        └── {task-id}/              # Isolated git worktree
```

### Auto-Claude Architecture

```mermaid
graph TB
    subgraph "Planning Layer"
        SPEC[Task Specification<br/>spec.md]
        PLAN[Implementation Plan<br/>JSON with phases]
        CONTEXT[Context Builder<br/>Code analysis]
    end

    subgraph "Execution Layer"
        WORKER[Task Worker<br/>Claude Code Agent]
        SUBTASK[Subtask Executor<br/>Isolated execution]
        VERIFY[Verification Engine<br/>Test runner]
    end

    subgraph "State Management"
        PROGRESS[Progress Tracker<br/>build-progress.txt]
        MEMORY[Memory System<br/>Discoveries & gotchas]
        LOGS[Log Aggregator<br/>task_logs.json]
    end

    subgraph "Integration Layer"
        WORKTREE[Git Worktree<br/>Isolated branch]
        COMMIT[Commit Manager<br/>Atomic commits]
        PR[PR Creator<br/>GitHub integration]
    end

    SPEC --> PLAN
    PLAN --> CONTEXT
    CONTEXT --> WORKER
    WORKER --> SUBTASK
    SUBTASK --> VERIFY
    VERIFY --> PROGRESS
    WORKER --> MEMORY
    SUBTASK --> LOGS
    WORKER --> WORKTREE
    VERIFY --> COMMIT
    COMMIT --> PR

    style WORKER fill:#4A90E2
    style PLAN fill:#E94E77
    style MEMORY fill:#50C878
    style WORKTREE fill:#FFB347
```

### Task Workflow

```mermaid
sequenceDiagram
    participant USER as User
    participant AC as Auto-Claude
    participant PLAN as Plan Generator
    participant WORKER as Task Worker
    participant GIT as Git Worktree
    participant CI as GitHub CI

    USER->>AC: Submit task specification
    AC->>PLAN: Generate implementation plan
    PLAN->>PLAN: Decompose into phases/subtasks
    PLAN->>PLAN: Analyze dependencies
    PLAN-->>AC: Return execution plan

    loop For each phase
        loop For each subtask
            AC->>WORKER: Assign subtask
            WORKER->>GIT: Create isolated worktree
            WORKER->>WORKER: Execute implementation
            WORKER->>WORKER: Run verification

            alt Verification passes
                WORKER->>GIT: Commit changes
                WORKER->>AC: Mark subtask complete
            else Verification fails
                WORKER->>WORKER: Retry with fixes
            end
        end
    end

    AC->>GIT: Merge worktree to branch
    AC->>CI: Create pull request
    CI->>CI: Run full test suite
    CI-->>USER: PR ready for review
```

### Implementation Plan Structure

```json
{
  "feature": "Task description",
  "workflow_type": "simple|complex",
  "phases": [
    {
      "id": "phase-1",
      "name": "Phase Name",
      "type": "implementation|verification",
      "depends_on": [],
      "parallel_safe": true,
      "subtasks": [
        {
          "id": "subtask-1-1",
          "description": "Task description",
          "service": "rig|docs|td|etc",
          "files_to_modify": [],
          "files_to_create": [],
          "patterns_from": [],
          "verification": {
            "type": "manual|command",
            "instructions": "Verification steps"
          },
          "status": "pending|in_progress|completed"
        }
      ]
    }
  ],
  "summary": {
    "total_phases": 3,
    "total_subtasks": 8,
    "services_involved": ["rig", "docs"],
    "parallelism": {
      "max_parallel_phases": 2,
      "recommended_workers": 1
    }
  }
}
```

---

## Agent Task Management

### Task Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Ideation: User creates task
    Ideation --> Specification: Detailed spec written
    Specification --> Planning: Generate execution plan
    Planning --> Ready: Plan approved
    Ready --> InProgress: Worker assigned
    InProgress --> Verification: Implementation complete
    Verification --> InProgress: Tests fail
    Verification --> Completed: Tests pass
    Completed --> Review: PR created
    Review --> InProgress: Changes requested
    Review --> Merged: Approved
    Merged --> [*]

    InProgress --> Blocked: Dependency issue
    Blocked --> InProgress: Issue resolved
```

### Task Metadata Schema

Stored in `.auto-claude/specs/{task-id}/task_metadata.json`:

```typescript
interface TaskMetadata {
  task_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  assigned_worker?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  labels: string[];
  estimated_hours?: number;
  actual_hours?: number;
}
```

### Memory & Discovery System

Auto-Claude agents maintain persistent memory:

```typescript
// Record codebase discoveries
interface Discovery {
  file_path: string;
  description: string;
  category: 'architecture' | 'pattern' | 'config' | 'gotcha';
  discovered_at: string;
}

// Record gotchas and pitfalls
interface Gotcha {
  gotcha: string;
  context: string;
  recorded_at: string;
}

// Build commits tracking
interface BuildCommit {
  commit_hash: string;
  message: string;
  files_changed: string[];
  timestamp: string;
  subtask_id: string;
}
```

---

## Communication Patterns

### Kafka-Based Agent Communication

```mermaid
graph TB
    subgraph "Agent Producers"
        TD[td CLI<br/>Go Producer]
        RIG[rig Service<br/>Node.js Producer]
        BRIDGE[Gitea Bridge<br/>Webhook Producer]
    end

    subgraph "Kafka Topics"
        CREATED[tundra-beads-created<br/>New task events]
        WORK[tundra-beads-work<br/>Work assignments]
        PROGRESS[tundra-beads-in-progress<br/>Status updates]
        COMPLETE[tundra-beads-completed<br/>Completion events]
        NUDGES[tundra-nudges<br/>Notifications]
        GIT[gitea-webhooks<br/>Git events]
    end

    subgraph "Agent Consumers"
        AIRFLOW[Airflow DAG<br/>Workflow triggers]
        TDCONS[td Consumer<br/>Task updates]
        DSM[Kafka DSM<br/>Data Stream Manager]
    end

    TD --> CREATED
    TD --> WORK
    TD --> PROGRESS
    TD --> COMPLETE
    TD --> NUDGES
    RIG --> CREATED
    BRIDGE --> GIT

    CREATED --> AIRFLOW
    CREATED --> TDCONS
    WORK --> TDCONS
    PROGRESS --> TDCONS
    COMPLETE --> AIRFLOW
    COMPLETE --> TDCONS
    GIT --> TDCONS
    CREATED --> DSM
    COMPLETE --> DSM

    style CREATED fill:#4A90E2
    style AIRFLOW fill:#E94E77
    style TD fill:#50C878
```

### Event-Driven Coordination

**Kafka Topics for Agent Orchestration:**

| Topic | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `tundra-beads-created` | td, rig | airflow, td | New task/agent creation |
| `tundra-beads-work` | td | td, airflow | Work assignment events |
| `tundra-beads-in-progress` | td | td | Agent status updates |
| `tundra-beads-completed` | td | td, airflow | Task completion events |
| `tundra-nudges` | td | td | Agent notifications |
| `gitea-webhooks` | gitea-bridge | td | Git repository events |

### Inter-Agent Message Format

```typescript
interface AgentMessage {
  id: string;
  timestamp: string;
  source_agent: string;
  target_agent?: string; // null for broadcast
  type: 'task' | 'status' | 'result' | 'error' | 'coordinate';
  payload: {
    task_id?: string;
    status?: string;
    data?: any;
    error?: string;
  };
  metadata: {
    priority: number;
    ttl?: number;
    requires_ack: boolean;
  };
}
```

---

## Memory & State Management

### Agent Memory Architecture

```mermaid
graph TB
    subgraph "Memory Types"
        EPISODIC[Episodic Memory<br/>Conversation history]
        SEMANTIC[Semantic Memory<br/>Knowledge & beliefs]
        PROCEDURAL[Procedural Memory<br/>Tool usage patterns]
    end

    subgraph "Storage Backends"
        PG[(PostgreSQL<br/>Structured data)]
        VECTOR[(pgvector<br/>Embeddings)]
        REDIS[(Redis<br/>Short-term cache)]
    end

    subgraph "Memory Operations"
        STORE[Store Memory]
        RECALL[Recall Memory]
        UPDATE[Update Beliefs]
        PRUNE[Prune Old Memory]
    end

    EPISODIC --> STORE
    SEMANTIC --> STORE
    PROCEDURAL --> STORE
    STORE --> PG
    STORE --> VECTOR
    STORE --> REDIS

    RECALL --> PG
    RECALL --> VECTOR
    RECALL --> REDIS

    UPDATE --> VECTOR
    PRUNE --> PG

    style VECTOR fill:#4A90E2
    style SEMANTIC fill:#E94E77
    style STORE fill:#50C878
```

### PostgreSQL Schema for Agent Memory

```sql
-- Agent memory storage
CREATE TABLE agent_memory (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  memory_type VARCHAR(50) NOT NULL, -- 'episodic', 'semantic', 'procedural'
  content TEXT NOT NULL,
  embedding vector(1536), -- pgvector for similarity search
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  accessed_at TIMESTAMP DEFAULT NOW(),
  access_count INTEGER DEFAULT 0
);

-- Agent beliefs and knowledge
CREATE TABLE agent_beliefs (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  belief_key VARCHAR(255) NOT NULL,
  belief_value JSONB NOT NULL,
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  source VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, belief_key)
);

-- Agent sessions and state
CREATE TABLE agent_sessions (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  state JSONB NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active'
);
```

### Memory Retrieval Patterns

**Similarity Search:**
```sql
-- Find similar memories using vector embeddings
SELECT content, metadata, 1 - (embedding <=> $1::vector) as similarity
FROM agent_memory
WHERE agent_id = $2 AND memory_type = $3
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

**Temporal Retrieval:**
```sql
-- Get recent episodic memories
SELECT content, metadata, created_at
FROM agent_memory
WHERE agent_id = $1 AND memory_type = 'episodic'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Tool & Capability System

### Unified Tool Framework

```mermaid
graph LR
    subgraph "Tool Categories"
        FS[File System<br/>Read/Write/Edit]
        CODE[Code Tools<br/>Grep/AST/Lint]
        GIT[Git Tools<br/>Commit/Branch/PR]
        WEB[Web Tools<br/>Fetch/Search]
        EXEC[Execution<br/>Bash/Docker]
    end

    subgraph "Tool Registry"
        REG[Tool Registry<br/>Central catalog]
        AUTH[Authorization<br/>Permission checks]
        RATE[Rate Limiting<br/>Usage quotas]
    end

    subgraph "Tool Execution"
        VALIDATE[Input Validation]
        EXECUTE[Execute Tool]
        TRACE[Trace & Log]
        RESULT[Return Result]
    end

    FS --> REG
    CODE --> REG
    GIT --> REG
    WEB --> REG
    EXEC --> REG

    REG --> AUTH
    AUTH --> VALIDATE
    VALIDATE --> EXECUTE
    EXECUTE --> TRACE
    TRACE --> RESULT

    style REG fill:#4A90E2
    style AUTH fill:#E94E77
    style EXECUTE fill:#50C878
```

### Tool Definition Schema

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  category: 'filesystem' | 'code' | 'git' | 'web' | 'execution';
  parameters: {
    [key: string]: {
      type: string;
      description: string;
      required: boolean;
      default?: any;
    };
  };
  execute: (params: Record<string, any>) => Promise<ToolResult>;
  permissions: string[];
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    tokensUsed?: number;
  };
}
```

### Agent Tool Access Matrix

| Tool | quality-engineer | security-engineer | devops-architect | technical-writer |
|------|------------------|-------------------|------------------|------------------|
| **Read** | ✓ | ✓ | ✓ | ✓ |
| **Write** | ✓ | ✓ | ✓ | ✓ |
| **Edit** | ✓ | ✓ | ✓ | ✓ |
| **Bash** | ✓ | ✓ | ✓ | ✗ |
| **Git** | ✓ | ✓ | ✓ | ✓ |
| **Docker** | ✗ | ✓ | ✓ | ✗ |
| **Kubectl** | ✗ | ✓ | ✓ | ✗ |
| **WebFetch** | ✓ | ✓ | ✓ | ✓ |

---

## Integration Points

### Platform Integration Architecture

```mermaid
graph TB
    subgraph "Agent Layer"
        AGENT[Agent Framework]
    end

    subgraph "Service Integration"
        RIG[rig - Next.js<br/>Web UI & API]
        TD[td - Go CLI<br/>Task management]
        AIRFLOW[Airflow<br/>Workflow automation]
        DAEMON[daemon<br/>Event bridges]
    end

    subgraph "Data Integration"
        PG[(PostgreSQL<br/>Agent memory)]
        REDIS[(Redis<br/>Agent cache)]
        KAFKA[Kafka<br/>Event bus]
    end

    subgraph "External Integration"
        GITHUB[GitHub<br/>PR creation]
        DATADOG[Datadog<br/>APM & metrics]
        AI[AI Providers<br/>OpenAI/Anthropic]
    end

    AGENT --> RIG
    AGENT --> TD
    AGENT --> AIRFLOW
    AGENT --> DAEMON

    RIG --> PG
    RIG --> REDIS
    TD --> KAFKA
    DAEMON --> KAFKA

    AGENT --> GITHUB
    AGENT --> DATADOG
    AGENT --> AI

    style AGENT fill:#4A90E2
    style KAFKA fill:#E94E77
    style PG fill:#50C878
```

### API Endpoints

**Agent Management API (rig):**

```typescript
// Create new agent
POST /api/agents
{
  "type": "quality-engineer",
  "task": "Test migration",
  "config": { ... }
}

// Get agent status
GET /api/agents/:agentId

// List active agents
GET /api/agents?status=active

// Update agent configuration
PATCH /api/agents/:agentId

// Terminate agent
DELETE /api/agents/:agentId
```

**Task Management API (td CLI):**

```bash
# Create new task/bead
td create "Task description"

# Assign task to agent
td assign <bead-id> --agent=agent-1

# Check task status
td status <bead-id>

# Complete task
td complete <bead-id>

# Monitor Kafka events
td kafka status
```

---

## Security & Isolation

### Agent Isolation Architecture

```mermaid
graph TB
    subgraph "Isolation Layers"
        WORKSPACE[Workspace Isolation<br/>Separate directories]
        WORKTREE[Git Worktree Isolation<br/>Separate branches]
        PROCESS[Process Isolation<br/>Separate processes]
        NETWORK[Network Isolation<br/>Sandboxed access]
    end

    subgraph "Permission System"
        RBAC[Role-Based Access<br/>Agent roles]
        FILEACL[File ACLs<br/>Directory restrictions]
        TOOLAUTH[Tool Authorization<br/>Capability limits]
    end

    subgraph "Security Controls"
        AUDIT[Audit Logging<br/>All agent actions]
        RATE[Rate Limiting<br/>API quotas]
        SANDBOX[Sandbox Execution<br/>Command restrictions]
    end

    WORKSPACE --> RBAC
    WORKTREE --> FILEACL
    PROCESS --> TOOLAUTH
    NETWORK --> SANDBOX

    RBAC --> AUDIT
    FILEACL --> AUDIT
    TOOLAUTH --> RATE
    SANDBOX --> RATE

    style RBAC fill:#4A90E2
    style AUDIT fill:#E94E77
    style SANDBOX fill:#50C878
```

### Security Best Practices

**1. Workspace Isolation**
- Each agent operates in isolated `.auto-claude/worktrees/tasks/{task-id}/` directory
- Git worktrees prevent branch conflicts
- File system permissions enforce directory boundaries

**2. Permission Model**
```typescript
interface AgentPermissions {
  allowedTools: string[];
  allowedPaths: string[];
  allowedBashCommands: string[];
  maxFileSize: number;
  maxExecutionTime: number;
  networkAccess: 'none' | 'limited' | 'full';
}
```

**3. Audit Trail**
- All agent actions logged to `.auto-claude/specs/{task-id}/task_logs.json`
- Git commits signed with agent identity
- Tool usage tracked in Datadog APM

**4. Secrets Management**
- API keys stored in environment variables or macOS Keychain
- Never commit secrets to git
- Auto-detect and prevent secret leakage

**5. Command Sandboxing**
```typescript
// Bash command restrictions
const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'dd if=/dev/zero',
  'fork bomb',
  ':(){ :|:& };:',
];

// Validate before execution
function validateCommand(cmd: string): boolean {
  return !DANGEROUS_COMMANDS.some(danger => cmd.includes(danger));
}
```

---

## Related Documentation

- [Multi-Agent Coordination Methodology](../wiki/guides/multi-agent-coordination.md)
- [Service Dependencies Map](../../SERVICE_DEPENDENCIES.md)
- [Architecture Diagram](../ARCHITECTURE_DIAGRAM.md)
- [Folder Structure](../FOLDER_STRUCTURE.md)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-28 | Initial architecture documentation |

---

**Maintained by:** Platform Architecture Team
**Last Reviewed:** February 28, 2026
