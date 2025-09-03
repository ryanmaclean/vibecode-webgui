# Azure OpenAI Monitoring Configuration
# This file configures monitoring for Azure OpenAI services using Datadog

module "azure_openai_monitoring" {
  source = "../modules/azure_openai_monitoring"
  
  environment = var.environment
  service_name = "vibecode-ai"
  
  # Alert thresholds
  error_rate_threshold = 5.0  # 5% error rate
  latency_threshold_ms = 1000 # 1 second
  
  # Notification channel
  slack_channel = var.environment == "production" ? "#alerts-ai" : "#alerts-dev"
  
  # Additional tags
  tags = merge(
    local.common_tags,
    {
      Component = "AI Services"
      Team      = "AI Engineering"
    }
  )
}

# Output the dashboard URL for easy access
output "azure_openai_dashboard_url" {
  value       = module.azure_openai_monitoring.dashboard_url
  description = "URL of the Azure OpenAI monitoring dashboard"
}

# Output monitor statuses
output "azure_openai_monitor_status" {
  value       = module.azure_openai_monitoring.monitor_status
  description = "Status of Azure OpenAI monitors"
}
