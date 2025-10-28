# Agent 26: macOS Fleet Orchestration Architecture

**Author**: Agent 26 (Staff DevOps Engineer - Datadog macOS Fleet Team)
**Date**: 2025-10-02
**Mission**: Build macOS fleet orchestration system for agentapi containers

## Executive Summary

Complete fleet orchestration system for managing 10-100 Mac hosts running agentapi containers. Provides service discovery, intelligent scheduling, auto-scaling, health monitoring, and disaster recovery with 99.9% uptime SLA.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Fleet Control Plane                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │Fleet Manager │  │  Scheduler   │  │Auto-Scaler   │        │
│  │  (Swift)     │  │  Algorithm   │  │  Engine      │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
           ┌─────────────────┴─────────────────┐
           │     Service Discovery Layer        │
           │  (Bonjour + Consul + DNS-SD)      │
           └─────────────────┬─────────────────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    │                        │                        │
┌───▼───┐              ┌───▼───┐              ┌───▼───┐
│ Mac 1 │              │ Mac 2 │              │ Mac N │
│ Agent │              │ Agent │              │ Agent │
│ Host  │              │ Host  │              │ Host  │
│       │              │       │              │       │
│ [Con] │              │ [Con] │              │ [Con] │
│ [Con] │              │ [Con] │              │ [Con] │
│ [Con] │              │       │              │       │
└───────┘              └───────┘              └───────┘
```

## Core Components

### 1. Fleet Manager Service (Swift)

Central control plane for orchestrating Mac fleet operations.

**Responsibilities**:
- Maintain inventory of all Mac hosts
- Track container placement and resource usage
- Execute placement decisions from scheduler
- Monitor host and container health
- Coordinate failover and migrations
- Expose management API

**Key Features**:
- Real-time host inventory with capabilities tracking
- Container lifecycle management (start/stop/migrate)
- Health aggregation from all hosts
- Event-driven architecture for responsiveness
- REST API for external integrations

**Data Model**:
```swift
struct MacHost {
    let id: UUID
    let hostname: String
    let ipAddress: String
    let architecture: String // "arm64" or "amd64"
    let totalCPU: Int
    let totalMemory: Int
    let availableCPU: Int
    let availableMemory: Int
    let containers: [Container]
    let status: HostStatus
    let lastHeartbeat: Date
    let tags: [String: String]
}

struct Container {
    let id: UUID
    let agentType: String
    let hostId: UUID
    let workspace: String
    let resources: ResourceRequirements
    let status: ContainerStatus
    let startTime: Date
    let healthScore: Float
}
```

### 2. Remote Management

SSH-based and XPC-based remote management for distributed Mac hosts.

**SSH Command Execution**:
- Secure key-based authentication
- Command queuing and rate limiting
- Timeout and retry logic
- Output streaming for long-running commands

**XPC Service (Local Agent)**:
- Runs on each Mac host
- Privileged operations (system config)
- Container lifecycle operations
- Log collection and forwarding
- Health check execution

**Remote Debugging**:
- Live log streaming from containers
- Performance profiling
- Terminal access for debugging
- Snapshot and dump collection

### 3. Service Discovery

Multi-layer service discovery for automatic host detection and registration.

**Bonjour (mDNS)**:
- Zero-configuration local network discovery
- Service advertisement: `_vibecode-agent._tcp`
- TXT records for host metadata (arch, version, capacity)
- Sub-1 second discovery time

**Consul Integration** (Optional):
- Multi-datacenter support
- Health checking with automatic deregistration
- DNS interface for service lookups
- KV store for distributed configuration

**DNS-Based Discovery**:
- SRV records for service endpoints
- Round-robin load distribution
- TTL-based caching
- Fallback for non-Bonjour environments

**Health Check Propagation**:
- Container health → Host health → Fleet health
- Configurable thresholds and grace periods
- Automated remediation triggers

### 4. Scheduling Algorithm

Intelligent container placement for optimal resource utilization.

**Bin-Packing Strategy**:
- First-Fit-Decreasing for CPU/memory
- Minimize host fragmentation
- Reserve capacity for system overhead
- Configurable packing density (default: 80%)

**Affinity Rules**:
```yaml
# Keep workspace containers on same host
affinity:
  workspace-locality:
    type: host
    scope: workspace-id
    weight: 100

# Prefer arm64 hosts for arm64 workloads
affinity:
  architecture-match:
    type: host
    scope: container-arch
    weight: 80
```

**Anti-Affinity Rules**:
```yaml
# Spread critical workloads across hosts
anti-affinity:
  high-availability:
    type: host
    scope: service-tier
    weight: 100

# Avoid overloading single host
anti-affinity:
  load-balancing:
    type: host
    scope: resource-usage
    weight: 60
```

**Resource Reservations**:
- System reserve: 15% CPU, 20% memory
- Per-container limits with overcommit protection
- QoS classes: Guaranteed, Burstable, BestEffort

**Priority Scheduling**:
```swift
enum Priority: Int {
    case critical = 3   // Never evict
    case high = 2       // Evict last
    case normal = 1     // Standard workload
    case low = 0        // Evict first
}
```

### 5. Auto-Scaling

Horizontal and vertical scaling based on capacity and demand.

**Capacity Planning**:
- Predictive demand modeling (time-series analysis)
- Buffer capacity for burst workloads (20% headroom)
- Cost-aware scaling decisions

**Horizontal Scaling**:
```swift
// Scale-out triggers
if (fleet.availableCapacity < 15%) {
    addMacHost(count: ceil(demand * 1.2))
}

// Scale-in triggers
if (fleet.utilizationAvg < 40% for 30min) {
    drainAndRemoveMacHost(selection: .leastUtilized)
}
```

**Vertical Scaling**:
- Per-container resource adjustments
- Right-sizing based on historical usage
- Gradual increase/decrease to avoid disruption

**Thermal Throttling Detection**:
- Monitor system temperature sensors
- Reduce load on overheating hosts
- Trigger preventive migration before throttling

**Cost Optimization**:
- Prioritize on-premises over cloud Macs
- Consolidate workloads during off-peak
- Spot/preemptible Mac instance support

### 6. Disaster Recovery

Automated failover and recovery for high availability.

**Container Migration**:
- Live migration with minimal downtime
- Checkpoint/restore support
- Volume migration via rsync
- Target: <1 minute migration time

**Automatic Failover**:
```swift
// Host failure detection
if (host.heartbeatAge > 30s) {
    // Declare host failed
    for container in host.containers {
        // Reschedule on healthy host
        scheduler.placementDecision(
            container: container,
            exclude: [host.id],
            priority: .high
        )
    }
}
```

**Backup and Restore**:
- Workspace snapshots to S3/MinIO
- Database backups (PostgreSQL, Redis)
- Configuration backup (Git-ops)
- RTO: <5 minutes, RPO: <15 minutes

**Rollback Procedures**:
- Version-pinned container images
- Configuration rollback via Git
- Database point-in-time recovery
- Automated smoke tests post-rollback

### 7. Fleet Dashboard (SwiftUI)

Real-time monitoring and management interface.

**Key Views**:
- **Fleet Overview**: Host count, capacity, utilization
- **Host Detail**: Per-host resources, containers, health
- **Container List**: Status, resources, logs, actions
- **Scheduler View**: Placement decisions, queue depth
- **Auto-Scaler**: Scaling events, predictions, triggers
- **Alerts**: Active incidents, alert history

**Real-Time Updates**:
- WebSocket connection to fleet manager
- Live metrics streaming
- Event log with filtering
- Push notifications for critical events

**Actions**:
- Manual container operations (start/stop/restart/migrate)
- Host maintenance mode
- Override auto-scaler decisions
- Force failover testing

## Deployment Architecture

### Fleet Manager Deployment

```yaml
# Run on dedicated management Mac or Linux server
location: management-host
replicas: 1 (with standby for HA)
dependencies:
  - PostgreSQL (inventory database)
  - Redis (cache and pub/sub)
  - Consul (optional)
ports:
  - 8080 (API)
  - 8081 (Metrics)
  - 8082 (WebSocket)
```

### Host Agent Deployment

```bash
# Install on each Mac host
/usr/local/bin/vibecode-agent
  - Binary: Swift executable
  - Config: /etc/vibecode-agent/config.yaml
  - Logs: /var/log/vibecode-agent/
  - LaunchDaemon: com.vibecode.agent.plist
```

### Network Requirements

```
Fleet Manager → Mac Hosts:
  - SSH: 22 (command execution)
  - AgentAPI: 3284 (container API)
  - XPC: Unix socket (local only)

Mac Hosts → Fleet Manager:
  - Heartbeat: 8080 (HTTP)
  - Metrics: 8081 (Prometheus)
  - Events: 8082 (WebSocket)

Discovery:
  - mDNS: 5353 (UDP)
  - Consul: 8500, 8600
```

## Performance Targets

| Metric | Target | Measured |
|--------|--------|----------|
| Uptime SLA | 99.9% | TBD |
| Container start time | <30s | TBD |
| Migration time | <1min | TBD |
| Failover time | <2min | TBD |
| Discovery latency | <1s | TBD |
| API response time (P95) | <500ms | TBD |
| Scheduler decision time | <100ms | TBD |

## Constraints

- **Fleet Size**: 10-100 Mac hosts
- **Containers per Host**: 5-20 (depending on resources)
- **Max Concurrent Migrations**: 5% of fleet
- **Heartbeat Interval**: 15s (adaptive)
- **Health Check Interval**: 30s
- **Auto-scale Evaluation**: Every 60s

## Integration Points

### With Agent 21 (Container Orchestration)
- Fleet manager calls agentapi HTTP endpoints
- Container lifecycle events propagated to fleet
- Resource monitoring aggregated to fleet level

### With Agent 22 (VM Management)
- Mac hosts can be VMs or physical machines
- VM-specific optimizations (live migration, snapshots)
- Hypervisor integration for capacity planning

### With Agent 27 (Observability)
- Fleet metrics exported to Prometheus
- Distributed tracing for request flows
- Log aggregation via Loki/Elasticsearch
- SLO monitoring and alerting

## Security Considerations

- **Authentication**: SSH keys, mTLS for API
- **Authorization**: RBAC for management operations
- **Encryption**: TLS 1.3 for all network traffic
- **Secrets**: Vault integration for API keys
- **Audit Logging**: All mutations logged with attribution

## Next Steps

1. Implement Fleet Manager service (Swift)
2. Build host agent with XPC service
3. Integrate Bonjour/Consul service discovery
4. Develop scheduling algorithm
5. Create auto-scaling engine
6. Build SwiftUI dashboard
7. E2E testing with 10+ Mac hosts
8. Performance optimization and tuning
9. Production deployment documentation
10. Runbook for operational procedures

## Success Criteria

- [ ] Fleet manager manages 10+ Mac hosts
- [ ] Container placement in <30s
- [ ] Migration completes in <1min
- [ ] Automatic failover in <2min
- [ ] 99.9% uptime over 30 days
- [ ] Dashboard shows real-time status
- [ ] Auto-scaling responds to demand
- [ ] Zero data loss during migrations
- [ ] Security audit passed
- [ ] Load testing: 100 concurrent containers

## References

- AgentAPI: `/Users/ryan.maclean/vibecode-webgui/docker/agentapi/`
- K8s Deployment: `/Users/ryan.maclean/vibecode-webgui/k8s/agentapi/`
- Agent 21 Deliverables: Container orchestration patterns
- Agent 22 Deliverables: VM management integration
- Agent 27 Deliverables: Observability stack

---

**Status**: Architecture Complete - Implementation Ready
**Next Agent**: Agent 27 (Observability Integration)
