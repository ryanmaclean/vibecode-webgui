#!/bin/bash
# Experiment 4: Create Datadog Dashboard
# Agent 5: Observability Engineer - Prep Work

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=================================="
echo "Datadog Dashboard Creation"
echo "=================================="
echo ""

# Create dashboard JSON
cat > "$PROJECT_ROOT/config/datadog/vibecode-dashboard.json" << 'EOF'
{
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
EOF

echo "[1/3] Dashboard JSON created"

# Create monitor configurations
cat > "$PROJECT_ROOT/config/datadog/vm-failure-monitor.json" << 'EOF'
{
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
    "notify_no_data": false,
    "notify_audit": false
  }
}
EOF

echo "[2/3] Failure monitor created"

# Create SLO configuration
cat > "$PROJECT_ROOT/config/datadog/vm-slo.json" << 'EOF'
{
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
EOF

echo "[3/3] SLO configuration created"

echo ""
echo "=================================="
echo "Datadog Dashboard Ready"
echo "=================================="
echo ""
echo "Created:"
echo "  - Dashboard: config/datadog/vibecode-dashboard.json"
echo "  - Monitor: config/datadog/vm-failure-monitor.json"
echo "  - SLO: config/datadog/vm-slo.json"
echo ""
echo "To deploy:"
echo "  # Via Datadog API"
echo "  curl -X POST https://api.datadoghq.com/api/v1/dashboard \\"
echo "    -H 'DD-API-KEY: \${DD_API_KEY}' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d @config/datadog/vibecode-dashboard.json"
echo ""
echo "Or manually import JSON in Datadog UI:"
echo "  https://app.datadoghq.com/dashboard/lists"

