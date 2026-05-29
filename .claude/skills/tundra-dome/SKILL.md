# Tundra Dome Operations Skill

Manage Tundra Dome Kubernetes clusters with KIND, including beads, lanes, polecats, playbooks, and observability.

## Vocabulary

The Tundra Dome metaphor treats infrastructure as a frontier settlement:

| Term | K8s/Infra Equivalent | Description |
|------|---------------------|-------------|
| **Dome** | Cluster | The entire settlement |
| **Town** | Namespace | District within the dome |
| **Rig** | Node | Machine providing compute |
| **Polecat** | Pod | Individual worker instance |
| **Crew** | Deployment | Group of identical polecats |
| **Patrol** | DaemonSet | Polecats on every rig |
| **Station** | Service | Network endpoint |
| **Bead** | CRD | Atomic unit of work (issue, PR, task) |
| **Lane** | Kafka Topic | Priority queue (critical/standard/experimental) |
| **Playbook** | Airflow DAG | Sequence of steps |
| **Errand** | Airflow Task | Single step within playbook |

### Roles

| Role | Responsibility |
|------|----------------|
| **Mayor** | Orchestration, scheduling |
| **Deacon** | CI/CD, builds, deployments |
| **Polecat** | General worker |
| **Reaper** | Cleanup, garbage collection |
| **Witness** | Observation, logging, auditing |
| **Overseer** | Validation, quality checks |

## Commands

### Cluster Management

```bash
# Deploy full Tundra Dome stack to KIND
cd infra/tundra-dome && ./deploy.sh

# Create cluster only
./deploy.sh --cluster-only

# Deploy stack to existing cluster
./deploy.sh --stack-only

# Install CRDs only
./deploy.sh --crds-only

# Show deployment status
./deploy.sh --status

# Tear down everything
./deploy.sh --destroy
```

### Bead Operations

```bash
# List all beads
kubectl get beads -n tundra-dome

# Get bead details
kubectl describe bead <bead-name> -n tundra-dome

# Create a bead
kubectl apply -f - <<EOF
apiVersion: tundra.dome/v1
kind: Bead
metadata:
  name: fix-bug-123
  namespace: tundra-dome
spec:
  source: github
  sourceId: "123"
  title: "Fix login timeout"
  lane: standard
  assignedRole: polecat
EOF

# Delete a bead
kubectl delete bead <bead-name> -n tundra-dome
```

### Lane Operations

```bash
# List lanes
kubectl get lanes -n tundra-dome

# View lane status
kubectl describe lane critical -n tundra-dome
kubectl describe lane standard -n tundra-dome
kubectl describe lane experimental -n tundra-dome
```

### Polecat Operations

```bash
# List polecats (workers)
kubectl get polecats -n tundra-dome

# Scale a crew
kubectl scale deployment <crew-name> --replicas=3 -n tundra-dome

# View polecat logs
kubectl logs -l tundra.dome/role=polecat -n tundra-dome --tail=100
```

### Playbook/Airflow Operations

```bash
# Port forward to Airflow UI
kubectl port-forward svc/airflow-api-service 8080:8080 -n tundra-dome
# Visit http://localhost:8080 (credentials: tundra/admin)

# List playbooks
kubectl get playbooks -n tundra-dome

# Trigger a playbook (via Airflow CLI in pod)
kubectl exec -it deploy/airflow-scheduler -n tundra-dome -- \
  airflow dags trigger tundra_dome_integrations
```

### Station (Service) Operations

```bash
# List stations
kubectl get stations -n tundra-dome
kubectl get svc -n tundra-dome

# Port forward to Kafka
kubectl port-forward svc/kafka 9092:9092 -n tundra-dome
```

### Observability

```bash
# View Datadog agent logs
kubectl logs -l app=datadog-agent -n datadog --tail=100

# Check pod metrics
kubectl top pods -n tundra-dome

# View events
kubectl get events -n tundra-dome --sort-by='.lastTimestamp'

# Check deployments with metaphor labels
kubectl get deployments -n tundra-dome -L tundra.dome/role,tundra.dome/crew
```

## Kafka Topics

**Commands** (directives to roles):
- `tundra-mayor-commands`
- `tundra-deacon-commands`
- `tundra-polecat-commands`
- `tundra-reaper-commands`
- `tundra-witness-commands`

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

**Communication**:
- `tundra-nudges` (notifications)
- `tundra-whispers` (internal messages)
- `tundra-mail-outbox` / `tundra-mail-inbox`

## Files

- `infra/tundra-dome/deploy.sh` - Main deployment script
- `infra/tundra-dome/crds/` - Custom Resource Definitions
- `infra/tundra-dome/examples/` - Example resources
- `infra/tundra-dome/tundra-dome.clean.yaml` - Full stack manifest
- `infra/tundra-dome/METAPHOR.md` - Full metaphor specification
- `superdome-ops.md` - Operational model documentation
- `airflow/dags/tundra_*.py` - Airflow playbooks

## Prerequisites

```bash
# Install required tools
brew install kind kubectl docker

# Set Datadog API key for observability
export DD_API_KEY=your_api_key

# Verify Docker is running
docker info
```

## Troubleshooting

```bash
# Check cluster status
kind get clusters
kubectl cluster-info --context kind-tundra-dome

# Debug pod issues
kubectl describe pod <pod-name> -n tundra-dome
kubectl logs <pod-name> -n tundra-dome --previous

# Check CRD installation
kubectl get crds | grep tundra

# Reset stuck deployment
kubectl rollout restart deployment/<name> -n tundra-dome
```
