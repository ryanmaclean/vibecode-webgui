output "monitor_ids" {
  description = "Map of monitor names to their Datadog IDs"
  value = {
    for k, v in datadog_monitor.this : k => v.id
  }
}

output "dashboard_url" {
  description = "URL of the created Datadog dashboard"
  value       = datadog_dashboard.this.url
}

output "monitor_status" {
  description = "Status of the created monitors"
  value = {
    for k, v in datadog_monitor.this : k => v.enabled ? "enabled" : "disabled"
  }
}
