terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "azurerm" {
  features {}
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "OpenTofu"
    Template    = "container-app"
  })
}

resource "azurerm_resource_group" "main" {
  name     = "${local.name_prefix}-rg"
  location = var.location
  tags     = local.tags
}

resource "azurerm_cognitive_account" "openai" {
  name                = "${replace(local.name_prefix, "-", "")}-openai"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "OpenAI"
  sku_name            = var.azure_openai_sku_name

  tags = local.tags
}

resource "azurerm_cognitive_deployment" "gpt4" {
  name                 = "gpt-4-turbo"
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = "gpt-4"
    version = "turbo-2024-04-09"
  }

  scale {
    type     = "Standard"
    capacity = 30
  }
}

resource "azurerm_cognitive_deployment" "embeddings" {
  name                 = "text-embedding-ada-002"
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = "text-embedding-ada-002"
    version = "2"
  }

  scale {
    type     = "Standard"
    capacity = 120
  }
}

# Log Analytics workspace (required by Container Apps)
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${replace(local.name_prefix, "-", "")}-law"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

# Container Apps environment
resource "azurerm_container_app_environment" "main" {
  name                       = "${local.name_prefix}-env"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.tags
}

# Azure Database for PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "main" {
  name                         = "${local.name_prefix}-postgresql"
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "16"
  sku_name                     = var.postgresql_sku_name
  storage_mb                   = var.postgresql_storage_mb
  administrator_login          = var.postgresql_admin_username
  administrator_password       = random_password.postgres_admin.result
  backup_retention_days        = var.postgresql_backup_retention_days
  geo_redundant_backup_enabled = var.postgresql_geo_redundant_backup_enabled
  tags                         = local.tags
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = var.database_name
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

resource "azurerm_postgresql_flexible_server_configuration" "pgvector" {
  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "vector"
}

resource "random_password" "postgres_admin" {
  length  = 32
  special = true
}

# Container App for the Next.js frontend/API
resource "azurerm_container_app" "web" {
  name                         = "${local.name_prefix}-app"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = local.tags

  template {
    container {
      name   = "web"
      image  = var.container_image
      cpu    = var.container_cpu
      memory = var.container_memory

      env {
        name  = "DATABASE_URL"
        value = "postgresql://${var.postgresql_admin_username}:${random_password.postgres_admin.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.database_name}?sslmode=require"
      }
      env {
        name  = "AZURE_OPENAI_ENDPOINT"
        value = var.azure_openai_endpoint != "" ? var.azure_openai_endpoint : azurerm_cognitive_account.openai.endpoint
      }
     env {
       name       = "AZURE_OPENAI_API_KEY"
        value = var.azure_openai_api_key != "" ? var.azure_openai_api_key : azurerm_cognitive_account.openai.primary_access_key
      }
    }
    http_scale_rule {
      name                = "http"
      concurrent_requests = var.http_scale_concurrency
    }
  }

  ingress {
    external_enabled = true
    target_port      = var.container_port
    traffic_weight {
      percentage      = 100
      revision_suffix = "stable"
    }
  }

}

output "container_app_url" {
  value = azurerm_container_app.web.latest_revision_fqdn
}

output "azure_openai_account_name" {
  value = azurerm_cognitive_account.openai.name
}

output "postgresql_connection_string" {
  description = "Connection string for PostgreSQL flexible server"
  value       = "postgresql://${var.postgresql_admin_username}:${random_password.postgres_admin.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.database_name}?sslmode=require"
  sensitive   = true
}
