terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.117"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }

    time = {
      source  = "hashicorp/time"
      version = "~> 0.11"
    }
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }

  use_cli = true
}

locals {
  resource_prefix = "${var.project_name}-${var.environment}"

  tags = merge(
    {
      Application = var.project_name
      Environment = var.environment
      Owner       = var.owner
    },
    var.tags
  )

  datadog_app_settings = merge(
    {
      DD_API_KEY                 = var.datadog_api_key
      DD_SITE                    = var.datadog_site
      DD_ENV                     = var.datadog_env
      DD_SERVICE                 = var.datadog_service
      DD_VERSION                 = var.datadog_version
      DD_LOGS_INJECTION          = "true"
      DD_TRACE_ENABLED           = "true"
      DD_RUNTIME_METRICS_ENABLED = "true"
      NODE_OPTIONS               = "--require dd-trace/init"
    },
    var.appservice_additional_app_settings
  )
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.tags
}

module "storage" {
  source = "./modules/storage"

  name_prefix         = local.resource_prefix
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

module "postgres" {
  source = "./modules/postgres_flexible"

  name_prefix            = local.resource_prefix
  location               = var.location
  resource_group_name    = azurerm_resource_group.main.name
  administrator_login    = var.postgres_admin_login
  administrator_password = var.postgres_admin_password
  sku_name               = var.postgres_sku_name
  storage_size_gb        = var.postgres_storage_size_gb
  backup_retention_days  = var.postgres_backup_retention_days
  database_name          = var.postgres_database_name
  allowed_ip_rules       = var.postgres_allowed_ip_rules
  delegated_subnet_id    = var.postgres_delegated_subnet_id
  allowed_public_network = var.postgres_public_network_access
  tags                   = local.tags
}

module "key_vault" {
  source = "./modules/key_vault"

  name_prefix         = local.resource_prefix
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = var.tenant_id
  tags                = local.tags
  access_policies     = var.key_vault_access_policies
}

module "monitoring" {
  source = "./modules/monitoring"

  name_prefix         = local.resource_prefix
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

module "app_service" {
  source = "./modules/app_service"

  name_prefix                    = local.resource_prefix
  location                       = var.location
  resource_group_name            = azurerm_resource_group.main.name
  app_service_plan_sku           = var.app_service_plan_sku
  runtime_stack                  = var.app_runtime_stack
  monitoring_instrumentation_key = module.monitoring.instrumentation_key
  storage_account_id             = module.storage.storage_account_id
  storage_container_name         = module.storage.content_container_name
  key_vault_id                   = module.key_vault.key_vault_id
  app_settings                   = local.datadog_app_settings
  tags                           = local.tags
}

module "function_app" {
  source = "./modules/function_app"

  name_prefix                  = local.resource_prefix
  location                     = var.location
  resource_group_name          = azurerm_resource_group.main.name
  storage_account_id           = module.storage.storage_account_id
  storage_queue_name           = module.storage.queue_name
  monitoring_connection_string = module.monitoring.app_insights_connection_string
  tags                         = local.tags
}

module "openai" {
  source = "./modules/openai"

  name_prefix         = local.resource_prefix
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

output "resource_group_name" {
  description = "Name of the resource group hosting the PaaS stack"
  value       = azurerm_resource_group.main.name
}

output "storage_account_name" {
  description = "Name of the primary storage account"
  value       = module.storage.storage_account_name
}

output "web_app_default_hostname" {
  description = "Default hostname for the App Service"
  value       = module.app_service.default_hostname
}

output "function_app_default_hostname" {
  description = "Default hostname for the Function App"
  value       = module.function_app.default_hostname
}
