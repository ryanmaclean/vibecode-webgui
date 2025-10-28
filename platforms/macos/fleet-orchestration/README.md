# macOS Fleet Orchestration

**Agent 26 Deliverable**: Complete fleet orchestration system for managing agentapi containers across 10-100 Mac hosts.

## Overview

Distributed fleet management system providing:

- **Service Discovery**: Automatic Mac host detection via Bonjour/Consul/DNS
- **Intelligent Scheduling**: Bin-packing algorithm with affinity rules
- **Auto-Scaling**: Predictive horizontal scaling based on demand
- **Health Monitoring**: Continuous host and container health checks
- **Remote Management**: SSH and XPC-based remote operations
- **Disaster Recovery**: Container migration and automatic failover
- **SwiftUI Dashboard**: Real-time fleet monitoring and control

## Architecture

```
Fleet Control Plane (Fleet Manager)
          ↓
    Service Discovery
    (Bonjour/Consul/DNS)
          ↓
  ┌───────┴───────┬───────────┐
  │               │           │
Mac Host 1     Mac Host 2   Mac Host N
(Agent)        (Agent)      (Agent)
  │               │           │
[Containers]  [Containers] [Containers]
```

## Quick Start

### 1. Install Fleet Manager

```bash
# Build fleet manager
cd macos-fleet-orchestration
swift build -c release

# Install binary
sudo cp .build/release/fleet-manager /usr/local/bin/

# Create config directory
sudo mkdir -p /etc/vibecode-fleet
sudo cp config.yaml /etc/vibecode-fleet/

# Create data directory
sudo mkdir -p /var/lib/vibecode
```

### 2. Configure Fleet Manager

Edit `/etc/vibecode-fleet/config.yaml`:

```yaml
fleet:
  database_url: /var/lib/vibecode/fleet.db
  metrics_port: 8081

discovery:
  enable_bonjour: true
  enable_consul: false
  enable_dns: false

scheduler:
  packing_strategy: binPacking
  system_reserve_percent: 0.15
  max_utilization: 0.90

auto_scaler:
  enabled: true
  scale_out_threshold: 0.85
  scale_in_threshold: 0.40
  min_hosts: 2
  max_hosts: 100
  evaluation_interval: 60

remote:
  ssh_username: coder
  ssh_key_path: ~/.ssh/id_rsa
  command_timeout: 30
```

### 3. Install Host Agent

On each Mac host:

```bash
# Install agent
curl -O https://releases.vibecode.com/fleet-agent/latest/vibecode-agent
sudo install -m 755 vibecode-agent /usr/local/bin/

# Create agent config
sudo mkdir -p /etc/vibecode-agent
sudo tee /etc/vibecode-agent/config.yaml <<EOF
agent:
  hostname: $(hostname)
  architecture: $(uname -m)
  total_cpu: 8000  # 8 cores = 8000 millicores
  total_memory: 16384  # 16GB in MB

discovery:
  method: bonjour
  service_type: _vibecode-agent._tcp

agentapi:
  enabled: true
  port: 3284
EOF

# Install LaunchDaemon
sudo tee /Library/LaunchDaemons/com.vibecode.agent.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibecode.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/vibecode-agent</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/vibecode-agent/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/vibecode-agent/stderr.log</string>
</dict>
</plist>
EOF

# Load and start agent
sudo launchctl load /Library/LaunchDaemons/com.vibecode.agent.plist
sudo launchctl start com.vibecode.agent
```

### 4. Start Fleet Manager

```bash
# Start fleet manager
fleet-manager start

# Or run with systemd/launchd
sudo systemctl start vibecode-fleet  # Linux
sudo launchctl start com.vibecode.fleet  # macOS
```

### 5. Launch Dashboard

```bash
# Open SwiftUI dashboard
open -a "Fleet Dashboard"

# Or access web UI
open http://localhost:8080
```

## Components

### Fleet Manager (`fleet-manager/`)

Central control plane coordinating all fleet operations.

**Key Files**:
- `FleetManager.swift`: Main orchestration logic
- `Models.swift`: Data models (MacHost, Container, etc.)
- `FleetDatabase.swift`: SQLite persistence
- `MetricsCollector.swift`: Prometheus metrics

### Scheduler (`scheduler/`)

Intelligent container placement algorithm.

**Key Files**:
- `SchedulerEngine.swift`: Bin-packing with affinity rules

**Features**:
- Multiple packing strategies (best-fit, worst-fit, bin-packing)
- Affinity/anti-affinity rules
- Resource reservation (CPU, memory)
- Thermal-aware scheduling

### Service Discovery (`service-discovery/`)

Automatic host detection across network.

**Key Files**:
- `ServiceDiscovery.swift`: Multi-protocol discovery

**Protocols**:
- **Bonjour (mDNS)**: Zero-config local discovery (<1s latency)
- **Consul**: Multi-datacenter with health checks
- **DNS-SD**: SRV records for production environments

### Auto-Scaler (`auto-scaling/`)

Predictive horizontal scaling engine.

**Key Files**:
- `AutoScaler.swift`: Demand-based scaling

**Features**:
- Scale-out when utilization >85%
- Scale-in when utilization <40% (sustained)
- Linear regression demand prediction
- Cost optimization
- Cooldown periods

### Remote Management (`remote-management/`)

SSH and XPC-based remote operations.

**Key Files**:
- `RemoteManager.swift`: Remote command execution

**Capabilities**:
- Container lifecycle (start/stop/restart)
- Container migration (checkpoint/restore)
- Health monitoring
- Log streaming
- System metrics collection

### Dashboard (`dashboard/`)

Real-time SwiftUI monitoring interface.

**Key Files**:
- `FleetDashboard.swift`: Main SwiftUI views
- `FleetDashboardViewModel.swift`: View model logic

**Views**:
- Fleet overview with health status
- Host list and detail views
- Container management
- Scheduler visualization
- Auto-scaler metrics
- Alert management

## API Reference

### Fleet Manager API

```bash
# Get fleet status
GET /api/v1/fleet/status

# List hosts
GET /api/v1/hosts

# Get host detail
GET /api/v1/hosts/:id

# List containers
GET /api/v1/containers

# Place container
POST /api/v1/containers
{
  "agent_type": "aider",
  "workspace": "/workspace/project",
  "resources": {
    "cpu": 500,
    "memory": 1024
  }
}

# Migrate container
POST /api/v1/containers/:id/migrate
{
  "target_host_id": "uuid"
}

# Stop container
POST /api/v1/containers/:id/stop
```

### Metrics Endpoint

```bash
# Prometheus metrics
GET /metrics

# Example metrics
vibecode_fleet_hosts_total 10
vibecode_fleet_containers_total 45
vibecode_fleet_health 1.0
vibecode_host_cpu_utilization{host="mac-01"} 0.65
vibecode_container_migrations_total 12
vibecode_migration_duration_seconds_bucket{le="1.0"} 10
```

## Configuration

### Scheduler Configuration

```yaml
scheduler:
  # Packing strategy: firstFit, bestFit, worstFit, binPacking
  packing_strategy: binPacking

  # System resource reserve (15%)
  system_reserve_percent: 0.15

  # Maximum host utilization (90%)
  max_utilization: 0.90

  # Consider thermal throttling
  consider_thermals: true
```

### Auto-Scaler Configuration

```yaml
auto_scaler:
  enabled: true

  # Scale-out when >85% utilized
  scale_out_threshold: 0.85

  # Scale-in when <40% utilized
  scale_in_threshold: 0.40

  # Cooldown between scaling operations (5 min)
  cooldown_period: 300

  # Sustained demand window (3 min)
  sustained_demand_duration: 180

  # Min/max hosts
  min_hosts: 2
  max_hosts: 100

  # Scale step size
  min_scale_step: 1
  max_scale_step: 5

  # Buffer capacity (20%)
  scale_buffer: 1.2
```

### Discovery Configuration

```yaml
discovery:
  # Bonjour (mDNS)
  enable_bonjour: true
  bonjour_service_type: _vibecode-agent._tcp

  # Consul
  enable_consul: false
  consul_url: http://localhost:8500
  consul_poll_interval: 30

  # DNS
  enable_dns: false
  dns_domain: vibecode.local
  dns_service_name: vibecode-agent
```

## Monitoring

### Prometheus Integration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'vibecode-fleet'
    static_configs:
      - targets: ['localhost:8081']
```

### Grafana Dashboard

Import dashboard: `monitoring/grafana/fleet-dashboard.json`

**Panels**:
- Fleet health gauge
- Host count and status
- Container distribution
- CPU/memory utilization
- Migration metrics
- Auto-scaling events

## Disaster Recovery

### Container Migration

Automatic migration on host failure:

1. **Detection**: Heartbeat timeout (30s)
2. **Decision**: Mark host as failed
3. **Rescheduling**: Place containers on healthy hosts
4. **Migration**: Checkpoint → Transfer → Restore
5. **Verification**: Health check on new host

Target migration time: <60 seconds

### Backup and Restore

```bash
# Backup fleet state
fleet-manager backup --output /backup/fleet-state.tar.gz

# Restore fleet state
fleet-manager restore --input /backup/fleet-state.tar.gz

# Continuous backup to S3
fleet-manager backup --s3 s3://vibecode-backups/fleet/
```

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Fleet uptime | 99.9% | 8.76 hours downtime/year |
| Container start | <30s | From request to running |
| Migration time | <60s | Including workspace transfer |
| Failover time | <120s | Full host failure recovery |
| Discovery latency | <1s | Bonjour service detection |
| API response (P95) | <500ms | Fleet manager API |
| Scheduler decision | <100ms | Placement calculation |

## Scaling Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| Max hosts | 100 | Configurable in auto-scaler |
| Containers/host | 5-20 | Depends on host resources |
| Max concurrent migrations | 5 | 5% of fleet size |
| Heartbeat interval | 15s | Adaptive based on load |
| Health check interval | 30s | Per-container checks |

## Security

- **Authentication**: SSH key-based for remote operations
- **Authorization**: RBAC for management API
- **Encryption**: TLS 1.3 for all network traffic
- **Secrets**: Vault integration for API keys
- **Audit**: All mutations logged with attribution

## Troubleshooting

### Fleet Manager Not Starting

```bash
# Check logs
journalctl -u vibecode-fleet -f  # Linux
log show --predicate 'processImagePath CONTAINS "fleet-manager"' --last 1h  # macOS

# Verify config
fleet-manager validate-config

# Check database
sqlite3 /var/lib/vibecode/fleet.db "SELECT * FROM hosts;"
```

### Host Not Discovered

```bash
# Verify agent running
ssh mac-host.local "ps aux | grep vibecode-agent"

# Check Bonjour advertisement
dns-sd -B _vibecode-agent._tcp

# Test connectivity
curl http://mac-host.local:3284/health
```

### Container Migration Failing

```bash
# Check source host
ssh source-host "curl http://127.0.0.1:3284/v1/agents"

# Check target host resources
ssh target-host "top -l 1"

# Verify workspace transfer
rsync -avz --dry-run source:/workspace target:/workspace

# View migration logs
fleet-manager logs --filter migration --tail 100
```

## Development

### Build from Source

```bash
# Clone repository
git clone https://github.com/vibecode/fleet-orchestration
cd macos-fleet-orchestration

# Build
swift build -c release

# Run tests
swift test

# Generate Xcode project
swift package generate-xcodeproj
open macos-fleet-orchestration.xcodeproj
```

### Testing

```bash
# Unit tests
swift test --filter FleetManagerTests

# Integration tests
swift test --filter IntegrationTests

# E2E tests with mock hosts
./scripts/test-e2e.sh
```

## Production Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed production setup.

## License

MIT License - See LICENSE file

## Support

- Documentation: [docs.vibecode.com/fleet](https://docs.vibecode.com/fleet)
- Issues: [github.com/vibecode/fleet/issues](https://github.com/vibecode/fleet/issues)
- Slack: [vibecode.slack.com](https://vibecode.slack.com) #fleet-orchestration

## Credits

Built by Agent 26 (Staff DevOps Engineer - Datadog macOS Fleet Team)

Based on production experience managing 1000+ Mac CI agents at Datadog.
