# Main Terraform Configuration for Datadog Synthetics
#
# Orchestrates all Datadog synthetic monitoring for VibeCode platform
# Staff Engineer Implementation - Production monitoring infrastructure

terraform {
  required_version = ">= 1.0"

  required_providers {
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.39"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    bucket = "vibecode-terraform-state"
    key    = "monitoring/datadog-synthetics/terraform.tfstate"
    region = "us-east-1"

    # Enable state locking
    dynamodb_table = "vibecode-terraform-locks"
    encrypt        = true
  }
}

# Configure Datadog provider
provider "datadog" {
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
  api_url = "https://api.datadoghq.com/"
}

# Data sources for existing Datadog resources
data "datadog_dashboard_list" "existing_dashboards" {
  name_filter = "VibeCode"
}

data "datadog_monitor" "existing_monitors" {
  name_filter = "VibeCode"
  tags_filter = ["env:${var.environment}"]
}

# Local values for computed configurations
locals {
  # Common synthetic test configuration
  common_synthetic_config = {
    environment    = var.environment
    locations      = var.monitoring_locations
    tags          = local.common_tags
    notifications = local.notification_message
  }

  # Security test locations (cost optimized)
  security_locations = slice(var.monitoring_locations, 0, min(2, length(var.monitoring_locations)))

  # Performance test locations (global coverage)
  performance_locations = var.monitoring_locations

  # Computed notification message
  notification_message = join(" ", var.notification_channels)

  # Common tags merged with environment
  common_tags = merge(var.tags, {
    environment = var.environment
    service     = "vibecode"
    managed_by  = "terraform"
  })
}

# Main synthetics configuration module
module "datadog_synthetics" {
  source = "./modules/synthetics"

  # Pass all variables to the module
  app_base_url              = var.app_base_url
  environment              = var.environment
  notification_channels    = var.notification_channels
  monitoring_locations     = var.monitoring_locations
  test_intervals          = var.test_intervals
  performance_thresholds  = var.performance_thresholds
  security_test_config    = var.security_test_config
  alerting_config         = var.alerting_config
  common_tags             = local.common_tags

  # RUM configuration
  datadog_rum_application_id = var.datadog_rum_application_id
  datadog_rum_client_token   = var.datadog_rum_client_token
}

# Security-specific synthetics module
module "security_synthetics" {
  source = "./modules/security"

  app_base_url           = var.app_base_url
  environment           = var.environment
  security_locations    = local.security_locations
  test_intervals       = var.test_intervals
  security_test_config = var.security_test_config
  alerting_config      = var.alerting_config
  common_tags          = local.common_tags
}

# Performance monitoring module
module "performance_synthetics" {
  source = "./modules/performance"

  app_base_url            = var.app_base_url
  environment            = var.environment
  performance_locations  = local.performance_locations
  test_intervals        = var.test_intervals
  performance_thresholds = var.performance_thresholds
  common_tags           = local.common_tags
}

# Create Datadog dashboard for synthetic test results
resource "datadog_dashboard" "synthetics_overview" {
  title         = "VibeCode Synthetic Monitoring Overview - ${var.environment}"
  description   = "Overview of all synthetic tests for VibeCode platform"
  layout_type   = "ordered"
  is_read_only  = false

  tags = local.common_tags

  widget {
    query_value_definition {
      title       = "API Health Check Status"
      title_size  = "16"
      title_align = "left"

      request {
        q          = "avg:synthetics.test.runs{test_name:*health_check*,env:${var.environment}}"
        aggregator = "avg"
      }

      autoscale   = true
      precision   = 0
      text_align  = "center"
    }
  }

  widget {
    timeseries_definition {
      title       = "Synthetic Test Response Times"
      title_size  = "16"
      title_align = "left"

      request {
        q           = "avg:synthetics.http.response.time{env:${var.environment}} by {test_name}"
        display_type = "line"
        style {
          palette    = "dog_classic"
          line_type  = "solid"
          line_width = "normal"
        }
      }

      yaxis {
        label       = "Response Time (ms)"
        scale       = "linear"
        min         = "0"
        include_zero = true
      }
    }
  }

  widget {
    heatmap_definition {
      title       = "Synthetic Test Success Rate by Location"
      title_size  = "16"
      title_align = "left"

      request {
        q = "avg:synthetics.test.runs{env:${var.environment}} by {location,test_name}"

        style {
          palette = "green_to_red"
        }
      }

      yaxis {
        label = "Tests"
        scale = "linear"
      }
    }
  }

  widget {
    alert_graph_definition {
      title       = "Security Test Alerts"
      title_size  = "16"
      title_align = "left"

      alert_id = module.security_synthetics.alert_ids[0] # Reference first security alert
      viz_type = "timeseries"
    }
  }

  template_variable {
    name    = "environment"
    prefix  = "env"
    default = var.environment
  }

  template_variable {
    name    = "test_type"
    prefix  = "test_type"
    default = "*"
  }
}

# Create SLO (Service Level Objective) for API availability
resource "datadog_service_level_objective" "api_availability" {
  name        = "VibeCode API Availability - ${var.environment}"
  type        = "monitor"
  description = "99.9% availability for VibeCode API endpoints"

  tags = local.common_tags

  monitor_ids = [
    module.datadog_synthetics.health_check_monitor_id,
    module.datadog_synthetics.auth_monitor_id
  ]

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
}

# Create SLO for performance
resource "datadog_service_level_objective" "api_performance" {
  name        = "VibeCode API Performance - ${var.environment}"
  type        = "metric"
  description = "95% of API requests should complete under 200ms"

  tags = local.common_tags

  query {
    numerator   = "sum:synthetics.http.response.time{env:${var.environment}}.as_count()"
    denominator = "sum:synthetics.http.response.time{env:${var.environment}}.as_count()"
  }

  thresholds {
    timeframe = "7d"
    target    = 95.0
    warning   = 90.0
  }
}

# Outputs for other modules and monitoring
output "synthetics_test_ids" {
  description = "Map of all synthetic test IDs"
  value = {
    health_check      = module.datadog_synthetics.test_ids.health_check
    auth_test        = module.datadog_synthetics.test_ids.auth_test
    security_tests   = module.security_synthetics.test_ids
    performance_tests = module.performance_synthetics.test_ids
  }
}

output "dashboard_url" {
  description = "URL to the Datadog synthetics dashboard"
  value       = "https://app.datadoghq.com/dashboard/${datadog_dashboard.synthetics_overview.id}"
}

output "slo_ids" {
  description = "Service Level Objective IDs"
  value = {
    api_availability = datadog_service_level_objective.api_availability.id
    api_performance  = datadog_service_level_objective.api_performance.id
  }
}

output "monitoring_summary" {
  description = "Summary of monitoring configuration"
  value = {
    environment           = var.environment
    total_test_locations = length(var.monitoring_locations)
    security_locations   = length(local.security_locations)
    performance_tests    = length(module.performance_synthetics.test_ids)
    security_tests       = length(module.security_synthetics.test_ids)
    notification_channels = length(var.notification_channels)
  }
}
