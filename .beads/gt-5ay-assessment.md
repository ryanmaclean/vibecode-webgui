# gt-5ay: Airflow API/Server Memory Limits Stability Assessment

## Current Configuration

### Kubernetes (KIND) - `tundra-dome/k8s/airflow.yaml`

| Component | Memory Request | Memory Limit | CPU Request | CPU Limit |
|-----------|---------------|-------------|-------------|-----------|
| Scheduler | 512Mi | 2Gi | 250m | 1000m |
| DAG Processor | 256Mi | 512Mi | 100m | 250m |
| API Server | 512Mi | 1Gi | 100m | 250m |

### macOS LaunchAgent - `tundra-dome/services/macos/*.plist`

No memory limits configured. All three services (scheduler, dag-processor, api-server) run unconstrained with `KeepAlive=true`.

## Workload Profile

- **15+ DAGs** across 5 files (10 superdome policy DAGs + 5 integration DAGs)
- Fastest schedule: every **1 minute** (lane_router, escalation_gate)
- All DAGs use Kafka (kafka-python) for event production/consumption
- Executor: **SequentialExecutor** (single-threaded task execution)
- Database: **sqlite on emptyDir** (ephemeral, per-pod)

## Stability Risks (by severity)

### CRITICAL: Per-Pod sqlite on emptyDir

Each of the 3 deployments uses its own `emptyDir` volume for `airflow-home`, meaning each pod has a **separate sqlite database**. The scheduler, DAG processor, and API server cannot share state. This causes:
- API server shows stale/empty DAG run history
- DAG processor can't see scheduler-created runs
- Data loss on every pod restart

**Fix**: Use a shared PersistentVolumeClaim or migrate to PostgreSQL.

### HIGH: DAG Processor memory limit too low (512Mi)

The DAG processor must parse all 15+ DAGs repeatedly, each importing `kafka-python` and `airflow` modules. Additionally, `pip install` runs at container startup inside the main container, consuming memory before the processor even starts. 512Mi is marginal for this workload.

**Observed pattern**: OOM kills during startup when pip install and DAG parsing overlap.

**Fix**: Raise limit to **1Gi** (matching API server).

### HIGH: Runtime pip install in containers

All 3 services run `pip install` at container startup:
```
pip install --user apache-airflow-providers-openlineage>=2.7.3 openlineage-python>=1.37.0
```
The scheduler also installs `kafka-python`. This:
- Adds 30-60s startup latency
- Consumes 100-200Mi transient memory during install
- Can fail if PyPI is unreachable (no retry logic)
- Re-downloads on every pod restart

**Fix**: Build a custom Docker image with pre-installed packages:
```dockerfile
FROM apache/airflow:2.8.0
RUN pip install apache-airflow-providers-openlineage>=2.7.3 openlineage-python>=1.37.0 kafka-python
```

### HIGH: No health probes

None of the 3 deployments define `livenessProbe` or `readinessProbe`. Kubernetes cannot detect:
- Hung scheduler (common with sqlite locking)
- API server returning 500s
- DAG processor stuck in a parsing loop

**Fix**: Add probes:
```yaml
# API Server
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 60
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10

# Scheduler
livenessProbe:
  exec:
    command: ["airflow", "jobs", "check", "--job-type", "SchedulerJob"]
  initialDelaySeconds: 60
  periodSeconds: 60
```

### MEDIUM: Scheduler request/limit ratio (1:4)

Scheduler requests 512Mi but limits at 2Gi — a 4:1 ratio. Kubernetes schedules based on requests, so the pod may land on a node with only 512Mi free. When load spikes, the scheduler tries to grow toward 2Gi but gets OOM-killed because the node can't provide it.

**Fix**: Raise request to **1Gi** (2:1 ratio) or lower limit to **1.5Gi** (3:1 ratio).

### MEDIUM: API Server CPU too low for CLI usage

The `td airflow` CLI makes authenticated API calls. With only 100m-250m CPU, concurrent requests from multiple polecats will queue and timeout.

**Fix**: Raise CPU limit to **500m**.

### LOW: macOS services have no memory constraints

LaunchAgent plists don't support memory limits natively. Given these processes share the machine with memory-hungry Claude/polecat sessions, a runaway Airflow process could starve the system.

**Fix**: Consider wrapping with `ulimit -v` in a shell script launcher, or monitor via Datadog process checks with alerts.

## Recommended Changes Summary

| Component | Current Limit | Recommended | Rationale |
|-----------|--------------|-------------|-----------|
| DAG Processor mem | 512Mi | **1Gi** | OOM risk with 15+ DAGs + pip install |
| Scheduler mem request | 512Mi | **1Gi** | Reduce request/limit ratio from 4:1 to 2:1 |
| API Server CPU limit | 250m | **500m** | Support concurrent CLI queries |
| All containers | runtime pip | **custom image** | Eliminate startup OOM + latency |
| All deployments | no probes | **add probes** | Detect hung/unhealthy pods |
| All deployments | per-pod sqlite | **shared storage** | Data consistency across pods |
