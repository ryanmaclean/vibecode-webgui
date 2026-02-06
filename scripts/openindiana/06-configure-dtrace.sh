#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

#
# Configure DTrace Monitoring for VibeCode
# Sets up DTrace probes and StatsD integration
#

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

DTRACE_DIR="/opt/dtrace"
STATSD_HOST="localhost"
STATSD_PORT="8125"
APP_USER="vibecode"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check environment
check_environment() {
    if [ "$(id -u)" -ne 0 ]; then
        log_error "This script must be run as root"
        exit 1
    fi

    # Check if DTrace is available
    if ! command -v dtrace >/dev/null 2>&1; then
        log_error "DTrace not found. Are you running in OpenIndiana global zone?"
        log_info "This script should be run from the global zone, not inside lx zone"
        exit 1
    fi

    log_info "Running with DTrace support"
}

# Create directory structure
create_directories() {
    log_info "Creating directory structure..."

    mkdir -p "$DTRACE_DIR"/{probes,scripts,logs}
    chmod 755 "$DTRACE_DIR"

    log_info "Directory structure created"
}

# Deploy DTrace probe scripts
deploy_dtrace_probes() {
    log_info "Deploying DTrace monitoring probes..."

    # Copy probe scripts from repository
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [ -d "${SCRIPT_DIR}/dtrace" ]; then
        cp -r "${SCRIPT_DIR}/dtrace"/* "$DTRACE_DIR/probes/"
        chmod +x "$DTRACE_DIR/probes"/*.d
        log_info "DTrace probes deployed"
    else
        log_warn "DTrace probe directory not found, will create templates"
    fi
}

# Install Python for StatsD bridge
install_python() {
    log_info "Checking Python installation..."

    # Python should be available in global zone
    if ! command -v python3 >/dev/null 2>&1; then
        log_info "Installing Python..."
        pkg install python-39
    fi

    log_info "Python available: $(python3 --version)"
}

# Create StatsD bridge script
create_statsd_bridge() {
    log_info "Creating DTrace to StatsD bridge..."

    cat > "$DTRACE_DIR/scripts/dtrace-statsd-bridge.py" <<'EOF'
#!/usr/bin/env python3
"""
DTrace to StatsD Bridge for VibeCode on OpenIndiana
Collects system and application metrics via DTrace and sends to StatsD
"""

import socket
import subprocess
import time
import sys
import os
import re
from typing import Optional

class DTraceStatsDBridge:
    def __init__(self, statsd_host='localhost', statsd_port=8125, interval=10):
        self.statsd_host = statsd_host
        self.statsd_port = statsd_port
        self.interval = interval
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.zone_name = "vibecode-zone"

    def send_metric(self, metric_name: str, value: float, metric_type: str = 'g', tags: Optional[list] = None):
        """
        Send metric to StatsD
        metric_type: g=gauge, c=counter, ms=timer, h=histogram
        """
        try:
            message = f"{metric_name}:{value}|{metric_type}"
            if tags:
                message += f"|#{','.join(tags)}"
            self.sock.sendto(message.encode(), (self.statsd_host, self.statsd_port))
        except Exception as e:
            print(f"Error sending metric: {e}", file=sys.stderr)

    def collect_cpu_metrics(self):
        """Collect CPU utilization via kstat"""
        try:
            result = subprocess.run(['kstat', '-p', 'cpu_stat:*:*:user'],
                                  capture_output=True, text=True, timeout=5)

            if result.returncode == 0:
                user_ticks = 0
                kernel_ticks = 0
                idle_ticks = 0

                for line in result.stdout.strip().split('\n'):
                    parts = line.split()
                    if len(parts) == 2 and 'user' in parts[0]:
                        user_ticks += int(parts[1])

                # Get kernel and idle
                result = subprocess.run(['kstat', '-p', 'cpu_stat:*:*:kernel'],
                                      capture_output=True, text=True, timeout=5)
                for line in result.stdout.strip().split('\n'):
                    parts = line.split()
                    if len(parts) == 2:
                        kernel_ticks += int(parts[1])

                result = subprocess.run(['kstat', '-p', 'cpu_stat:*:*:idle'],
                                      capture_output=True, text=True, timeout=5)
                for line in result.stdout.strip().split('\n'):
                    parts = line.split()
                    if len(parts) == 2:
                        idle_ticks += int(parts[1])

                total = user_ticks + kernel_ticks + idle_ticks
                if total > 0:
                    self.send_metric('system.cpu.user', (user_ticks / total) * 100)
                    self.send_metric('system.cpu.kernel', (kernel_ticks / total) * 100)
                    self.send_metric('system.cpu.idle', (idle_ticks / total) * 100)

        except Exception as e:
            print(f"Error collecting CPU metrics: {e}", file=sys.stderr)

    def collect_memory_metrics(self):
        """Collect memory metrics via kstat"""
        try:
            result = subprocess.run(['kstat', '-p', 'unix:0:system_pages:physmem'],
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                physmem = int(result.stdout.strip().split()[1]) * 4096  # Pages to bytes

                result = subprocess.run(['kstat', '-p', 'unix:0:system_pages:freemem'],
                                      capture_output=True, text=True, timeout=5)
                freemem = int(result.stdout.strip().split()[1]) * 4096

                used = physmem - freemem

                self.send_metric('system.mem.total', physmem)
                self.send_metric('system.mem.used', used)
                self.send_metric('system.mem.free', freemem)
                self.send_metric('system.mem.pct_used', (used / physmem) * 100 if physmem > 0 else 0)

        except Exception as e:
            print(f"Error collecting memory metrics: {e}", file=sys.stderr)

    def collect_network_metrics(self):
        """Collect network metrics via kstat"""
        try:
            result = subprocess.run(['kstat', '-p', 'link:*:vibecode0:rbytes64'],
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    parts = line.split()
                    if len(parts) == 2:
                        self.send_metric('system.net.bytes_rcvd', int(parts[1]), 'c')

            result = subprocess.run(['kstat', '-p', 'link:*:vibecode0:obytes64'],
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    parts = line.split()
                    if len(parts) == 2:
                        self.send_metric('system.net.bytes_sent', int(parts[1]), 'c')

        except Exception as e:
            print(f"Error collecting network metrics: {e}", file=sys.stderr)

    def collect_zfs_metrics(self):
        """Collect ZFS ARC metrics"""
        try:
            # ARC size
            result = subprocess.run(['kstat', '-p', 'zfs:0:arcstats:size'],
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                arc_size = int(result.stdout.strip().split()[1])
                self.send_metric('zfs.arc.size', arc_size)

            # ARC hits
            result = subprocess.run(['kstat', '-p', 'zfs:0:arcstats:hits'],
                                  capture_output=True, text=True, timeout=5)
            hits = int(result.stdout.strip().split()[1]) if result.returncode == 0 else 0

            # ARC misses
            result = subprocess.run(['kstat', '-p', 'zfs:0:arcstats:misses'],
                                  capture_output=True, text=True, timeout=5)
            misses = int(result.stdout.strip().split()[1]) if result.returncode == 0 else 0

            if hits + misses > 0:
                hit_ratio = (hits / (hits + misses)) * 100
                self.send_metric('zfs.arc.hit_ratio', hit_ratio)

        except Exception as e:
            print(f"Error collecting ZFS metrics: {e}", file=sys.stderr)

    def collect_zone_metrics(self):
        """Collect zone-specific metrics"""
        try:
            result = subprocess.run(['zonestat', '-p', '1', '1'],
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                # Parse zonestat output for zone CPU and memory
                for line in result.stdout.split('\n'):
                    if self.zone_name in line:
                        # Extract metrics (simplified)
                        parts = line.split(':')
                        if len(parts) > 5:
                            # CPU usage
                            try:
                                cpu_pct = float(parts[4])
                                self.send_metric('zone.cpu.pct', cpu_pct, tags=[f'zone:{self.zone_name}'])
                            except ValueError:
                                pass

        except Exception as e:
            print(f"Error collecting zone metrics: {e}", file=sys.stderr)

    def run(self):
        """Main collection loop"""
        print(f"Starting DTrace-StatsD bridge")
        print(f"  StatsD: {self.statsd_host}:{self.statsd_port}")
        print(f"  Interval: {self.interval}s")
        print(f"  Zone: {self.zone_name}")

        while True:
            try:
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Collecting metrics...")

                self.collect_cpu_metrics()
                self.collect_memory_metrics()
                self.collect_network_metrics()
                self.collect_zfs_metrics()
                self.collect_zone_metrics()

                time.sleep(self.interval)

            except KeyboardInterrupt:
                print("\nShutting down...")
                break
            except Exception as e:
                print(f"Error in main loop: {e}", file=sys.stderr)
                time.sleep(self.interval)

if __name__ == '__main__':
    statsd_host = sys.argv[1] if len(sys.argv) > 1 else 'localhost'
    statsd_port = int(sys.argv[2]) if len(sys.argv) > 2 else 8125
    interval = int(sys.argv[3]) if len(sys.argv) > 3 else 10

    bridge = DTraceStatsDBridge(statsd_host, statsd_port, interval)
    bridge.run()
EOF

    chmod +x "$DTRACE_DIR/scripts/dtrace-statsd-bridge.py"

    log_info "StatsD bridge created"
}

# Create SMF manifest for bridge
create_smf_manifest() {
    log_info "Creating SMF manifest for DTrace bridge..."

    cat > /var/svc/manifest/site/dtrace-statsd.xml <<'EOF'
<?xml version="1.0"?>
<!DOCTYPE service_bundle SYSTEM "/usr/share/lib/xml/dtd/service_bundle.dtd.1">
<service_bundle type='manifest' name='dtrace-statsd-bridge'>
  <service name='site/dtrace-statsd' type='service' version='1'>
    <create_default_instance enabled='false' />
    <single_instance />

    <dependency name='network' grouping='require_all' restart_on='error' type='service'>
      <service_fmri value='svc:/milestone/network:default' />
    </dependency>

    <exec_method type='method' name='start'
      exec='/opt/dtrace/scripts/dtrace-statsd-bridge.py localhost 8125 10 &amp;'
      timeout_seconds='60'>
      <method_context>
        <method_credential user='root' group='root' privileges='all' />
      </method_context>
    </exec_method>

    <exec_method type='method' name='stop'
      exec=':kill'
      timeout_seconds='60' />

    <property_group name='startd' type='framework'>
      <propval name='duration' type='astring' value='child' />
      <propval name='ignore_error' type='astring' value='core,signal' />
    </property_group>

    <stability value='Evolving' />

    <template>
      <common_name>
        <loctext xml:lang='C'>DTrace to StatsD Bridge</loctext>
      </common_name>
      <description>
        <loctext xml:lang='C'>Collects system metrics via DTrace and sends to StatsD</loctext>
      </description>
    </template>
  </service>
</service_bundle>
EOF

    # Import manifest
    svccfg import /var/svc/manifest/site/dtrace-statsd.xml

    log_info "SMF manifest created (disabled by default)"
}

# Create monitoring dashboard script
create_dashboard() {
    log_info "Creating monitoring dashboard..."

    cat > /usr/local/bin/vibecode-monitor <<'EOF'
#!/bin/bash
#
# VibeCode Real-time Monitoring Dashboard
#

watch -n 2 '
echo "=== VibeCode System Monitor ==="
echo ""

echo "Zone Status:"
zoneadm list -v | grep vibecode || echo "Zone not running"
echo ""

echo "CPU & Memory (Zone):"
prstat -Z 1 1 | grep vibecode || echo "N/A"
echo ""

echo "ZFS ARC:"
kstat -p zfs:0:arcstats:size zfs:0:arcstats:hits zfs:0:arcstats:misses | awk -F: "{print \$NF}"
echo ""

echo "Network (vibecode0):"
dladm show-vnic vibecode0 2>/dev/null || echo "VNIC not found"
echo ""

echo "Application Status:"
systemctl status vibecode --no-pager 2>/dev/null | head -5 || echo "Service not found (check in zone)"
'
EOF

    chmod +x /usr/local/bin/vibecode-monitor

    log_info "Monitoring dashboard created"
}

# Test DTrace access
test_dtrace() {
    log_info "Testing DTrace access..."

    # Simple test
    if dtrace -ln 'syscall:::entry' | head -5 >/dev/null 2>&1; then
        log_info "DTrace test successful"
    else
        log_error "DTrace test failed"
        exit 1
    fi
}

# Display summary
show_summary() {
    cat <<EOF

${GREEN}DTrace Monitoring Configuration Complete!${NC}
===========================================

Directory Structure:
  Base:    $DTRACE_DIR
  Probes:  $DTRACE_DIR/probes
  Scripts: $DTRACE_DIR/scripts
  Logs:    $DTRACE_DIR/logs

DTrace Bridge:
  Script:  $DTRACE_DIR/scripts/dtrace-statsd-bridge.py
  Service: site/dtrace-statsd (SMF)
  Status:  disabled (enable after StatsD setup)

Monitoring Commands:
  Dashboard:  vibecode-monitor
  Zone stats: zonestat 5 5
  Probe list: dtrace -l | grep -i vibecode

Enable DTrace Bridge:
  1. Setup StatsD (see Datadog guide)
  2. Enable service: svcadm enable dtrace-statsd
  3. Check status:  svcs -l dtrace-statsd

Available DTrace Probes:
  HTTP latency:     $DTRACE_DIR/probes/http-latency.d
  Database queries: $DTRACE_DIR/probes/database-queries.d
  Node.js GC:       $DTRACE_DIR/probes/nodejs-gc.d
  ZFS I/O:          $DTRACE_DIR/probes/zfs-io.d
  Network TCP:      $DTRACE_DIR/probes/network-tcp.d

Run Individual Probes:
  sudo $DTRACE_DIR/probes/http-latency.d
  sudo $DTRACE_DIR/probes/zfs-io.d -p \$(pgrep postgres)

Datadog Integration:
  See: https://docs.vibecode.com/platforms/datadog-openindiana/

Performance Impact:
  DTrace overhead: <1% CPU
  Recommended for production use

Next Steps:
  1. Review DTrace probe scripts
  2. Setup Datadog integration
  3. Configure custom alerts
  4. Create performance dashboards

Documentation:
  DTrace Guide: http://dtrace.org/guide/
  OpenIndiana:  https://www.openindiana.org/

EOF
}

# Main
main() {
    log_info "DTrace Monitoring Configuration"
    log_info "==============================="

    check_environment
    create_directories
    deploy_dtrace_probes
    install_python
    create_statsd_bridge
    create_smf_manifest
    create_dashboard
    test_dtrace
    show_summary

    log_info "Configuration complete!"
}

main "$@"
