locals {
  prefix_chars      = regexall("[a-z0-9-]", lower(var.name_prefix))
  normalized_prefix = length(local.prefix_chars) > 0 ? join("", local.prefix_chars) : "vibecode"
  base_prefix       = substr(local.normalized_prefix, 0, 40)
  plan_name         = substr("${local.base_prefix}-func-plan", 0, 40)
  function_app_name = substr("${local.base_prefix}-func", 0, 60)

  storage_account_name = element(split("/", var.storage_account_id), length(split("/", var.storage_account_id)) - 1)

  default_app_settings = merge(
    {
      FUNCTIONS_EXTENSION_VERSION = "~${var.functions_version}"
      FUNCTIONS_WORKER_RUNTIME    = "node"
      WEBSITE_RUN_FROM_PACKAGE    = "1"
    },
    var.monitoring_connection_string != "" ? {
      APPLICATIONINSIGHTS_CONNECTION_STRING = var.monitoring_connection_string
    } : {},
    var.storage_queue_name != "" ? {
      QUEUE_NAME = var.storage_queue_name
    } : {},
    var.app_settings
  )
}

data "azurerm_storage_account" "this" {
  name                = local.storage_account_name
  resource_group_name = var.resource_group_name
}

resource "azurerm_service_plan" "this" {
  name                = local.plan_name
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "Y1"
  tags                = var.tags
}

resource "azurerm_linux_function_app" "this" {
  name                       = local.function_app_name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  service_plan_id            = azurerm_service_plan.this.id
  storage_account_name       = data.azurerm_storage_account.this.name
  storage_account_access_key = data.azurerm_storage_account.this.primary_access_key
  https_only                 = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      node_version = "20"
    }
    application_insights_connection_string = var.monitoring_connection_string != "" ? var.monitoring_connection_string : null
    ftps_state                             = "Disabled"
    http2_enabled                          = true
  }

  app_settings = merge(
    {
      AzureWebJobsStorage = data.azurerm_storage_account.this.primary_connection_string
    },
    local.default_app_settings
  )

  tags = var.tags
}
