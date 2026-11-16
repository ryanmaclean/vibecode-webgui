# Azure OpenAI Monitoring Module

This Terraform module sets up comprehensive monitoring for Azure OpenAI services using Datadog.

## Features

- **Error Rate Monitoring**: Alerts on high error rates in API calls
- **Latency Monitoring**: Tracks and alerts on response times
- **Token Usage Tracking**: Monitors token consumption
- **Interactive Dashboard**: Pre-built Datadog dashboard for visualization
- **Slack Integration**: Configurable alert notifications

## Usage

```hcl
module "azure_openai_monitoring" {
  source = "../../modules/azure_openai_monitoring"
  
  environment = "production"
  service_name = "vibecode-ai"
  slack_channel = "#alerts-ai"
  
  # Optional overrides
  error_rate_threshold = 5.0  # percentage
  latency_threshold_ms = 1000 # milliseconds
  
  tags = {
    Team        = "AI Engineering"
    Component   = "ML Services"
    Environment = "production"
  }
}
```

## Requirements

- Terraform >= 1.0
- Datadog provider >= 3.39.0
- Azure OpenAI service configured
- Datadog API and App keys with appropriate permissions

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| environment | Deployment environment (e.g., dev, staging, prod) | `string` | n/a | yes |
| service_name | Name of the service being monitored | `string` | `"vibecode-ai"` | no |
| slack_channel | Slack channel for alerts | `string` | `"#alerts-ai"` | no |
| error_rate_threshold | Error rate threshold for alerts (percentage) | `number` | `5.0` | no |
| latency_threshold_ms | Latency threshold in milliseconds for alerts | `number` | `1000` | no |
| tags | Additional tags to apply to all resources | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| monitor_ids | Map of monitor names to their Datadog IDs |
| dashboard_url | URL of the created Datadog dashboard |
| monitor_status | Status of the created monitors |

## Example Dashboard

![Azure OpenAI Dashboard](https://example.com/azure-openai-dashboard.png)

## License

Apache 2.0
