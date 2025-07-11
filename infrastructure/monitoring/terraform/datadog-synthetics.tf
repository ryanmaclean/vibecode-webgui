# Datadog Synthetics Tests for VibeCode WebGUI
# 
# Comprehensive synthetic monitoring for production readiness validation
# Tests API endpoints, security, performance, and integration health
#
# Staff Engineer Implementation - Production-ready monitoring infrastructure

terraform {
  required_providers {
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.39"
    }
  }
}

provider "datadog" {
  api_key  = var.datadog_api_key
  app_key  = var.datadog_app_key
  api_url  = "https://api.datadoghq.com/"
}

# Variables for configuration
variable "datadog_api_key" {
  description = "Datadog API key"
  type        = string
  sensitive   = true
}

variable "datadog_app_key" {
  description = "Datadog application key"
  type        = string
  sensitive   = true
}

variable "app_base_url" {
  description = "Base URL for the VibeCode application"
  type        = string
  default     = "https://vibecode.dev"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "notification_channels" {
  description = "Notification channels for alerts"
  type        = list(string)
  default     = ["@slack-alerts", "@pagerduty-critical"]
}

# API Health Check Synthetics
resource "datadog_synthetics_test" "api_health_check" {
  type    = "api"
  subtype = "http"
  name    = "VibeCode API Health Check - ${var.environment}"
  message = "VibeCode API health endpoint is down. @slack-alerts @pagerduty-critical"
  tags    = ["env:${var.environment}", "service:vibecode-api", "team:platform"]

  locations = ["aws:us-east-1", "aws:eu-west-1", "aws:ap-southeast-1"]

  options_list {
    tick_every = 60 # Check every minute
    
    retry {
      count    = 2
      interval = 30
    }

    monitor_options {
      renotify_interval = 120
    }
  }

  request_definition {
    method = "GET"
    url    = "${var.app_base_url}/api/health"
    
    headers = {
      "User-Agent" = "Datadog Synthetics"
      "Accept"     = "application/json"
    }
  }

  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "200"
  }

  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = "1000" # 1 second max
  }

  assertion {
    type     = "body"
    operator = "contains"
    target   = "healthy"
  }

  assertion {
    type     = "header"
    operator = "contains"
    property = "content-type"
    target   = "application/json"
  }
}

# Authentication API Test
resource "datadog_synthetics_test" "auth_api_test" {
  type    = "api"
  subtype = "http"
  name    = "VibeCode Authentication API Test - ${var.environment}"
  message = "Authentication API is failing. @slack-alerts"
  tags    = ["env:${var.environment}", "service:vibecode-auth", "team:platform"]

  locations = ["aws:us-east-1", "aws:eu-west-1"]

  options_list {
    tick_every = 300 # Check every 5 minutes
    
    retry {
      count    = 2
      interval = 60
    }
  }

  request_definition {
    method = "GET"
    url    = "${var.app_base_url}/api/auth/session"
    
    headers = {
      "User-Agent" = "Datadog Synthetics"
    }
  }

  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "401" # Should be unauthorized without session
  }

  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = "500"
  }
}

# Claude API Security Test
resource "datadog_synthetics_test" "claude_api_security_test" {
  type    = "api"
  subtype = "http"
  name    = "VibeCode Claude API Security Test - ${var.environment}"
  message = "Claude API security validation failed. @slack-alerts @security-team"
  tags    = ["env:${var.environment}", "service:vibecode-claude", "team:platform", "security"]

  locations = ["aws:us-east-1"]

  options_list {
    tick_every = 300 # Check every 5 minutes
  }

  request_definition {
    method = "POST"
    url    = "${var.app_base_url}/api/claude/chat"
    
    headers = {
      "Content-Type" = "application/json"
      "User-Agent"   = "Datadog Synthetics Security Test"
    }

    body = jsonencode({
      message     = "test"
      workspaceId = "test"
    })
  }

  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "401" # Should reject unauthenticated requests
  }

  assertion {
    type     = "body"
    operator = "contains"
    target   = "Unauthorized"
  }
}

# Database Connection Test
resource "datadog_synthetics_test" "database_connection_test" {
  type    = "api"
  subtype = "http"
  name    = "VibeCode Database Connection Test - ${var.environment}"
  message = "Database connection is failing. @slack-alerts @pagerduty-critical"
  tags    = ["env:${var.environment}", "service:vibecode-db", "team:platform"]

  locations = ["aws:us-east-1"]

  options_list {
    tick_every = 300 # Check every 5 minutes
    
    retry {
      count    = 3
      interval = 60
    }
  }

  request_definition {
    method = "GET"
    url    = "${var.app_base_url}/api/health/database"
    
    headers = {
      "User-Agent" = "Datadog Synthetics"
    }
  }

  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "200"
  }

  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = "2000" # 2 seconds max for DB check
  }

  assertion {
    type     = "body"
    operator = "contains"
    target   = "connected"
  }
}

# Browser Test for Critical User Flows
resource "datadog_synthetics_test" "critical_user_flow" {
  type = "browser"
  name = "VibeCode Critical User Flow - ${var.environment}"
  message = "Critical user flow is broken. @slack-alerts @pagerduty-critical"
  tags = ["env:${var.environment}", "service:vibecode-frontend", "team:platform"]

  locations = ["aws:us-east-1", "aws:eu-west-1"]

  options_list {
    tick_every = 900 # Check every 15 minutes
    
    retry {
      count    = 1
      interval = 300
    }

    rumSettings {
      applicationId      = var.datadog_rum_application_id
      clientToken       = var.datadog_rum_client_token
      isEnabled         = true
    }

    device_ids = ["laptop_large"]
  }

  browser_step {
    name = "Navigate to homepage"
    type = "assertCurrentUrl"
    params = jsonencode({
      value = "${var.app_base_url}/"
    })
  }

  browser_step {
    name = "Check page load time"
    type = "assertPageContains"
    params = jsonencode({
      value = "VibeCode"
    })
  }

  browser_step {
    name = "Navigate to login"
    type = "click"
    params = jsonencode({
      element = {
        userLocator = {
          values = [
            {
              value = "[data-testid='login-button']"
              type  = "css"
            }
          ]
        }
      }
    })
  }

  browser_step {
    name = "Verify login page loads"
    type = "assertPageContains"
    params = jsonencode({
      value = "Sign in"
    })
  }
}

# Performance Monitoring Test
resource "datadog_synthetics_test" "performance_monitoring" {
  type    = "api"
  subtype = "http"
  name    = "VibeCode Performance Monitoring - ${var.environment}"
  message = "Performance degradation detected. @slack-alerts"
  tags    = ["env:${var.environment}", "service:vibecode-api", "team:platform", "performance"]

  locations = ["aws:us-east-1", "aws:eu-west-1", "aws:ap-southeast-1"]

  options_list {
    tick_every = 180 # Check every 3 minutes
  }

  request_definition {
    method = "GET"
    url    = "${var.app_base_url}/api/monitoring/metrics"
    
    headers = {
      "User-Agent" = "Datadog Synthetics Performance"
    }
  }

  assertion {
    type     = "statusCode"
    operator = "isNot"
    target   = "500" # Should not return server errors
  }

  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = "200" # Very fast response required
  }
}

# Security Headers Test
resource "datadog_synthetics_test" "security_headers_test" {
  type    = "api"
  subtype = "http"
  name    = "VibeCode Security Headers Test - ${var.environment}"
  message = "Security headers are missing or misconfigured. @security-team @slack-alerts"
  tags    = ["env:${var.environment}", "service:vibecode-frontend", "team:security"]

  locations = ["aws:us-east-1"]

  options_list {
    tick_every = 300 # Check every 5 minutes
  }

  request_definition {
    method = "GET"
    url    = "${var.app_base_url}/"
    
    headers = {
      "User-Agent" = "Datadog Security Scanner"
    }
  }

  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "200"
  }

  assertion {
    type     = "header"
    operator = "contains"
    property = "x-frame-options"
    target   = "DENY"
  }

  assertion {
    type     = "header"
    operator = "contains"
    property = "x-content-type-options"
    target   = "nosniff"
  }

  assertion {
    type     = "header"
    operator = "contains"
    property = "strict-transport-security"
    target   = "max-age"
  }

  assertion {
    type     = "header"
    operator = "contains"
    property = "content-security-policy"
    target   = "default-src"
  }
}

# Rate Limiting Test
resource "datadog_synthetics_test" "rate_limiting_test" {
  type    = "api"
  subtype = "multi"
  name    = "VibeCode Rate Limiting Test - ${var.environment}"
  message = "Rate limiting is not working properly. @security-team @slack-alerts"
  tags    = ["env:${var.environment}", "service:vibecode-api", "team:security"]

  locations = ["aws:us-east-1"]

  options_list {
    tick_every = 3600 # Check every hour
  }

  config_variable {
    name = "RAPIDFIRE_REQUESTS"
    type = "text"
    pattern = "10"
  }

  # Multiple rapid requests to test rate limiting
  api_step {
    name = "Rapid Request 1"
    
    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/chat"
      headers = {
        "Content-Type" = "application/json"
      }
      body = jsonencode({
        message = "rate limit test"
        workspaceId = "test"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "is"
      target   = "401" # Should be unauthorized
    }
  }

  # After rapid requests, should get rate limited
  api_step {
    name = "Rate Limited Request"
    
    request_definition {
      method = "POST"
      url    = "${var.app_base_url}/api/claude/chat"
      headers = {
        "Content-Type" = "application/json"
      }
      body = jsonencode({
        message = "should be rate limited"
        workspaceId = "test"
      })
    }

    assertion {
      type     = "statusCode"
      operator = "isNot"
      target   = "200" # Should not succeed due to rate limiting
    }
  }
}

# Monitoring Dashboard Configuration
resource "datadog_synthetics_test" "monitoring_dashboard_test" {
  type    = "api"
  subtype = "http"
  name    = "VibeCode Monitoring Dashboard Test - ${var.environment}"
  message = "Monitoring dashboard is not accessible. @slack-alerts"
  tags    = ["env:${var.environment}", "service:vibecode-monitoring", "team:platform"]

  locations = ["aws:us-east-1"]

  options_list {
    tick_every = 600 # Check every 10 minutes
  }

  request_definition {
    method = "GET"
    url    = "${var.app_base_url}/monitoring"
    
    headers = {
      "User-Agent" = "Datadog Synthetics"
    }
  }

  assertion {
    type     = "statusCode"
    operator = "isNot"
    target   = "500" # Should not error
  }

  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = "3000" # 3 seconds max for dashboard load
  }
}

# Global Variables for RUM
variable "datadog_rum_application_id" {
  description = "Datadog RUM Application ID"
  type        = string
  default     = ""
}

variable "datadog_rum_client_token" {
  description = "Datadog RUM Client Token"
  type        = string
  sensitive   = true
  default     = ""
}

# Outputs for monitoring
output "synthetics_test_ids" {
  description = "IDs of all synthetic tests created"
  value = {
    api_health_check       = datadog_synthetics_test.api_health_check.id
    auth_api_test         = datadog_synthetics_test.auth_api_test.id
    claude_api_security   = datadog_synthetics_test.claude_api_security_test.id
    database_connection   = datadog_synthetics_test.database_connection_test.id
    critical_user_flow    = datadog_synthetics_test.critical_user_flow.id
    performance_monitoring = datadog_synthetics_test.performance_monitoring.id
    security_headers      = datadog_synthetics_test.security_headers_test.id
    rate_limiting         = datadog_synthetics_test.rate_limiting_test.id
    monitoring_dashboard  = datadog_synthetics_test.monitoring_dashboard_test.id
  }
}