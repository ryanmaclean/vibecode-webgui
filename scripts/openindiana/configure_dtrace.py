#!/usr/bin/env python3
"""Configure DTrace Monitoring for VibeCode.

Sets up DTrace probes and StatsD integration on OpenIndiana.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

DTRACE_DIR = Path("/opt/dtrace")
STATSD_HOST = "localhost"
STATSD_PORT = "8125"
APP_USER = "vibecode"


@dataclass(frozen=True)
class Colors:
    """ANSI color codes for terminal output."""

    green: str = "\033[0;32m"
    yellow: str = "\033[1;33m"
    red: str = "\033[0;31m"
    reset: str = "\033[0m"


COLORS = Colors()

STATSD_BRIDGE_SCRIPT = '''\
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

                for line in result.stdout.strip().split('\\n'):
                    parts = line.split()
                    if len(parts) == 2 and 'user' in parts[0]:
                        user_ticks += int(parts[1])

                # Get kernel and idle
                result = subprocess.run(['kstat', '-p', 'cpu_stat:*:*:kernel'],
                                      capture_output=True, text=True, timeout=5)
                for line in result.stdout.strip().split('\\n'):
                    parts = line.split()
                    if len(parts) == 2:
                        kernel_ticks += int(parts[1])

                result = subprocess.run(['kstat', '-p', 'cpu_stat:*:*:idle'],
                                      capture_output=True, text=True, timeout=5)
                for line in result.stdout.strip().split('\\n'):
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
                for line in result.stdout.strip().split('\\n'):
                    parts = line.split()
                    if len(parts) == 2:
                        self.send_metric('system.net.bytes_rcvd', int(parts[1]), 'c')

            result = subprocess.run(['kstat', '-p', 'link:*:vibecode0:obytes64'],
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                for line in result.stdout.strip().split('\\n'):
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
                for line in result.stdout.split('\\n'):
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
                print("\\nShutting down...")
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
'''

SMF_MANIFEST = '''\
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
'''

MONITOR_DASHBOARD = '''\
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
kstat -p zfs:0:arcstats:size zfs:0:arcstats:hits zfs:0:arcstats:misses | awk -F: "{print \\$NF}"
echo ""

echo "Network (vibecode0):"
dladm show-vnic vibecode0 2>/dev/null || echo "VNIC not found"
echo ""

echo "Application Status:"
systemctl status vibecode --no-pager 2>/dev/null | head -5 || echo "Service not found (check in zone)"
'
'''


def log_info(message: str) -> None:
    """Print info message."""
    print(f"{COLORS.green}[INFO]{COLORS.reset} {message}")


def log_warn(message: str) -> None:
    """Print warning message."""
    print(f"{COLORS.yellow}[WARN]{COLORS.reset} {message}")


def log_error(message: str) -> None:
    """Print error message."""
    print(f"{COLORS.red}[ERROR]{COLORS.reset} {message}")


def run_command(
    cmd: list[str],
    *,
    check: bool = True,
    capture_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command."""
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture_output,
        text=True,
    )


def which(cmd: str) -> str | None:
    """Find command in PATH."""
    return shutil.which(cmd)


def check_environment() -> bool:
    """Check if environment is suitable."""
    if os.getuid() != 0:
        log_error("This script must be run as root")
        return False

    if not which("dtrace"):
        log_error("DTrace not found. Are you running in OpenIndiana global zone?")
        log_info("This script should be run from the global zone, not inside lx zone")
        return False

    log_info("Running with DTrace support")
    return True


def create_directories() -> None:
    """Create directory structure."""
    log_info("Creating directory structure...")

    for subdir in ["probes", "scripts", "logs"]:
        (DTRACE_DIR / subdir).mkdir(parents=True, exist_ok=True)

    DTRACE_DIR.chmod(0o755)

    log_info("Directory structure created")


def deploy_dtrace_probes() -> None:
    """Deploy DTrace probe scripts."""
    log_info("Deploying DTrace monitoring probes...")

    script_dir = Path(__file__).resolve().parent
    dtrace_src = script_dir / "dtrace"

    if dtrace_src.is_dir():
        probes_dir = DTRACE_DIR / "probes"
        for probe_file in dtrace_src.glob("*"):
            shutil.copy(probe_file, probes_dir)
            if probe_file.suffix == ".d":
                (probes_dir / probe_file.name).chmod(0o755)
        log_info("DTrace probes deployed")
    else:
        log_warn("DTrace probe directory not found, will create templates")


def install_python() -> None:
    """Check Python installation."""
    log_info("Checking Python installation...")

    if not which("python3"):
        log_info("Installing Python...")
        run_command(["pkg", "install", "python-39"])

    result = run_command(["python3", "--version"], capture_output=True)
    log_info(f"Python available: {result.stdout.strip()}")


def create_statsd_bridge() -> None:
    """Create DTrace to StatsD bridge script."""
    log_info("Creating DTrace to StatsD bridge...")

    bridge_path = DTRACE_DIR / "scripts" / "dtrace-statsd-bridge.py"
    bridge_path.write_text(STATSD_BRIDGE_SCRIPT)
    bridge_path.chmod(0o755)

    log_info("StatsD bridge created")


def create_smf_manifest() -> None:
    """Create SMF manifest for bridge."""
    log_info("Creating SMF manifest for DTrace bridge...")

    manifest_dir = Path("/var/svc/manifest/site")
    manifest_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = manifest_dir / "dtrace-statsd.xml"
    manifest_path.write_text(SMF_MANIFEST)

    # Import manifest
    run_command(["svccfg", "import", str(manifest_path)])

    log_info("SMF manifest created (disabled by default)")


def create_dashboard() -> None:
    """Create monitoring dashboard script."""
    log_info("Creating monitoring dashboard...")

    dashboard_path = Path("/usr/local/bin/vibecode-monitor")
    dashboard_path.parent.mkdir(parents=True, exist_ok=True)
    dashboard_path.write_text(MONITOR_DASHBOARD)
    dashboard_path.chmod(0o755)

    log_info("Monitoring dashboard created")


def test_dtrace() -> bool:
    """Test DTrace access."""
    log_info("Testing DTrace access...")

    try:
        result = run_command(
            ["dtrace", "-ln", "syscall:::entry"],
            capture_output=True,
            check=False,
        )
        if result.returncode == 0:
            log_info("DTrace test successful")
            return True
        else:
            log_error("DTrace test failed")
            return False
    except Exception:
        log_error("DTrace test failed")
        return False


def show_summary() -> None:
    """Display configuration summary."""
    print(f"""
{COLORS.green}DTrace Monitoring Configuration Complete!{COLORS.reset}
===========================================

Directory Structure:
  Base:    {DTRACE_DIR}
  Probes:  {DTRACE_DIR}/probes
  Scripts: {DTRACE_DIR}/scripts
  Logs:    {DTRACE_DIR}/logs

DTrace Bridge:
  Script:  {DTRACE_DIR}/scripts/dtrace-statsd-bridge.py
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
  HTTP latency:     {DTRACE_DIR}/probes/http-latency.d
  Database queries: {DTRACE_DIR}/probes/database-queries.d
  Node.js GC:       {DTRACE_DIR}/probes/nodejs-gc.d
  ZFS I/O:          {DTRACE_DIR}/probes/zfs-io.d
  Network TCP:      {DTRACE_DIR}/probes/network-tcp.d

Run Individual Probes:
  sudo {DTRACE_DIR}/probes/http-latency.d
  sudo {DTRACE_DIR}/probes/zfs-io.d -p $(pgrep postgres)

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
""")


def main() -> int:
    """Main entry point."""
    log_info("DTrace Monitoring Configuration")
    log_info("===============================")

    if not check_environment():
        return 1

    try:
        create_directories()
        deploy_dtrace_probes()
        install_python()
        create_statsd_bridge()
        create_smf_manifest()
        create_dashboard()

        if not test_dtrace():
            return 1

        show_summary()
        log_info("Configuration complete!")

        return 0
    except subprocess.CalledProcessError as e:
        log_error(f"Command failed: {e}")
        return 1
    except PermissionError as e:
        log_error(f"Permission denied: {e}")
        return 1
    except Exception as e:
        log_error(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
