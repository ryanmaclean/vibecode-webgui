# Fleet Orchestration Deployment Guide

Complete deployment guide for production macOS fleet orchestration.

## Prerequisites

- **Management Host**: Mac or Linux server for fleet manager
- **Mac Hosts**: 10-100 Mac machines (physical or VM)
- **Network**: All hosts on same network or VPN
- **SSH Access**: Key-based SSH authentication configured
- **Storage**: 10GB for database and logs
- **Ports**: 8080 (API), 8081 (metrics), 3284 (agentapi)

## Architecture

```
┌─────────────────────────────────┐
│   Management Host               │
│   - Fleet Manager (port 8080)   │
│   - Metrics (port 8081)         │
│   - PostgreSQL/SQLite           │
│   - Dashboard UI                │
└──────────────┬──────────────────┘
               │
        ┌──────┴──────┐
        │   Network   │
        └──────┬──────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌───▼───┐  ┌───▼───┐
│Mac 1  │  │Mac 2  │  │Mac N  │
│Agent  │  │Agent  │  │Agent  │
│:3284  │  │:3284  │  │:3284  │
└───────┘  └───────┘  └───────┘
```

## Deployment Steps

### 1. Prepare Management Host

```bash
# Install dependencies
brew install swift sqlite3

# Or on Linux
apt-get install swift sqlite3

# Create directories
sudo mkdir -p /usr/local/bin
sudo mkdir -p /etc/vibecode-fleet
sudo mkdir -p /var/lib/vibecode
sudo mkdir -p /var/log/vibecode-fleet
```

### 2. Build Fleet Manager

```bash
# Clone repository
git clone https://github.com/vibecode/fleet-orchestration
cd macos-fleet-orchestration

# Build release binary
swift build -c release

# Install binary
sudo cp .build/release/fleet-manager /usr/local/bin/
sudo chmod +x /usr/local/bin/fleet-manager

# Verify installation
fleet-manager --version
```

### 3. Configure Fleet Manager

Create `/etc/vibecode-fleet/config.yaml`:

```yaml
fleet:
  # Database for fleet state
  database_url: /var/lib/vibecode/fleet.db

  # Metrics export port
  metrics_port: 8081

  # API server port
  api_port: 8080

discovery:
  # Enable Bonjour for local discovery
  enable_bonjour: true
  bonjour_service_type: _vibecode-agent._tcp
  bonjour_domain: local

  # Optional: Consul for multi-DC
  enable_consul: false
  consul_url: http://localhost:8500
  consul_poll_interval: 30

  # Optional: DNS-based discovery
  enable_dns: false
  dns_domain: vibecode.internal
  dns_service_name: vibecode-agent

scheduler:
  # Packing strategy: firstFit, bestFit, worstFit, binPacking
  packing_strategy: binPacking

  # Reserve 15% for system
  system_reserve_percent: 0.15

  # Maximum host utilization
  max_utilization: 0.90

  # Consider thermal throttling
  consider_thermals: true

auto_scaler:
  # Enable auto-scaling
  enabled: true

  # Scale thresholds
  scale_out_threshold: 0.85  # 85% utilization
  scale_in_threshold: 0.40   # 40% utilization

  # Timing
  cooldown_period: 300              # 5 minutes
  sustained_demand_duration: 180    # 3 minutes
  evaluation_interval: 60           # 1 minute

  # Fleet size limits
  min_hosts: 2
  max_hosts: 100

  # Scaling increments
  min_scale_step: 1
  max_scale_step: 5

  # Buffer capacity
  scale_buffer: 1.2  # 20% buffer

  # Cost model (optional)
  cost_model:
    base_monthly: 0
    per_host_monthly: 100
    savings_threshold: 200

remote:
  # SSH configuration
  ssh_username: coder
  ssh_key_path: ~/.ssh/id_rsa
  ssh_connect_timeout: 10
  command_timeout: 30

  # Enable XPC (local operations only)
  enable_xpc: false

logging:
  level: info  # debug, info, warn, error
  format: json
  output: /var/log/vibecode-fleet/fleet-manager.log
```

### 4. Install Host Agents

On each Mac host, install the agent:

```bash
# Download agent
curl -O https://releases.vibecode.com/fleet-agent/v1.0.0/vibecode-agent-$(uname -m)
sudo install -m 755 vibecode-agent-$(uname -m) /usr/local/bin/vibecode-agent

# Create configuration
sudo mkdir -p /etc/vibecode-agent

sudo tee /etc/vibecode-agent/config.yaml <<EOF
agent:
  # Host identification
  hostname: $(hostname -s)
  architecture: $(uname -m)

  # Resource capacity
  total_cpu: 8000      # 8 cores = 8000 millicores
  total_memory: 16384  # 16GB = 16384 MB

  # Adjust based on actual hardware:
  # Mac mini M2: 8000m CPU, 8192-24576 MB
  # Mac Studio M2: 20000m CPU, 32768-196608 MB
  # MacBook Pro M3: 12000m CPU, 16384-36864 MB

discovery:
  # Service discovery method
  method: bonjour  # or consul, dns

  # Bonjour settings
  service_type: _vibecode-agent._tcp
  domain: local

  # Metadata tags
  tags:
    environment: production
    datacenter: us-east-1
    tier: standard

agentapi:
  # Enable AgentAPI integration
  enabled: true
  port: 3284

  # AgentAPI configuration
  max_concurrent_agents: 5
  agent_timeout: 300
  terminal_dir: /tmp/terminals

monitoring:
  # Export metrics
  enable_metrics: true
  metrics_port: 9100

  # Health check
  health_check_interval: 30

logging:
  level: info
  output: /var/log/vibecode-agent/agent.log
EOF
```

### 5. Install LaunchDaemon (macOS)

```bash
# Create LaunchDaemon
sudo tee /Library/LaunchDaemons/com.vibecode.agent.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibecode.agent</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/vibecode-agent</string>
        <string>--config</string>
        <string>/etc/vibecode-agent/config.yaml</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>StandardOutPath</key>
    <string>/var/log/vibecode-agent/stdout.log</string>

    <key>StandardErrorPath</key>
    <string>/var/log/vibecode-agent/stderr.log</string>

    <key>WorkingDirectory</key>
    <string>/var/lib/vibecode-agent</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF

# Set permissions
sudo chown root:wheel /Library/LaunchDaemons/com.vibecode.agent.plist
sudo chmod 644 /Library/LaunchDaemons/com.vibecode.agent.plist

# Create log directory
sudo mkdir -p /var/log/vibecode-agent
sudo chown coder:staff /var/log/vibecode-agent

# Load and start
sudo launchctl load /Library/LaunchDaemons/com.vibecode.agent.plist
sudo launchctl start com.vibecode.agent

# Verify
sudo launchctl list | grep vibecode
```

### 6. Configure SSH Keys

```bash
# On management host, generate SSH key if needed
ssh-keygen -t ed25519 -f ~/.ssh/vibecode_fleet -N ""

# Copy public key to all Mac hosts
for host in mac-{01..10}.local; do
    ssh-copy-id -i ~/.ssh/vibecode_fleet.pub coder@$host
done

# Test SSH access
for host in mac-{01..10}.local; do
    ssh -i ~/.ssh/vibecode_fleet coder@$host "hostname && uname -m"
done

# Update fleet manager config with key path
# ssh_key_path: /home/admin/.ssh/vibecode_fleet
```

### 7. Start Fleet Manager

#### Option A: Direct Execution

```bash
# Start in foreground
fleet-manager start --config /etc/vibecode-fleet/config.yaml

# Or in background
nohup fleet-manager start --config /etc/vibecode-fleet/config.yaml \
    > /var/log/vibecode-fleet/stdout.log 2>&1 &
```

#### Option B: systemd (Linux)

```bash
# Create systemd service
sudo tee /etc/systemd/system/vibecode-fleet.service <<EOF
[Unit]
Description=VibeCode Fleet Manager
After=network.target

[Service]
Type=simple
User=vibecode
Group=vibecode
ExecStart=/usr/local/bin/fleet-manager start --config /etc/vibecode-fleet/config.yaml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vibecode-fleet

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable vibecode-fleet
sudo systemctl start vibecode-fleet

# Check status
sudo systemctl status vibecode-fleet
sudo journalctl -u vibecode-fleet -f
```

#### Option C: launchd (macOS)

```bash
# Create LaunchDaemon
sudo tee /Library/LaunchDaemons/com.vibecode.fleet.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibecode.fleet</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/fleet-manager</string>
        <string>start</string>
        <string>--config</string>
        <string>/etc/vibecode-fleet/config.yaml</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/vibecode-fleet/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/vibecode-fleet/stderr.log</string>
</dict>
</plist>
EOF

# Load and start
sudo launchctl load /Library/LaunchDaemons/com.vibecode.fleet.plist
sudo launchctl start com.vibecode.fleet
```

### 8. Verify Deployment

```bash
# Check fleet manager health
curl http://localhost:8080/health

# Expected response:
# {"status":"healthy","hosts":0,"containers":0}

# Check metrics
curl http://localhost:8081/metrics | grep vibecode_fleet

# Check service discovery
# (Wait 30 seconds for hosts to register)

# List discovered hosts
curl http://localhost:8080/api/v1/hosts | jq

# Check logs
tail -f /var/log/vibecode-fleet/fleet-manager.log
```

### 9. Launch Dashboard

```bash
# macOS: Open SwiftUI app
open -a "Fleet Dashboard"

# Or build from source
cd macos-fleet-orchestration
swift run FleetDashboard
```

### 10. Test Container Placement

```bash
# Place test container
curl -X POST http://localhost:8080/api/v1/containers \
  -H "Content-Type: application/json" \
  -d '{
    "agent_type": "aider",
    "workspace": "/workspace/test-project",
    "resources": {
      "cpu": 500,
      "memory": 1024,
      "qos_class": "normal"
    }
  }' | jq

# Check container status
curl http://localhost:8080/api/v1/containers | jq

# View container on host
HOST_IP=$(curl -s http://localhost:8080/api/v1/containers | jq -r '.[0].host_ip')
ssh coder@$HOST_IP "curl http://127.0.0.1:3284/v1/agents"
```

## Monitoring Setup

### Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'vibecode-fleet-manager'
    static_configs:
      - targets: ['localhost:8081']

  - job_name: 'vibecode-agents'
    dns_sd_configs:
      - names: ['_vibecode-agent._tcp.local']
```

### Grafana

```bash
# Import dashboard
curl -X POST http://grafana:3000/api/dashboards/import \
  -H "Content-Type: application/json" \
  -d @monitoring/grafana/fleet-dashboard.json
```

## Security Hardening

### 1. Enable TLS

```yaml
# config.yaml
api:
  tls_enabled: true
  tls_cert: /etc/vibecode-fleet/tls/server.crt
  tls_key: /etc/vibecode-fleet/tls/server.key
```

### 2. Add Authentication

```yaml
# config.yaml
api:
  auth_enabled: true
  auth_provider: jwt
  jwt_secret: ${JWT_SECRET}
```

### 3. Network Policies

```bash
# Firewall rules (iptables)
sudo iptables -A INPUT -p tcp --dport 8080 -s 10.0.0.0/8 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8080 -j DROP
```

## Troubleshooting

### Fleet Manager Won't Start

```bash
# Check configuration
fleet-manager validate-config --config /etc/vibecode-fleet/config.yaml

# Check database
sqlite3 /var/lib/vibecode/fleet.db "SELECT * FROM hosts;"

# Check logs
tail -100 /var/log/vibecode-fleet/fleet-manager.log
```

### Hosts Not Discovered

```bash
# Check Bonjour
dns-sd -B _vibecode-agent._tcp

# Check agent running
ssh mac-host "ps aux | grep vibecode-agent"

# Check AgentAPI
ssh mac-host "curl http://127.0.0.1:3284/health"
```

### Container Placement Failing

```bash
# Check host resources
curl http://localhost:8080/api/v1/hosts | jq '.[] | {hostname, cpu_available, memory_available}'

# Check scheduler logs
grep "placement" /var/log/vibecode-fleet/fleet-manager.log

# Check requirements
# Ensure requested resources <= available resources
```

## Backup and Restore

### Backup

```bash
# Backup database
sqlite3 /var/lib/vibecode/fleet.db ".backup /backup/fleet-$(date +%Y%m%d).db"

# Backup configuration
tar czf /backup/fleet-config-$(date +%Y%m%d).tar.gz /etc/vibecode-fleet/

# Automated backup
cat > /etc/cron.daily/vibecode-fleet-backup <<'EOF'
#!/bin/bash
BACKUP_DIR=/backup/vibecode-fleet
mkdir -p $BACKUP_DIR
sqlite3 /var/lib/vibecode/fleet.db ".backup $BACKUP_DIR/fleet-$(date +%Y%m%d).db"
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
EOF

chmod +x /etc/cron.daily/vibecode-fleet-backup
```

### Restore

```bash
# Stop fleet manager
sudo systemctl stop vibecode-fleet

# Restore database
cp /backup/fleet-20250101.db /var/lib/vibecode/fleet.db

# Restore configuration
tar xzf /backup/fleet-config-20250101.tar.gz -C /

# Start fleet manager
sudo systemctl start vibecode-fleet
```

## Upgrading

### Fleet Manager

```bash
# Backup current installation
sudo cp /usr/local/bin/fleet-manager /usr/local/bin/fleet-manager.backup

# Download new version
curl -O https://releases.vibecode.com/fleet/v1.1.0/fleet-manager
sudo install -m 755 fleet-manager /usr/local/bin/

# Restart service
sudo systemctl restart vibecode-fleet

# Verify
fleet-manager --version
```

### Host Agents

```bash
# Rolling update
for host in mac-{01..10}.local; do
    echo "Updating $host..."

    # Drain host
    curl -X POST http://localhost:8080/api/v1/hosts/$host/drain

    # Wait for containers to migrate
    sleep 60

    # Update agent
    ssh $host "sudo curl -O https://releases.vibecode.com/agent/v1.1.0/vibecode-agent && \
               sudo install -m 755 vibecode-agent /usr/local/bin/ && \
               sudo launchctl restart com.vibecode.agent"

    # Verify
    ssh $host "vibecode-agent --version"

    # Un-drain
    curl -X POST http://localhost:8080/api/v1/hosts/$host/undrain

    echo "$host updated successfully"
done
```

## Production Checklist

- [ ] Fleet manager running and healthy
- [ ] All Mac hosts discovered
- [ ] SSH key-based auth working
- [ ] AgentAPI accessible on all hosts
- [ ] Prometheus metrics exported
- [ ] Grafana dashboards configured
- [ ] Backup automation enabled
- [ ] TLS/authentication configured
- [ ] Network policies applied
- [ ] Log rotation configured
- [ ] Alerting rules defined
- [ ] Runbooks documented
- [ ] DR procedures tested

## Support

- Documentation: https://docs.vibecode.com/fleet
- Issues: https://github.com/vibecode/fleet/issues
- Slack: #fleet-orchestration

---

**Deployment Status**: Ready for Production
**Tested on**: macOS 13+, Ubuntu 22.04+
**Fleet Size**: 10-100 Mac hosts
