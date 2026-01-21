locals {
  prefix_chars      = regexall("[a-z0-9-]", lower(var.name_prefix))
  normalized_prefix = length(local.prefix_chars) > 0 ? join("", local.prefix_chars) : "vibecode"
  base_prefix       = substr(local.normalized_prefix, 0, 40)
  plan_name         = substr("${local.base_prefix}-plan", 0, 40)
  web_app_name      = substr("${local.base_prefix}-web", 0, 60)

  runtime_parts    = split("|", lower(var.runtime_stack))
  runtime_language = length(local.runtime_parts) > 0 ? local.runtime_parts[0] : "node"
  runtime_version  = length(local.runtime_parts) > 1 ? local.runtime_parts[1] : "20-lts"

  instrumentation_settings = var.monitoring_instrumentation_key != "" ? {
    APPINSIGHTS_INSTRUMENTATIONKEY        = var.monitoring_instrumentation_key
    APPLICATIONINSIGHTS_CONNECTION_STRING = "InstrumentationKey=${var.monitoring_instrumentation_key}"
  } : {}

  content_settings = (var.storage_account_id != "" && var.storage_container_name != "") ? {
    CONTENT_STORAGE_ACCOUNT_ID = var.storage_account_id
    CONTENT_CONTAINER_NAME     = var.storage_container_name
  } : {}

  key_vault_settings = var.key_vault_id != "" ? {
    KEY_VAULT_ID = var.key_vault_id
  } : {}

  default_app_settings = merge({
    WEBSITE_RUN_FROM_PACKAGE            = "1"
    WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false"
    },
    local.instrumentation_settings,
    local.content_settings,
    local.key_vault_settings,
    var.app_settings
  )
}

resource "azurerm_service_plan" "this" {
  name                = local.plan_name
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = upper(var.app_service_plan_sku)
  tags                = var.tags
}

resource "azurerm_linux_web_app" "this" {
  name                = local.web_app_name
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.this.id
  https_only          = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on           = var.always_on
    http2_enabled       = true
    ftps_state          = "Disabled"
    minimum_tls_version = var.minimum_tls_version
    health_check_path   = var.health_check_path != "" ? var.health_check_path : null

    application_stack {
      node_version = local.runtime_language == "node" ? local.runtime_version : null
    }
  }

  app_settings = local.default_app_settings

  dynamic "connection_string" {
    for_each = var.connection_strings
    content {
      name  = connection_string.value.name
      type  = upper(connection_string.value.type)
      value = connection_string.value.value
    }
  }

  lifecycle {
    ignore_changes = [app_settings["APPINSIGHTS_INSTRUMENTATIONKEY"], tags]
  }

  tags = var.tags
}
