# Terraform Variables for Datadog Synthetics
#
# Configuration variables for Datadog monitoring infrastructure
# Staff Engineer Implementation - Production-ready configuration

variable "datadog_api_key" {
  description = "Datadog API key for authentication"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.datadog_api_key) > 0
    error_message = "Datadog API key must not be empty."
  }
}

variable "datadog_app_key" {
  description = "Datadog application key for authentication"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.datadog_app_key) > 0
    error_message = "Datadog application key must not be empty."
  }
}

variable "datadog_rum_application_id" {
  description = "Datadog Real User Monitoring (RUM) Application ID"
  type        = string
  default     = ""
  validation {
    condition     = var.datadog_rum_application_id == "" || can(regex("^[a-f0-9-]+$", var.datadog_rum_application_id))
    error_message = "RUM Application ID must be a valid UUID format or empty string."
  }
}

variable "datadog_rum_client_token" {
  description = "Datadog RUM Client Token for browser tests"
  type        = string
  sensitive   = true
  default     = ""
}

variable "app_base_url" {
  description = "Base URL for the VibeCode application"
  type        = string
  default     = "https://vibecode.dev"
  validation {
    condition     = can(regex("^https?://", var.app_base_url))
    error_message = "App base URL must start with http:// or https://."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "notification_channels" {
  description = "List of notification channels for alerts"
  type        = list(string)
  default     = [
    "@slack-vibecode-alerts",
    "@pagerduty-critical",
    "@email-platform-team"
  ]
  validation {
    condition     = length(var.notification_channels) > 0
    error_message = "At least one notification channel must be specified."
  }
}

variable "monitoring_locations" {
  description = "Datadog locations for synthetic tests"
  type        = list(string)
  default     = [
    "aws:us-east-1",
    "aws:us-west-2",
    "aws:eu-west-1",
    "aws:ap-southeast-1"
  ]
  validation {
    condition     = length(var.monitoring_locations) > 0
    error_message = "At least one monitoring location must be specified."
  }
}

variable "test_intervals" {
  description = "Test intervals in seconds for different test types"
  type = object({
    health_check    = number
    security        = number
    performance     = number
    user_flow       = number
    rate_limiting   = number
  })
  default = {
    health_check    = 60    # 1 minute
    security        = 300   # 5 minutes
    performance     = 180   # 3 minutes
    user_flow       = 900   # 15 minutes
    rate_limiting   = 3600  # 1 hour
  }
  validation {
    condition = alltrue([
      var.test_intervals.health_check >= 60,
      var.test_intervals.security >= 300,
      var.test_intervals.performance >= 60,
      var.test_intervals.user_flow >= 300,
      var.test_intervals.rate_limiting >= 600
    ])
    error_message = "Test intervals must meet minimum requirements for each test type."
  }
}

variable "performance_thresholds" {
  description = "Performance thresholds for different endpoints"
  type = object({
    api_response_time_ms        = number
    health_check_response_ms    = number
    dashboard_load_time_ms      = number
    database_connection_ms      = number
  })
  default = {
    api_response_time_ms        = 200   # 200ms for API calls
    health_check_response_ms    = 1000  # 1s for health checks
    dashboard_load_time_ms      = 3000  # 3s for dashboard load
    database_connection_ms      = 2000  # 2s for DB connection
  }
  validation {
    condition = alltrue([
      var.performance_thresholds.api_response_time_ms > 0,
      var.performance_thresholds.health_check_response_ms > 0,
      var.performance_thresholds.dashboard_load_time_ms > 0,
      var.performance_thresholds.database_connection_ms > 0
    ])
    error_message = "All performance thresholds must be positive numbers."
  }
}

variable "security_test_config" {
  description = "Configuration for security-related synthetic tests"
  type = object({
    enable_rate_limiting_tests  = bool
    enable_header_tests        = bool
    enable_auth_tests          = bool
    enable_injection_tests     = bool
  })
  default = {
    enable_rate_limiting_tests  = true
    enable_header_tests        = true
    enable_auth_tests          = true
    enable_injection_tests     = true
  }
}

variable "alerting_config" {
  description = "Alerting configuration for synthetic tests"
  type = object({
    renotify_interval_minutes = number
    escalation_message        = string
    recovery_message          = string
  })
  default = {
    renotify_interval_minutes = 120
    escalation_message        = "ESCALATION: Critical VibeCode service issue persists. @pagerduty-critical @management"
    recovery_message          = "RECOVERY: VibeCode service has recovered. All systems operational."
  }
}

variable "tags" {
  description = "Common tags to apply to all Datadog resources"
  type        = map(string)
  default = {
    project     = "vibecode"
    owner       = "platform-team"
    terraform   = "true"
    environment = "prod"
  }
}

# Local values for computed configurations
locals {
  common_tags = merge(var.tags, {
    environment = var.environment
  })

  notification_message = join(" ", var.notification_channels)

  # Security-specific locations (fewer for cost optimization)
  security_locations = slice(var.monitoring_locations, 0, 2)

  # Performance test locations (all regions for global coverage)
  performance_locations = var.monitoring_locations
}

# Outputs for use in other modules
output "environment" {
  description = "Environment configuration"
  value       = var.environment
}

output "app_base_url" {
  description = "Application base URL"
  value       = var.app_base_url
}

output "common_tags" {
  description = "Common tags for all resources"
  value       = local.common_tags
}

output "notification_channels" {
  description = "Notification channels for alerts"
  value       = var.notification_channels
}

output "performance_thresholds" {
  description = "Performance thresholds configuration"
  value       = var.performance_thresholds
}
