locals {
  default_tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "terraform"
      Project     = "vibecode"
      Service     = var.service_name
    },
    var.tags
  )
  
  # Convert tags to Datadog format
  datadog_tags = [for k, v in local.default_tags : "${k}:${v}"]
}

# Datadog Monitors for Azure OpenAI
resource "datadog_monitor" "this" {
  # High Error Rate Monitor
  name    = "[${title(var.environment)}] Azure OpenAI - High Error Rate"
  type    = "query alert"
  message = templatefile("${path.module}/templates/error_rate_alert.tftpl", 
    { 
      environment = var.environment,
      service_name = var.service_name,
      threshold = var.error_rate_threshold,
      slack_channel = var.slack_channel
    }
  )
  query = <<-EOT
    sum(last_5m):
      default_zero(
        sum:azure.openai_service.api_errors{env:${var.environment},service:${var.service_name}}.as_rate()
      ) / 
      default_zero(
        sum:azure.openai_service.api_requests{env:${var.environment},service:${var.service_name}}.as_rate()
      ) * 100 > ${var.error_rate_threshold}
  EOT

  monitor_thresholds {
    critical = var.error_rate_threshold
    warning  = var.error_rate_threshold * 0.7
  }

  tags = concat(
    local.datadog_tags,
    ["service:${var.service_name}", "env:${var.environment}", "team:ai-engineering", "type:error-rate"]
  )
}

# High Latency Monitor
resource "datadog_monitor" "high_latency" {
  name    = "[${title(var.environment)}] Azure OpenAI - High Latency"
  type    = "query alert"
  message = templatefile("${path.module}/templates/latency_alert.tftpl", 
    { 
      environment = var.environment,
      service_name = var.service_name,
      threshold = var.latency_threshold_ms,
      slack_channel = var.slack_channel
    }
  )
  
  query = <<-EOT
    avg(last_15m):avg:azure.openai_service.latency{env:${var.environment},service:${var.service_name}} > ${var.latency_threshold_ms}
  EOT

  monitor_thresholds {
    critical = var.latency_threshold_ms
    warning  = var.latency_threshold_ms * 0.7
  }

  tags = concat(
    local.datadog_tags,
    ["service:${var.service_name}", "env:${var.environment}", "team:ai-engineering", "type:latency"]
  )
}

# Dashboard for Azure OpenAI Monitoring
resource "datadog_dashboard" "this" {
  title       = "[${upper(var.environment)}] Azure OpenAI - ${title(var.service_name)} - Overview"
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
