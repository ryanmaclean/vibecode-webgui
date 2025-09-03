locals {
  default_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "vibecode"
    Service     = "azure-openai-monitoring"
  }
}

# Datadog Azure Integration
resource "datadog_integration_azure" "vibecode_azure" {
  tenant_name   = var.azure_tenant_name
  client_id     = var.azure_client_id
  client_secret = var.azure_client_secret
  host_filters  = "env:${var.environment},service:vibecode-ai"
}

# Datadog Monitors for Azure OpenAI
resource "datadog_monitor" "azure_openai_high_error_rate" {
  name    = "[VibeCode] Azure OpenAI - High Error Rate"
  type    = "query alert"
  message = <<-EOT
  ### High error rate detected in Azure OpenAI API
  - Environment: ${var.environment}
  - Service: ${var.service_name}
  - Error Rate: {{value}}%
  - Threshold: ${var.error_rate_threshold}%
  
  **Instructions:**
  1. Check Azure OpenAI service health
  2. Review error logs in Datadog
  3. Verify API key and permissions
  
  @slack-${var.slack_channel} @team-ai-engineering@vibecode.com
  EOT

  query = <<-EOT
    sum(last_5m):
      default_zero(
        sum:azure.openai_service.api_errors{environment:${var.environment},service:${var.service_name}}.as_rate()
      ) / 
      default_zero(
        sum:azure.openai_service.api_requests{environment:${var.environment},service:${var.service_name}}.as_rate()
      ) * 100 > ${var.error_rate_threshold}
  EOT

  monitor_thresholds {
    critical = var.error_rate_threshold
    warning  = var.error_rate_threshold * 0.7
  }

  tags = concat(
    ["service:${var.service_name}", "env:${var.environment}", "team:ai-engineering"],
    [for k, v in local.default_tags : "${k}:${v}"]
  )
}

# Dashboard for Azure OpenAI Monitoring
resource "datadog_dashboard" "azure_openai_overview" {
  title       = "Azure OpenAI - ${title(var.environment)} - Overview"
  description = "Comprehensive monitoring for Azure OpenAI services"
  layout_type = "ordered"
  is_read_only = true

  template_variable {
    name    = "env"
    prefix  = "env"
    default = var.environment
  }

  template_variable {
    name    = "service"
    prefix  = "service"
    default = var.service_name
  }

  # API Requests Widget
  widget {
    timeseries_definition {
      title = "API Requests"
      show_legend = true
      legend_size = "2"
      
      request {
        q = "sum:azure.openai_service.api_requests{env:$env,service:$service} by {status_code}.as_count()"
        display_type = "bars"
        style {
          palette = "cool"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
        include_zero = true
      }
    }
  }

  # Error Rate Widget
  widget {
    timeseries_definition {
      title = "Error Rate"
      show_legend = false
      
      request {
        q = "100 * (sum:azure.openai_service.api_errors{env:$env,service:$service}.as_rate() / sum:azure.openai_service.api_requests{env:$env,service:$service}.as_rate())"
        display_type = "line"
        style {
          palette = "warm"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
        max = "100"
        include_zero = true
      }
    }
  }

  # Token Usage Widget
  widget {
    timeseries_definition {
      title = "Token Usage"
      show_legend = true
      
      request {
        q = "sum:azure.openai_service.tokens_used{env:$env,service:$service} by {token_type}.as_count()"
        display_type = "area"
        style {
          palette = "purple"
        }
      }
    }
  }
}

# Outputs for the module
output "datadog_azure_integration_status" {
  value = datadog_integration_azure.vibecode_azure.id != "" ? "Enabled" : "Disabled"
}

output "dashboard_url" {
  value = datadog_dashboard.azure_openai_overview.url
}
