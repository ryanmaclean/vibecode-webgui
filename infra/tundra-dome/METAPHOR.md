# Tundra Dome Metaphor Specification

A consistent vocabulary for describing distributed systems across Kubernetes, Airflow, Kafka, and application code.

## Core Philosophy

The Tundra Dome metaphor treats infrastructure as a **frontier settlement** where:
- **Work flows like trade goods** (beads) through processing lanes
- **Specialized workers** (polecats, reapers, witnesses) handle specific tasks
- **Communication happens through defined channels** (nudges, whispers, mail)
- **Governance structures** (mayors, deacons, overseers) coordinate activity

## Settlement Hierarchy

```
Dome (Cluster)
├── Town (Namespace)
│   ├── Rig (Node)
│   │   ├── Polecat (Pod)
│   │   ├── Polecat (Pod)
│   │   └── ...
│   ├── Crew (Deployment)
│   ├── Patrol (DaemonSet)
│   └── Station (Service)
└── Town (Namespace)
    └── ...
```

### Settlements

| Metaphor | K8s Primitive | Description |
|----------|---------------|-------------|
| **Dome** | Cluster | The entire settlement - one logical system |
| **Town** | Namespace | A district within the dome with its own resources |
| **Rig** | Node | Physical or virtual machine providing compute |

### Workers

| Metaphor | K8s Primitive | Description |
|----------|---------------|-------------|
| **Polecat** | Pod | Individual worker instance, runs one task type |
| **Crew** | Deployment | Group of identical polecats, auto-scaled |
| **Patrol** | DaemonSet | Polecats stationed on every rig (monitoring, logging) |
| **Contractor** | Job | One-time worker, dismissed when complete |
| **Routine** | CronJob | Scheduled contractor work |

## Roles (Agent Types)

Specialized polecats with defined responsibilities:

| Role | Responsibility | Kafka Topic |
|------|----------------|-------------|
| **Mayor** | Orchestration, scheduling, high-level commands | `tundra-mayor-commands` |
| **Deacon** | CI/CD, builds, deployments, releases | `tundra-deacon-commands` |
| **Polecat** | General worker, executes tasks | `tundra-polecat-commands` |
| **Reaper** | Cleanup, garbage collection, pruning | `tundra-reaper-commands` |
| **Witness** | Observation, logging, auditing | `tundra-witness-commands` |
| **Overseer** | Validation, quality checks, enforcement | `tundra-overseer-commands` |

## Work Units

### Beads

A **Bead** is the atomic unit of work - an issue, PR, task, or request that flows through the system.

```yaml
apiVersion: tundra.dome/v1
kind: Bead
metadata:
  name: fix-login-bug-123
spec:
  source: github
  sourceId: "123"
  title: "Fix login timeout bug"
  lane: standard
  assignedRole: polecat
status:
  phase: in-progress
  attempts: 1
  lastTransition: "2026-02-04T00:30:00Z"
```

**Bead Lifecycle:**
```
created → in-progress → completed
                     ↘ escalated → (re-assigned)
                     ↘ failed → (dead-letter)
```

### Lanes

**Lanes** are priority queues that determine processing order:

| Lane | Kafka Topic | Description |
|------|-------------|-------------|
| **Critical** | `tundra-lane-critical-beads` | Urgent, SLA-bound work |
| **Standard** | `tundra-lane-standard-beads` | Normal priority work |
| **Experimental** | `tundra-lane-experimental-beads` | Low-priority, can fail |

### Playbooks (Airflow DAGs)

A **Playbook** is a sequence of steps to accomplish a goal:

| Playbook | DAG ID | Purpose |
|----------|--------|---------|
| `github-sync` | `tundra_github_ollama` | Sync GitHub issues to beads |
| `lane-router` | `tundra_lane_router` | Route beads to correct lanes |
| `kafka-emit` | `tundra_dome_kafka_emit` | Emit events to Kafka |
| `integrations-tick` | `tundra_dome_integrations` | Periodic integration health checks |

### Errands (Airflow Tasks)

An **Errand** is a single step within a playbook:

```python
@task(task_id="fetch_issues")
def fetch_issues_errand():
    """Errand: Fetch open issues from GitHub"""
    pass

@task(task_id="create_beads")
def create_beads_errand(issues):
    """Errand: Convert issues to beads"""
    pass
```

## Communication

### Kafka Topics by Category

**Commands** (directives to roles):
- `tundra-mayor-commands`
- `tundra-deacon-commands`
- `tundra-polecat-commands`
- `tundra-reaper-commands`
- `tundra-witness-commands`
- `tundra-overseer-commands`

**Bead Lifecycle**:
- `tundra-beads-created`
- `tundra-beads-in-progress`
- `tundra-beads-completed`
- `tundra-beads-escalated`
- `tundra-beads-failed`

**Lanes**:
- `tundra-lane-critical-beads`
- `tundra-lane-standard-beads`
- `tundra-lane-experimental-beads`

**Errand Lifecycle** (task-level events):
- `tundra-errands-queued` - Task queued for execution
- `tundra-errands-running` - Task started execution
- `tundra-errands-success` - Task completed successfully
- `tundra-errands-failed` - Task failed
- `tundra-errands-retry` - Task being retried
- `tundra-errands-skipped` - Task skipped (upstream failed or condition)

**Communication**:
- `tundra-nudges` - Notifications, reminders
- `tundra-whispers` - Private/internal messages
- `tundra-mail-outbox` - Outbound formal messages
- `tundra-mail-inbox` - Inbound formal messages

**Operations**:
- `tundra-work-intake` - New work entering the system
- `tundra-audit-actions` - Compliance/audit log
- `tundra-metrics-kpi` - KPI snapshots
- `tundra-schema-dlq` - Dead letter queue for schema errors

## Infrastructure

| Metaphor | K8s Primitive | Description |
|----------|---------------|-------------|
| **Station** | Service | Network endpoint for communication |
| **Codex** | ConfigMap | Shared configuration |
| **Vault** | Secret | Protected credentials |
| **Storehouse** | PersistentVolume | Durable storage |
| **Law** | CRD | Custom resource definition |
| **Guild** | Airflow Pool | Resource quota for workers |

## Labels and Annotations

### Standard Labels

```yaml
metadata:
  labels:
    tundra.dome/role: polecat|mayor|deacon|reaper|witness|overseer
    tundra.dome/town: gas-town|tundra-dome
    tundra.dome/crew: kafka-consumers|airflow-workers
    tundra.dome/lane: critical|standard|experimental
```

### Standard Annotations

```yaml
metadata:
  annotations:
    tundra.dome/playbook: "tundra_github_ollama"
    tundra.dome/bead-source: "github:owner/repo#123"
    tundra.dome/last-errand: "fetch_issues"
```

## Example: End-to-End Workflow

```
1. GitHub Issue Created
   ↓
2. Witness observes (webhook) → tundra-work-intake
   ↓
3. Mayor schedules playbook: github-sync
   ↓
4. Errand: fetch_issues → retrieves issue data
   ↓
5. Errand: create_bead → Bead CRD created
   ↓
6. Lane Router assigns lane based on labels
   ↓
7. Bead → tundra-lane-standard-beads
   ↓
8. Polecat picks up bead, executes work
   ↓
9. Bead status: completed → tundra-beads-completed
   ↓
10. Witness records audit → tundra-audit-actions
```

## Naming Conventions

### Kafka Topics
- Format: `tundra-{category}-{specifics}`
- Use hyphens, not dots
- Examples: `tundra-beads-created`, `tundra-lane-critical-beads`

### Airflow DAGs
- Format: `tundra_{purpose}_{specifics}`
- Use underscores (Python identifier)
- Examples: `tundra_github_ollama`, `tundra_lane_router`

### Kubernetes Resources
- Format: `tundra-{type}-{purpose}`
- Use hyphens
- Examples: `tundra-polecat-github`, `tundra-station-kafka`

### CRDs
- Group: `tundra.dome`
- Version: `v1`
- Examples: `beads.tundra.dome`, `polecats.tundra.dome`
