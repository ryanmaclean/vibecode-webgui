# Datadog Dashboard and Monitoring Configuration for VibeCode WebGUI
# Comprehensive monitoring setup with custom dashboards, alerts, and SLOs

terraform {
  required_providers {
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.32"
    }
  }
}

# Local variables
locals {
  service_name = "vibecode-webgui"
  environments = ["staging", "production"]
  
  # Common tags
  common_tags = [
    "service:${local.service_name}",
    "team:platform",
    "managed-by:terraform"
  ]
}

# Custom Datadog Dashboard for VibeCode WebGUI
resource "datadog_dashboard" "vibecode_main" {
  title       = "VibeCode WebGUI - Platform Overview"
  description = "Comprehensive monitoring dashboard for VibeCode WebGUI platform including AI usage, performance, and infrastructure metrics"
  layout_type = "ordered"

  # Application Performance Monitoring
  widget {
    layout = {
      height = 15
      width  = 47
      x      = 0
      y      = 0
    }

    timeseries_definition {
      title = "Application Performance"
      
      request {
        q = "avg:trace.express.request.duration{service:${local.service_name}} by {env,resource_name}"
        display_type = "line"
        style {
          palette = "dog_classic"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      request {
        q = "avg:trace.express.request.hits{service:${local.service_name}} by {env}"
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
      
      marker {
        value = "y = 1000"
        display_type = "error dashed"
        label = "SLA Threshold"
      }
    }
  }

  # AI Usage Metrics
  widget {
    layout = {
      height = 15
      width  = 47
      x      = 49
      y      = 0
    }

    timeseries_definition {
      title = "AI Usage & Performance"
      
      request {
        q = "sum:vibecode.ai.requests{*} by {provider,model}"
        display_type = "line"
        style {
          palette = "purple"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      request {
        q = "avg:vibecode.ai.response_time{*} by {provider}"
        display_type = "line"
        style {
          palette = "orange"
          line_type = "dashed"
          line_width = "thin"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
        include_zero = true
      }
    }
  }

  # Infrastructure Health
  widget {
    layout = {
      height = 15
      width  = 32
      x      = 0
      y      = 16
    }

    query_value_definition {
      title = "Active Kubernetes Pods"
      
      request {
        q = "sum:kubernetes.pods.running{service:${local.service_name}}"
        aggregator = "last"
        conditional_formats {
          comparator = ">="
          value = "2"
          palette = "green_on_white"
        }
        conditional_formats {
          comparator = "<"
          value = "2"
          palette = "red_on_white"
        }
      }
      
      autoscale = true
      precision = 0
    }
  }

  # Database Performance
  widget {
    layout = {
      height = 15
      width  = 32
      x      = 34
      y      = 16
    }

    timeseries_definition {
      title = "Database Performance"
      
      request {
        q = "avg:postgresql.connections{service:vibecode-db} by {host}"
        display_type = "line"
        style {
          palette = "green"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      request {
        q = "avg:postgresql.database.size{service:vibecode-db} by {db}"
        display_type = "area"
        style {
          palette = "blue"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
      }
    }
  }

  # Cache Performance
  widget {
    layout = {
      height = 15
      width  = 30
      x      = 68
      y      = 16
    }

    timeseries_definition {
      title = "Redis Cache Performance"
      
      request {
        q = "avg:redis.net.commands_processed{service:vibecode-cache} by {host}"
        display_type = "line"
        style {
          palette = "red"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      request {
        q = "avg:redis.info.memory.used_memory{service:vibecode-cache}"
        display_type = "area"
        style {
          palette = "orange"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
      }
    }
  }

  # Terminal Sessions
  widget {
    layout = {
      height = 15
      width  = 48
      x      = 0
      y      = 32
    }

    timeseries_definition {
      title = "Terminal Sessions & AI Usage"
      
      request {
        q = "sum:vibecode.terminal.sessions.created{*} by {workspace}"
        display_type = "bars"
        style {
          palette = "purple"
        }
      }
      
      request {
        q = "avg:vibecode.terminal.sessions.active{*}"
        display_type = "line"
        style {
          palette = "green"
          line_type = "solid"
          line_width = "thick"
        }
      }
      
      request {
        q = "sum:vibecode.ai.requests{context:terminal} by {type}"
        display_type = "area"
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

  # Error Rates
  widget {
    layout = {
      height = 15
      width  = 48
      x      = 50
      y      = 32
    }

    timeseries_definition {
      title = "Error Rates & Status Codes"
      
      request {
        q = "sum:trace.express.request.errors{service:${local.service_name}} by {env,http.status_code}.as_rate()"
        display_type = "bars"
        style {
          palette = "red"
        }
      }
      
      request {
        q = "sum:trace.express.request.hits{service:${local.service_name}} by {env}.as_rate()"
        display_type = "line"
        style {
          palette = "blue"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
        include_zero = true
      }
    }
  }

  # LiteLLM Gateway Metrics
  widget {
    layout = {
      height = 15
      width  = 49
      x      = 0
      y      = 48
    }

    timeseries_definition {
      title = "LiteLLM Gateway Performance"
      
      request {
        q = "sum:vibecode.openrouter.requests{*} by {model}"
        display_type = "line"
        style {
          palette = "purple"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      request {
        q = "avg:vibecode.openrouter.response_time{*} by {model}"
        display_type = "line"
        style {
          palette = "orange"
          line_type = "dashed"
          line_width = "thin"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
      }
    }
  }

  # Cost Tracking
  widget {
    layout = {
      height = 15
      width  = 47
      x      = 51
      y      = 48
    }

    query_value_definition {
      title = "Daily AI Cost (USD)"
      
      request {
        q = "sum:vibecode.openrouter.cost{*}.rollup(sum, 86400)"
        aggregator = "last"
        conditional_formats {
          comparator = "<"
          value = "100"
          palette = "green_on_white"
        }
        conditional_formats {
          comparator = ">="
          value = "100"
          palette = "yellow_on_white"
        }
        conditional_formats {
          comparator = ">="
          value = "200"
          palette = "red_on_white"
        }
      }
      
      autoscale = false
      precision = 2
    }
  }

  # System Resources
  widget {
    layout = {
      height = 15
      width  = 98
      x      = 0
      y      = 64
    }

    timeseries_definition {
      title = "System Resources"
      
      request {
        q = "avg:kubernetes.cpu.usage.total{service:${local.service_name}} by {pod_name}"
        display_type = "line"
        style {
          palette = "green"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      request {
        q = "avg:kubernetes.memory.usage{service:${local.service_name}} by {pod_name}"
        display_type = "line"
        style {
          palette = "blue"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      request {
        q = "avg:vibecode.system.memory.used{*}"
        display_type = "area"
        style {
          palette = "purple"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
      }
    }
  }

  template_variable {
    name    = "env"
    prefix  = "env"
    default = "*"
    available_values = local.environments
  }

  template_variable {
    name    = "service"
    prefix  = "service"
    default = local.service_name
  }
}

# AI-Specific Dashboard
resource "datadog_dashboard" "vibecode_ai" {
  title       = "VibeCode WebGUI - AI & Terminal Analytics"
  description = "Detailed AI usage analytics, terminal sessions, and Claude Code CLI monitoring"
  layout_type = "ordered"

  # AI Provider Comparison
  widget {
    layout = {
      height = 15
      width  = 48
      x      = 0
      y      = 0
    }

    timeseries_definition {
      title = "AI Provider Performance Comparison"
      
      request {
        q = "avg:vibecode.ai.response_time{*} by {provider}"
        display_type = "line"
        style {
          palette = "cool"
          line_type = "solid"
          line_width = "thick"
        }
      }
      
      request {
        q = "sum:vibecode.ai.requests{*} by {provider}.as_count()"
        display_type = "bars"
        style {
          palette = "purple"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
      }
    }
  }

  # Token Usage Analysis
  widget {
    layout = {
      height = 15
      width  = 50
      x      = 50
      y      = 0
    }

    timeseries_definition {
      title = "Token Usage by Model"
      
      request {
        q = "sum:vibecode.ai.tokens_used{*} by {model,provider}"
        display_type = "area"
        style {
          palette = "orange"
        }
      }
      
      request {
        q = "avg:vibecode.openrouter.prompt_tokens{*} by {model}"
        display_type = "line"
        style {
          palette = "green"
          line_type = "dashed"
          line_width = "thin"
        }
      }
      
      request {
        q = "avg:vibecode.openrouter.completion_tokens{*} by {model}"
        display_type = "line"
        style {
          palette = "blue"
          line_type = "dashed"
          line_width = "thin"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
      }
    }
  }

  # Terminal Activity Heatmap
  widget {
    layout = {
      height = 15
      width  = 98
      x      = 0
      y      = 16
    }

    heatmap_definition {
      title = "Terminal Command Activity by Hour"
      
      request {
        q = "sum:vibecode.terminal.commands.executed{*} by {command_type}"
        style {
          palette = "YlOrRd"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
        include_zero = true
      }
    }
  }

  # Claude CLI Performance
  widget {
    layout = {
      height = 15
      width  = 49
      x      = 0
      y      = 32
    }

    timeseries_definition {
      title = "Claude Code CLI Performance"
      
      request {
        q = "sum:vibecode.claude.cli.commands{*} by {command,success}"
        display_type = "bars"
        style {
          palette = "semantic"
        }
      }
      
      request {
        q = "avg:vibecode.claude.cli.response_time{*} by {command}"
        display_type = "line"
        style {
          palette = "purple"
          line_type = "solid"
          line_width = "normal"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
      }
    }
  }

  # AI Suggestions Effectiveness
  widget {
    layout = {
      height = 15
      width  = 49
      x      = 51
      y      = 32
    }

    timeseries_definition {
      title = "AI Suggestions & Acceptance Rate"
      
      request {
        q = "sum:vibecode.ai.suggestions{*} by {trigger,accepted}"
        display_type = "bars"
        style {
          palette = "green"
        }
      }
      
      request {
        q = "avg:vibecode.ai.suggestion.helpfulness{*} by {trigger}"
        display_type = "line"
        style {
          palette = "blue"
          line_type = "solid"
          line_width = "thick"
        }
      }
      
      yaxis {
        scale = "linear"
        min = "0"
        max = "5"
      }
    }
  }

  template_variable {
    name    = "provider"
    prefix  = "provider"
    default = "*"
    available_values = ["openai", "anthropic", "ollama"]
  }

  template_variable {
    name    = "model"
    prefix  = "model"
    default = "*"
  }
}

# Service Level Objectives (SLOs)
resource "datadog_service_level_objective" "application_availability" {
  name        = "${local.service_name} - Application Availability"
  type        = "metric"
  description = "Maintain 99.9% application availability"
  
  query {
    numerator   = "sum:trace.express.request.hits{service:${local.service_name}} - sum:trace.express.request.errors{service:${local.service_name}}"
    denominator = "sum:trace.express.request.hits{service:${local.service_name}}"
  }
  
  thresholds {
    timeframe = "7d"
    target    = 99.9
    warning   = 99.5
  }
  
  thresholds {
    timeframe = "30d"
    target    = 99.9
    warning   = 99.5
  }
  
  tags = local.common_tags
}

resource "datadog_service_level_objective" "ai_response_time" {
  name        = "${local.service_name} - AI Response Time"
  type        = "metric"
  description = "95% of AI requests should complete within 3 seconds"
  
  query {
    numerator   = "count:vibecode.ai.response_time{*} by {}.rollup(count).fill(zero)"
    denominator = "count:vibecode.ai.response_time{*} by {}.rollup(count).fill(zero)"
  }
  
  thresholds {
    timeframe = "7d"
    target    = 95.0
    warning   = 90.0
  }
  
  tags = local.common_tags
}

# Alerting Rules
resource "datadog_monitor" "high_error_rate" {
  name    = "${local.service_name} - High Error Rate"
  type    = "metric alert"
  message = <<-EOT
    High error rate detected in ${local.service_name}.
    
    Error rate is above 5% for the last 5 minutes.
    
    @slack-alerts @pagerduty-oncall
    
    Playbook: https://runbook.yourdomain.com/high-error-rate
  EOT

  query = "avg(last_5m):( sum:trace.express.request.errors{service:${local.service_name}} / sum:trace.express.request.hits{service:${local.service_name}} ) * 100 > 5"

  monitor_thresholds {
    critical          = 5.0
    warning          = 2.0
    critical_recovery = 3.0
    warning_recovery = 1.0
  }

  notify_no_data    = false
  renotify_interval = 60
  timeout_h         = 1
  evaluation_delay  = 60

  tags = concat(local.common_tags, ["alert:error-rate", "severity:high"])
}

resource "datadog_monitor" "ai_response_time_high" {
  name    = "${local.service_name} - AI Response Time Too High"
  type    = "metric alert"
  message = <<-EOT
    AI response times are elevated in ${local.service_name}.
    
    Average response time is above 5 seconds for the last 10 minutes.
    
    @slack-alerts
    
    This may indicate:
    - External AI API issues
    - Network connectivity problems  
    - Rate limiting from providers
    
    Check AI provider status pages and current usage limits.
  EOT

  query = "avg(last_10m):avg:vibecode.ai.response_time{*} > 5000"

  monitor_thresholds {
    critical = 5000
    warning  = 3000
  }

  notify_no_data    = true
  no_data_timeframe = 20
  renotify_interval = 30
  timeout_h         = 1

  tags = concat(local.common_tags, ["alert:ai-performance", "severity:medium"])
}

resource "datadog_monitor" "database_connections_high" {
  name    = "${local.service_name} - Database Connections High"
  type    = "metric alert"
  message = <<-EOT
    Database connection count is high for ${local.service_name}.
    
    This may indicate connection leaks or high load.
    
    @slack-alerts
    
    Actions:
    1. Check for connection leaks in application code
    2. Monitor application load patterns
    3. Consider scaling database if needed
  EOT

  query = "avg(last_5m):avg:postgresql.connections{service:vibecode-db} > 80"

  monitor_thresholds {
    critical = 80
    warning  = 60
  }

  notify_no_data    = true
  no_data_timeframe = 10
  renotify_interval = 60

  tags = concat(local.common_tags, ["alert:database", "severity:medium"])
}

resource "datadog_monitor" "pod_crash_loop" {
  name    = "${local.service_name} - Pod Crash Loop"
  type    = "metric alert"
  message = <<-EOT
    Pod is in crash loop backoff for ${local.service_name}.
    
    @pagerduty-oncall @slack-alerts
    
    Immediate actions required:
    1. Check pod logs: kubectl logs -f deployment/${local.service_name}
    2. Check recent deployments and rollback if necessary
    3. Verify resource limits and constraints
    
    Playbook: https://runbook.yourdomain.com/pod-crash-loop
  EOT

  query = "avg(last_5m):avg:kubernetes.pods.running{service:${local.service_name}} < 1"

  monitor_thresholds {
    critical = 1
    warning  = 2
  }

  notify_no_data    = true
  no_data_timeframe = 5
  renotify_interval = 15
  timeout_h         = 1
  priority          = 1

  tags = concat(local.common_tags, ["alert:infrastructure", "severity:critical"])
}

resource "datadog_monitor" "ai_cost_budget" {
  name    = "${local.service_name} - AI Cost Budget Alert"
  type    = "metric alert"
  message = <<-EOT
    Daily AI costs are approaching budget limits for ${local.service_name}.
    
    Current daily spend is approaching $200 USD.
    
    @slack-alerts @finance-team
    
    Consider:
    1. Reviewing AI usage patterns
    2. Optimizing model selection for cost efficiency
    3. Implementing additional rate limiting if needed
  EOT

  query = "avg(last_1h):sum:vibecode.openrouter.cost{*}.rollup(sum, 3600) * 24 > 180"

  monitor_thresholds {
    critical = 180
    warning  = 150
  }

  notify_no_data    = false
  renotify_interval = 240
  evaluation_delay  = 120

  tags = concat(local.common_tags, ["alert:cost", "severity:medium"])
}

# Synthetics API Test
resource "datadog_synthetics_test" "api_health_check" {
  type    = "api"
  subtype = "http"
  name    = "${local.service_name} - Health Check"
  message = "Health check failed @slack-alerts"
  
  locations = ["aws:us-east-1", "aws:eu-west-1", "aws:ap-southeast-1"]
  
  options_list {
    tick_every         = 60
    min_failure_duration = 180
    min_location_failed = 1
    
    retry {
      count    = 3
      interval = 1000
    }
    
    monitor_options {
      renotify_interval = 120
    }
  }
  
  request_definition {
    method = "GET"
    url    = "https://${local.service_name}.yourdomain.com/api/health"
    
    assertion {
      type     = "statusCode"
      operator = "is"
      target   = "200"
    }
    
    assertion {
      type     = "responseTime"
      operator = "lessThan"
      target   = "1000"
    }
    
    assertion {
      type     = "body"
      operator = "contains"
      target   = "healthy"
    }
  }
  
  tags = concat(local.common_tags, ["test:health-check", "location:global"])
}

# Custom Metrics for Business Intelligence
resource "datadog_dashboard" "business_metrics" {
  title       = "VibeCode WebGUI - Business Metrics"
  description = "Business intelligence dashboard tracking user engagement, feature adoption, and growth metrics"
  layout_type = "ordered"

  # Daily Active Users
  widget {
    layout = {
      height = 15
      width  = 32
      x      = 0
      y      = 0
    }

    query_value_definition {
      title = "Daily Active Users"
      
      request {
        q = "sum:vibecode.workspace.activities{*} by {workspace}.rollup(count, 86400)"
        aggregator = "sum"
        conditional_formats {
          comparator = ">="
          value = "100"
          palette = "green_on_white"
        }
        conditional_formats {
          comparator = "<"
          value = "50"
          palette = "red_on_white"
        }
      }
      
      autoscale = true
      precision = 0
    }
  }

  # Feature Adoption
  widget {
    layout = {
      height = 15
      width  = 33
      x      = 34
      y      = 0
    }

    toplist_definition {
      title = "Most Used AI Features"
      
      request {
        q = "top(sum:vibecode.ai.requests{*} by {type}.rollup(sum, 86400), 10, 'sum', 'desc')"
        
        style {
          palette = "dog_classic"
        }
      }
    }
  }

  # Terminal Engagement
  widget {
    layout = {
      height = 15
      width  = 31
      x      = 69
      y      = 0
    }

    query_value_definition {
      title = "Avg Session Duration (min)"
      
      request {
        q = "avg:vibecode.terminal.session.duration{*} / 60000"
        aggregator = "avg"
        conditional_formats {
          comparator = ">="
          value = "10"
          palette = "green_on_white"
        }
        conditional_formats {
          comparator = "<"
          value = "5"
          palette = "yellow_on_white"
        }
      }
      
      autoscale = false
      precision = 1
    }
  }
}

# Log Pipeline for AI requests
resource "datadog_logs_pipeline" "ai_requests" {
  name           = "AI Request Processing"
  is_enabled     = true
  filter {
    query = "service:${local.service_name} source:nodejs"
  }

  processor {
    grok_parser {
      name = "Parse AI Request Logs"
      is_enabled = true
      source = "message"
      grok {
        support_rules = ""
        match_rules   = "ai_request \\[%{word:ai.provider}\\] model=%{word:ai.model} tokens=%{integer:ai.tokens} cost=%{number:ai.cost} duration=%{integer:ai.duration}ms"
      }
    }
  }

  processor {
    attribute_remapper {
      name                 = "Map AI Attributes"
      is_enabled          = true
      sources             = ["ai.provider", "ai.model", "ai.tokens", "ai.cost", "ai.duration"]
      target              = "attributes"
      target_type         = "attribute"
      preserve_source     = true
      override_on_conflict = false
    }
  }
}

# Output dashboard URLs
output "main_dashboard_url" {
  description = "URL to the main VibeCode dashboard"
  value       = "https://app.datadoghq.com/dashboard/${datadog_dashboard.vibecode_main.id}"
}

output "ai_dashboard_url" {
  description = "URL to the AI analytics dashboard"
  value       = "https://app.datadoghq.com/dashboard/${datadog_dashboard.vibecode_ai.id}"
}

output "business_dashboard_url" {
  description = "URL to the business metrics dashboard"
  value       = "https://app.datadoghq.com/dashboard/${datadog_dashboard.business_metrics.id}"
}