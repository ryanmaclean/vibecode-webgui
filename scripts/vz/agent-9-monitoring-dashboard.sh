#!/bin/bash
# Agent 9: Create Monitoring Dashboard
set -e

echo "=== Agent 9: Creating Monitoring Dashboard ==="

# Create comprehensive dashboard config
cat > config/datadog/openclaw-dashboard-full.json << 'DASHBOARDEOF'
{
  "title": "OpenClaw VM Monitoring Dashboard",
  "description": "Complete monitoring for OpenClaw in VM",
  "widgets": [
    {
      "definition": {
        "type": "timeseries",
        "title": "Gateway Requests per Second",
        "requests": [{
          "q": "avg:openclaw.gateway.requests_per_second{*}"
        }]
      }
    },
    {
      "definition": {
        "type": "query_value",
        "title": "Gateway Health Status",
        "requests": [{
          "q": "avg:openclaw.gateway.health{*}"
        }]
      }
    },
    {
      "definition": {
        "type": "timeseries",
        "title": "VM CPU Usage",
        "requests": [{
          "q": "avg:system.cpu.user{host:openclaw-vm}"
        }]
      }
    },
    {
      "definition": {
        "type": "timeseries",
        "title": "VM Memory Usage",
        "requests": [{
          "q": "avg:system.mem.used{host:openclaw-vm}"
        }]
      }
    },
    {
      "definition": {
        "type": "timeseries",
        "title": "Tailscale Connectivity",
        "requests": [{
          "q": "avg:tailscale.connected{host:openclaw-vm}"
        }]
      }
    }
  ]
}
DASHBOARDEOF

# Create alerts config
cat > config/datadog/openclaw-alerts.yaml << 'ALERTSEOF'
# OpenClaw VM Alerts
alerts:
  - name: "OpenClaw Gateway Down"
    query: "avg(last_5m):avg:openclaw.gateway.health{*} < 1"
    message: "OpenClaw gateway is not responding. Check VM status."
    
  - name: "VM High CPU"
    query: "avg(last_10m):avg:system.cpu.user{host:openclaw-vm} > 80"
    message: "VM CPU usage is high. Consider scaling resources."
    
  - name: "VM High Memory"
    query: "avg(last_10m):avg:system.mem.used{host:openclaw-vm} > 90"
    message: "VM memory usage is high. Check for memory leaks."
    
  - name: "Tailscale Disconnected"
    query: "avg(last_5m):avg:tailscale.connected{host:openclaw-vm} < 1"
    message: "Tailscale VPN disconnected. Check network connectivity."
ALERTSEOF

echo "✅ Monitoring dashboard and alerts created"
