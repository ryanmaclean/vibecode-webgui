locals {
  prefix_chars      = regexall("[a-z0-9-]", lower(var.name_prefix))
  normalized_prefix = length(local.prefix_chars) > 0 ? join("", local.prefix_chars) : "vibecode"
  base_prefix       = substr(local.normalized_prefix, 0, 40)
  workspace_name    = substr("${local.base_prefix}-log", 0, 62)
  app_insights_name = substr("${local.base_prefix}-insights", 0, 96)
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = local.workspace_name
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_analytics_retention_days

  tags = var.tags
}

resource "azurerm_application_insights" "this" {
  name                = local.app_insights_name
  location            = var.location
  resource_group_name = var.resource_group_name
  application_type    = upper(var.app_insights_application_type)
  workspace_id        = azurerm_log_analytics_workspace.this.id

  tags = var.tags
}

resource "azurerm_monitor_diagnostic_setting" "workspace_logs" {
  name                       = "web-app-logs"
  target_resource_id         = azurerm_application_insights.this.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id

  log {
    category = "AvailabilityResults"
    enabled  = true
    retention_policy {
      enabled = false
    }
  }

  metric {
    category = "All"
    enabled  = true
    retention_policy {
      enabled = false
    }
  }
}
