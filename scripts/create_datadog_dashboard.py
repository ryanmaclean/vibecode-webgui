#!/usr/bin/env python3
"""
Create Datadog Dashboard for VibeCode VM Monitoring.

Creates dashboard JSON, monitor configurations, and SLO definitions
for Datadog observability.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional


def create_dashboard_json() -> dict:
    """Create the main dashboard configuration."""
    return {
        "title": "VibeCode VM Monitoring",
        "description": "Real-time monitoring of VibeCode virtual machines",
        "widgets": [
            {
                "id": 1,
                "definition": {
                    "title": "VM Start Success Rate",
                    "type": "query_value",
                    "requests": [
                        {
                            "q": "(sum:vibecode.vm.start.success{*}.as_count() / sum:vibecode.vm.start.attempt{*}.as_count()) * 100",
                            "aggregator": "avg"
                        }
                    ],
                    "custom_unit": "%",
                    "precision": 2
                }
            },
            {
                "id": 2,
                "definition": {
                    "title": "VM Boot Duration (p95)",
                    "type": "query_value",
                    "requests": [
                        {
                            "q": "p95:vibecode.vm.start.duration{*}",
                            "aggregator": "avg"
                        }
                    ],
                    "custom_unit": "ms"
                }
            },
            {
                "id": 3,
                "definition": {
                    "title": "Running VMs",
                    "type": "query_value",
                    "requests": [
                        {
                            "q": "max:vibecode.vm.running.count{*}",
                            "aggregator": "last"
                        }
                    ]
                }
            },
            {
                "id": 4,
                "definition": {
                    "title": "VM Start Attempts Over Time",
                    "type": "timeseries",
                    "requests": [
                        {
                            "q": "sum:vibecode.vm.start.attempt{*}.as_count()",
                            "display_type": "bars"
                        },
                        {
                            "q": "sum:vibecode.vm.start.success{*}.as_count()",
                            "display_type": "bars"
                        },
                        {
                            "q": "sum:vibecode.vm.start.failure{*}.as_count()",
                            "display_type": "bars"
                        }
                    ]
                }
            },
            {
                "id": 5,
                "definition": {
                    "title": "VM Boot Duration Distribution",
                    "type": "timeseries",
                    "requests": [
                        {
                            "q": "avg:vibecode.vm.start.duration{*}",
                            "display_type": "line"
                        },
                        {
                            "q": "p95:vibecode.vm.start.duration{*}",
                            "display_type": "line"
                        },
                        {
                            "q": "max:vibecode.vm.start.duration{*}",
                            "display_type": "line"
                        }
                    ]
                }
            },
            {
                "id": 6,
                "definition": {
                    "title": "VMs by Status",
                    "type": "toplist",
                    "requests": [
                        {
                            "q": "top(max:vibecode.vm.running.count{*} by {vm_name}, 10, 'mean', 'desc')"
                        }
                    ]
                }
            }
        ],
        "layout_type": "ordered",
        "template_variables": [
            {
                "name": "vm_name",
                "default": "*",
                "prefix": "vm_name"
            },
            {
                "name": "host",
                "default": "*",
                "prefix": "host"
            }
        ]
    }


def create_failure_monitor() -> dict:
    """Create the VM failure monitor configuration."""
    return {
        "name": "VibeCode VM Start Failure",
        "type": "metric alert",
        "query": "sum(last_5m):sum:vibecode.vm.start.failure{*}.as_count() > 3",
        "message": "VibeCode VM start failures detected. {{#is_alert}}More than 3 VMs failed to start in the last 5 minutes.{{/is_alert}}",
        "tags": ["service:vibecode", "alert:vm-failure"],
        "options": {
            "thresholds": {
                "critical": 3,
                "warning": 1
            },
            "notify_no_data": False,
            "notify_audit": False
        }
    }


def create_slo_config() -> dict:
    """Create the SLO configuration."""
    return {
        "name": "VibeCode VM Availability",
        "description": "VM start success rate should be > 99%",
        "type": "metric",
        "thresholds": [
            {
                "timeframe": "7d",
                "target": 99.0,
                "warning": 99.5
            },
            {
                "timeframe": "30d",
                "target": 99.5,
                "warning": 99.9
            }
        ],
        "query": {
            "numerator": "sum:vibecode.vm.start.success{*}.as_count()",
            "denominator": "sum:vibecode.vm.start.attempt{*}.as_count()"
        },
        "tags": ["service:vibecode", "slo:vm-availability"]
    }


def main(project_root: Optional[Path] = None) -> int:
    """
    Create Datadog dashboard and monitoring configurations.

    Args:
        project_root: Root directory of the project. If None, uses parent of script directory.

    Returns:
        0 on success, 1 on failure
    """
    print("==================================")
    print("Datadog Dashboard Creation")
    print("==================================")
    print()

    if project_root is None:
        script_dir = Path(__file__).parent.resolve()
        project_root = script_dir.parent

    # Create config directory
    config_dir = project_root / "config" / "datadog"
    config_dir.mkdir(parents=True, exist_ok=True)

    # Create dashboard JSON
    dashboard_path = config_dir / "vibecode-dashboard.json"
    dashboard_path.write_text(json.dumps(create_dashboard_json(), indent=2))
    print("[1/3] Dashboard JSON created")

    # Create monitor configuration
    monitor_path = config_dir / "vm-failure-monitor.json"
    monitor_path.write_text(json.dumps(create_failure_monitor(), indent=2))
    print("[2/3] Failure monitor created")

    # Create SLO configuration
    slo_path = config_dir / "vm-slo.json"
    slo_path.write_text(json.dumps(create_slo_config(), indent=2))
    print("[3/3] SLO configuration created")

    print()
    print("==================================")
    print("Datadog Dashboard Ready")
    print("==================================")
    print()
    print("Created:")
    print("  - Dashboard: config/datadog/vibecode-dashboard.json")
    print("  - Monitor: config/datadog/vm-failure-monitor.json")
    print("  - SLO: config/datadog/vm-slo.json")
    print()
    print("To deploy:")
    print("  # Via Datadog API")
    print("  curl -X POST https://api.datadoghq.com/api/v1/dashboard \\")
    print("    -H 'DD-API-KEY: ${DD_API_KEY}' \\")
    print("    -H 'Content-Type: application/json' \\")
    print("    -d @config/datadog/vibecode-dashboard.json")
    print()
    print("Or manually import JSON in Datadog UI:")
    print("  https://app.datadoghq.com/dashboard/lists")

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Create Datadog Dashboard for VibeCode VM Monitoring"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        help="Root directory of the project (default: parent of script directory)",
    )
    args = parser.parse_args()

    sys.exit(main(project_root=args.project_root))
