#!/usr/bin/env python3
"""
Production Monitoring and Alerting Setup.

Configures comprehensive monitoring, alerting, and observability for VibeCode.

Features:
- Datadog integration and dashboards
- Alerting and notification setup
- Performance monitoring and SLIs
- Log aggregation and analysis
- Real-time metrics and observability
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


class MonitoringSetup:
    """Handles production monitoring setup and configuration."""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.monitoring_log = project_root / "monitoring-setup.log"
        self._log_file = None

    def _get_log_file(self):
        """Get or create the log file handle."""
        if self._log_file is None:
            self._log_file = open(self.monitoring_log, 'a')
        return self._log_file

    def _write_to_log(self, message: str) -> None:
        """Write message to log file."""
        log_file = self._get_log_file()
        log_file.write(message + '\n')
        log_file.flush()

    def log(self, message: str) -> None:
        """Log a message in green with timestamp."""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        formatted = f"{Colors.GREEN}[{timestamp}]{Colors.NC} {message}"
        print(formatted)
        self._write_to_log(f"[{timestamp}] {message}")

    def warn(self, message: str) -> None:
        """Log a warning message in yellow."""
        formatted = f"{Colors.YELLOW}[WARNING]{Colors.NC} {message}"
        print(formatted)
        self._write_to_log(f"[WARNING] {message}")

    def error(self, message: str) -> None:
        """Log an error message in red and exit."""
        formatted = f"{Colors.RED}[ERROR]{Colors.NC} {message}"
        print(formatted)
        self._write_to_log(f"[ERROR] {message}")
        sys.exit(1)

    def info(self, message: str) -> None:
        """Log an info message in blue."""
        formatted = f"{Colors.BLUE}[INFO]{Colors.NC} {message}"
        print(formatted)
        self._write_to_log(f"[INFO] {message}")

    def show_banner(self) -> None:
        """Display the setup banner."""
        banner = """
╔══════════════════════════════════════════════════════════════╗
║              Production Monitoring Setup                    ║
║                                                              ║
║  Datadog integration and dashboards                         ║
║  Alerting and notification setup                            ║
║  Performance monitoring and SLIs                            ║
║  Log aggregation and analysis                               ║
║  Real-time metrics and observability                        ║
╚══════════════════════════════════════════════════════════════╝
"""
        print(banner)

    def create_datadog_dashboards(self) -> None:
        """Create Datadog dashboard configurations."""
        self.log("Creating Datadog dashboard configurations...")

        datadog_dir = self.project_root / "monitoring" / "datadog"
        datadog_dir.mkdir(parents=True, exist_ok=True)

        # Main application dashboard
        application_dashboard = {
            "title": "VibeCode WebGUI - Production Dashboard",
            "description": "Comprehensive monitoring dashboard for VibeCode WebGUI application",
            "widgets": [
                {
                    "id": 1,
                    "definition": {
                        "title": "Application Health Overview",
                        "type": "query_value",
                        "requests": [
                            {
                                "q": "avg:vibecode.health.status{env:production}",
                                "aggregator": "avg"
                            }
                        ],
                        "precision": 0
                    },
                    "layout": {"x": 0, "y": 0, "width": 4, "height": 2}
                },
                {
                    "id": 2,
                    "definition": {
                        "title": "Request Rate (req/min)",
                        "type": "timeseries",
                        "requests": [
                            {
                                "q": "sum:vibecode.http.requests{env:production}.as_rate()",
                                "display_type": "line"
                            }
                        ]
                    },
                    "layout": {"x": 4, "y": 0, "width": 8, "height": 4}
                },
                {
                    "id": 3,
                    "definition": {
                        "title": "Response Time (p95)",
                        "type": "timeseries",
                        "requests": [
                            {
                                "q": "p95:vibecode.http.response_time{env:production}",
                                "display_type": "line"
                            }
                        ]
                    },
                    "layout": {"x": 0, "y": 4, "width": 6, "height": 4}
                },
                {
                    "id": 4,
                    "definition": {
                        "title": "Error Rate (%)",
                        "type": "timeseries",
                        "requests": [
                            {
                                "q": "sum:vibecode.http.errors{env:production}.as_rate() / sum:vibecode.http.requests{env:production}.as_rate() * 100",
                                "display_type": "line"
                            }
                        ]
                    },
                    "layout": {"x": 6, "y": 4, "width": 6, "height": 4}
                },
                {
                    "id": 5,
                    "definition": {
                        "title": "Database Performance",
                        "type": "timeseries",
                        "requests": [
                            {
                                "q": "avg:vibecode.db.query.duration{env:production}",
                                "display_type": "line"
                            }
                        ]
                    },
                    "layout": {"x": 0, "y": 8, "width": 6, "height": 4}
                },
                {
                    "id": 6,
                    "definition": {
                        "title": "Cache Hit Rate (%)",
                        "type": "query_value",
                        "requests": [
                            {
                                "q": "avg:vibecode.cache.hit_rate{env:production} * 100",
                                "aggregator": "avg"
                            }
                        ],
                        "precision": 1
                    },
                    "layout": {"x": 6, "y": 8, "width": 6, "height": 4}
                }
            ],
            "layout_type": "ordered",
            "is_read_only": False,
            "notify_list": [],
            "reflow_type": "fixed"
        }

        app_dashboard_path = datadog_dir / "application-dashboard.json"
        app_dashboard_path.write_text(json.dumps(application_dashboard, indent=2))

        # Infrastructure dashboard
        infrastructure_dashboard = {
            "title": "VibeCode WebGUI - Infrastructure Dashboard",
            "description": "Infrastructure and resource monitoring for VibeCode WebGUI",
            "widgets": [
                {
                    "id": 1,
                    "definition": {
                        "title": "CPU Usage (%)",
                        "type": "timeseries",
                        "requests": [
                            {
                                "q": "avg:system.cpu.user{service:vibecode-webgui,env:production}",
                                "display_type": "line"
                            }
                        ]
                    },
                    "layout": {"x": 0, "y": 0, "width": 6, "height": 4}
                },
                {
                    "id": 2,
                    "definition": {
                        "title": "Memory Usage (MB)",
                        "type": "timeseries",
                        "requests": [
                            {
                                "q": "avg:system.mem.used{service:vibecode-webgui,env:production}",
                                "display_type": "line"
                            }
                        ]
                    },
                    "layout": {"x": 6, "y": 0, "width": 6, "height": 4}
                },
                {
                    "id": 3,
                    "definition": {
                        "title": "Disk I/O",
                        "type": "timeseries",
                        "requests": [
                            {
                                "q": "avg:system.io.r_s{service:vibecode-webgui,env:production}, avg:system.io.w_s{service:vibecode-webgui,env:production}",
                                "display_type": "line"
                            }
                        ]
                    },
                    "layout": {"x": 0, "y": 4, "width": 12, "height": 4}
                }
            ],
            "layout_type": "ordered"
        }

        infra_dashboard_path = datadog_dir / "infrastructure-dashboard.json"
        infra_dashboard_path.write_text(json.dumps(infrastructure_dashboard, indent=2))

        self.log("Datadog dashboard configurations created")

    def create_alerting_rules(self) -> None:
        """Create alerting rules configuration."""
        self.log("Creating alerting rules...")

        alerts_dir = self.project_root / "monitoring" / "alerts"
        alerts_dir.mkdir(parents=True, exist_ok=True)

        critical_alerts = """\
# Critical Production Alerts for VibeCode WebGUI

alerts:
  - name: "High Error Rate"
    description: "Error rate is above 5% for 5 minutes"
    query: "sum:vibecode.http.errors{env:production}.as_rate() / sum:vibecode.http.requests{env:production}.as_rate() * 100 > 5"
    threshold: 5
    evaluation_delay: 300
    notify:
      - "@slack-critical-alerts"
      - "@pagerduty-oncall"
    tags:
      - "severity:critical"
      - "service:vibecode-webgui"

  - name: "High Response Time"
    description: "95th percentile response time is above 2 seconds"
    query: "p95:vibecode.http.response_time{env:production} > 2000"
    threshold: 2000
    evaluation_delay: 300
    notify:
      - "@slack-performance-alerts"
    tags:
      - "severity:warning"
      - "service:vibecode-webgui"

  - name: "Database Connection Issues"
    description: "Database connection pool exhaustion"
    query: "avg:vibecode.db.connections.active{env:production} / avg:vibecode.db.connections.max{env:production} * 100 > 90"
    threshold: 90
    evaluation_delay: 180
    notify:
      - "@slack-critical-alerts"
      - "@pagerduty-oncall"
    tags:
      - "severity:critical"
      - "service:database"

  - name: "Memory Usage High"
    description: "Memory usage is above 85%"
    query: "avg:system.mem.pct_usable{service:vibecode-webgui,env:production} < 15"
    threshold: 15
    evaluation_delay: 600
    notify:
      - "@slack-infrastructure-alerts"
    tags:
      - "severity:warning"
      - "service:infrastructure"

  - name: "Cache Hit Rate Low"
    description: "Cache hit rate is below 80%"
    query: "avg:vibecode.cache.hit_rate{env:production} < 0.8"
    threshold: 0.8
    evaluation_delay: 900
    notify:
      - "@slack-performance-alerts"
    tags:
      - "severity:warning"
      - "service:cache"
"""

        alerts_path = alerts_dir / "critical-alerts.yaml"
        alerts_path.write_text(critical_alerts)

        self.log("Alerting rules created")

    def create_monitoring_config(self) -> None:
        """Create monitoring configuration."""
        self.log("Creating monitoring configuration...")

        monitoring_config = """\
# Production Monitoring Configuration

monitoring:
  datadog:
    api_key: "${DD_API_KEY}"
    app_key: "${DD_APP_KEY}"
    site: "datadoghq.com"
    service: "vibecode-webgui"
    environment: "production"
    version: "1.0.0"

    # APM Configuration
    apm:
      enabled: true
      sample_rate: 1.0

    # Log Configuration
    logs:
      enabled: true
      level: "info"
      format: "json"

    # Metrics Configuration
    metrics:
      enabled: true
      histogram_percentiles: [0.5, 0.75, 0.95, 0.99]

  # Health Checks
  health_checks:
    - name: "application"
      endpoint: "/api/health"
      interval: 30
      timeout: 5

    - name: "database"
      endpoint: "/api/health/database"
      interval: 60
      timeout: 10

    - name: "cache"
      endpoint: "/api/health/cache"
      interval: 60
      timeout: 5

  # SLIs (Service Level Indicators)
  slis:
    availability:
      target: 99.9
      measurement: "uptime"

    latency:
      target: 500  # milliseconds
      measurement: "p95_response_time"

    error_rate:
      target: 1  # percent
      measurement: "error_percentage"

  # Notification Channels
  notifications:
    slack:
      critical_channel: "#alerts-critical"
      warning_channel: "#alerts-warning"
      info_channel: "#monitoring"

    email:
      critical_recipients:
        - "oncall@company.com"
        - "engineering-leads@company.com"
      warning_recipients:
        - "engineering@company.com"
"""

        monitoring_dir = self.project_root / "monitoring"
        monitoring_dir.mkdir(parents=True, exist_ok=True)

        config_path = monitoring_dir / "monitoring-config.yaml"
        config_path.write_text(monitoring_config)

        self.log("Monitoring configuration created")

    def create_log_aggregation(self) -> None:
        """Set up log aggregation configuration."""
        self.log("Setting up log aggregation...")

        logs_dir = self.project_root / "monitoring" / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)

        logstash_config = """\
# Logstash configuration for VibeCode WebGUI logs

input {
  beats {
    port => 5044
  }

  file {
    path => "/app/logs/*.log"
    start_position => "beginning"
    codec => "json"
  }
}

filter {
  if [service] == "vibecode-webgui" {
    # Parse application logs
    json {
      source => "message"
    }

    # Add environment information
    mutate {
      add_field => { "environment" => "production" }
      add_field => { "application" => "vibecode-webgui" }
    }

    # Parse timestamp
    date {
      match => [ "timestamp", "ISO8601" ]
    }

    # Classify log levels
    if [level] == "error" {
      mutate {
        add_tag => [ "error", "alert" ]
      }
    }
  }
}

output {
  # Send to Datadog
  datadog_logs {
    api_key => "${DD_API_KEY}"
    host => "http-intake.logs.datadoghq.com"
  }

  # Send to Elasticsearch for local analysis
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "vibecode-logs-%{+YYYY.MM.dd}"
  }

  # Debug output
  stdout {
    codec => rubydebug
  }
}
"""

        logstash_path = logs_dir / "logstash.conf"
        logstash_path.write_text(logstash_config)

        self.log("Log aggregation configuration created")

    def create_performance_monitoring(self) -> None:
        """Create performance monitoring scripts."""
        self.log("Creating performance monitoring scripts...")

        scripts_dir = self.project_root / "monitoring" / "scripts"
        scripts_dir.mkdir(parents=True, exist_ok=True)

        performance_script = """\
#!/bin/bash

# Performance monitoring script
# Runs performance checks and reports metrics

set -euo pipefail

ENDPOINT="${1:-http://localhost:3000}"
RESULTS_FILE="/tmp/performance-results.json"

echo "Running performance checks against $ENDPOINT..."

# Check response time
response_time=$(curl -w "%{time_total}" -s -o /dev/null "$ENDPOINT/api/health")
echo "Response time: ${response_time}s"

# Check database performance
db_response_time=$(curl -w "%{time_total}" -s -o /dev/null "$ENDPOINT/api/health/database")
echo "Database response time: ${db_response_time}s"

# Check cache performance
cache_response_time=$(curl -w "%{time_total}" -s -o /dev/null "$ENDPOINT/api/health/cache")
echo "Cache response time: ${cache_response_time}s"

# Generate JSON report
cat << EOJ > "$RESULTS_FILE"
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "endpoint": "$ENDPOINT",
  "metrics": {
    "response_time": $response_time,
    "database_response_time": $db_response_time,
    "cache_response_time": $cache_response_time
  }
}
EOJ

echo "Performance results saved to $RESULTS_FILE"
"""

        perf_script_path = scripts_dir / "performance-check.sh"
        perf_script_path.write_text(performance_script)
        perf_script_path.chmod(perf_script_path.stat().st_mode | 0o111)

        self.log("Performance monitoring scripts created")

    def create_deployment_verification(self) -> None:
        """Create deployment verification script."""
        self.log("Creating deployment verification script...")

        scripts_dir = self.project_root / "scripts"
        scripts_dir.mkdir(parents=True, exist_ok=True)

        verification_script = """\
#!/bin/bash

# Deployment Verification Script
# Verifies that deployment is healthy and functioning

set -euo pipefail

ENDPOINT="${1:-http://localhost:3000}"
MAX_RETRIES=30
RETRY_INTERVAL=10

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Wait for application to be ready
wait_for_app() {
    local retries=0

    log "Waiting for application to be ready at $ENDPOINT..."

    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s "$ENDPOINT/api/health" > /dev/null; then
            log "Application is ready!"
            return 0
        fi

        retries=$((retries + 1))
        log "Attempt $retries/$MAX_RETRIES failed, retrying in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done

    log "Application failed to become ready after $MAX_RETRIES attempts"
    return 1
}

# Run health checks
run_health_checks() {
    log "Running comprehensive health checks..."

    # Basic health check
    if ! curl -f -s "$ENDPOINT/api/health" | grep -q '"status":"ok"'; then
        log "Basic health check failed"
        return 1
    fi
    log "Basic health check passed"

    # Database health check
    if ! curl -f -s "$ENDPOINT/api/health/database" | grep -q '"status":"ok"'; then
        log "Database health check failed"
        return 1
    fi
    log "Database health check passed"

    # Cache health check
    if ! curl -f -s "$ENDPOINT/api/health/cache" | grep -q '"status":"ok"'; then
        log "Cache health check failed"
        return 1
    fi
    log "Cache health check passed"

    log "All health checks passed!"
    return 0
}

# Main verification
main() {
    log "Starting deployment verification for $ENDPOINT"

    if wait_for_app && run_health_checks; then
        log "Deployment verification successful!"
        return 0
    else
        log "Deployment verification failed!"
        return 1
    fi
}

main "$@"
"""

        verify_script_path = scripts_dir / "verify-deployment.sh"
        verify_script_path.write_text(verification_script)
        verify_script_path.chmod(verify_script_path.stat().st_mode | 0o111)

        self.log("Deployment verification script created")

    def generate_monitoring_report(self) -> None:
        """Generate monitoring setup report."""
        self.log("Generating monitoring setup report...")

        report_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        report = f"""\
# Production Monitoring Setup Report

Generated on: {report_date}

## Components Configured

### Datadog Integration
- Application dashboard configuration
- Infrastructure dashboard configuration
- APM (Application Performance Monitoring) setup
- Log aggregation and analysis

### Alerting System
- Critical alerts for error rates and response times
- Infrastructure alerts for resource usage
- Database performance monitoring
- Cache performance tracking

### Health Checks
- Application health endpoint monitoring
- Database connectivity checks
- Cache availability verification
- Automated deployment verification

### Performance Monitoring
- Response time tracking
- Database query performance
- Cache hit rate monitoring
- Resource utilization metrics

## Configuration Files Created

### Datadog Dashboards
- `monitoring/datadog/application-dashboard.json`
- `monitoring/datadog/infrastructure-dashboard.json`

### Alerting Configuration
- `monitoring/alerts/critical-alerts.yaml`

### Monitoring Configuration
- `monitoring/monitoring-config.yaml`
- `monitoring/logs/logstash.conf`

### Scripts
- `monitoring/scripts/performance-check.sh`
- `scripts/verify-deployment.sh`

## Next Steps

1. **Configure Datadog Account**
   - Set up DD_API_KEY and DD_APP_KEY environment variables
   - Import dashboard configurations
   - Set up notification channels

2. **Deploy Monitoring Infrastructure**
   - Deploy log aggregation stack
   - Configure alerting rules
   - Set up notification integrations

3. **Test Monitoring**
   - Run performance checks
   - Verify alert functionality
   - Test deployment verification

4. **Set Up SLOs (Service Level Objectives)**
   - Define availability targets (99.9%)
   - Set latency targets (p95 < 500ms)
   - Establish error rate thresholds (<1%)

## Monitoring URLs
- Application Dashboard: https://app.datadoghq.com/dashboard/[dashboard-id]
- Infrastructure Dashboard: https://app.datadoghq.com/dashboard/[dashboard-id]
- Log Explorer: https://app.datadoghq.com/logs
- APM Traces: https://app.datadoghq.com/apm/traces

## Support Contacts
- On-call Engineer: oncall@company.com
- Engineering Team: engineering@company.com
- Monitoring Issues: monitoring@company.com
"""

        report_path = self.project_root / "monitoring-setup-report.md"
        report_path.write_text(report)

        self.log("Monitoring setup report saved to monitoring-setup-report.md")

    def run(self) -> int:
        """Run the complete monitoring setup."""
        self.show_banner()

        self.log("Setting up production monitoring...")

        try:
            self.create_datadog_dashboards()
            self.create_alerting_rules()
            self.create_monitoring_config()
            self.create_log_aggregation()
            self.create_performance_monitoring()
            self.create_deployment_verification()
            self.generate_monitoring_report()

            self.log("Production monitoring setup completed!")
            self.log("Check monitoring-setup-report.md for detailed configuration")
            self.log("Configure Datadog credentials and deploy monitoring stack")

            return 0

        except Exception as e:
            self.error(f"Setup failed: {e}")
            return 1
        finally:
            if self._log_file:
                self._log_file.close()


def main(project_root: Optional[Path] = None) -> int:
    """
    Main entry point for production monitoring setup.

    Args:
        project_root: Root directory of the project. If None, uses parent of script directory.

    Returns:
        0 on success, 1 on failure
    """
    if project_root is None:
        script_dir = Path(__file__).parent.resolve()
        project_root = script_dir.parent

    setup = MonitoringSetup(project_root)
    return setup.run()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Production Monitoring and Alerting Setup"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        help="Root directory of the project (default: parent of script directory)",
    )
    args = parser.parse_args()

    sys.exit(main(project_root=args.project_root))
