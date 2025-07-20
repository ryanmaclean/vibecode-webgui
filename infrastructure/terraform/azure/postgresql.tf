# Azure Database for PostgreSQL Flexible Server with pgvector
# Configured according to: https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-use-pgvector

# Private DNS Zone for PostgreSQL
resource "azurerm_private_dns_zone" "postgresql" {
  name                = "privatelink.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Link Private DNS Zone to Virtual Network
resource "azurerm_private_dns_zone_virtual_network_link" "postgresql" {
  name                  = "${local.name_prefix}-postgresql-dns-link"
  resource_group_name   = azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.postgresql.name
  virtual_network_id    = azurerm_virtual_network.main.id
  tags                  = local.common_tags
}

# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "main" {
  name                = "${local.name_prefix}-postgresql"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  # Database configuration
  version                      = var.postgresql_version
  administrator_login          = var.postgresql_admin_username
  administrator_password       = random_password.postgres_admin_password.result
  
  # Performance and storage
  sku_name                     = var.postgresql_sku_name
  storage_mb                   = var.postgresql_storage_mb
  storage_tier                 = "P30"
  
  # Backup configuration
  backup_retention_days        = var.postgresql_backup_retention_days
  geo_redundant_backup_enabled = var.postgresql_geo_redundant_backup_enabled

  # High availability
  dynamic "high_availability" {
    for_each = var.postgresql_high_availability_enabled ? [1] : []
    content {
      mode = "ZoneRedundant"
    }
  }

  # Network configuration
  delegated_subnet_id = azurerm_subnet.postgresql.id
  private_dns_zone_id = azurerm_private_dns_zone.postgresql.id
  
  # Security
  create_mode = "Default"
  
  # Maintenance window
  maintenance_window {
    day_of_week  = 0  # Sunday
    start_hour   = 2  # 2 AM
    start_minute = 0
  }

  tags = local.common_tags

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgresql]
}

# PostgreSQL Configuration for pgvector
resource "azurerm_postgresql_flexible_server_configuration" "pgvector" {
  name      = "shared_preload_libraries"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "vector"
}

# PostgreSQL Configuration for max_wal_size (recommended for vector operations)
resource "azurerm_postgresql_flexible_server_configuration" "max_wal_size" {
  name      = "max_wal_size"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "2GB"
}

# PostgreSQL Configuration for work_mem (recommended for vector operations)
resource "azurerm_postgresql_flexible_server_configuration" "work_mem" {
  name      = "work_mem"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "256MB"
}

# PostgreSQL Configuration for maintenance_work_mem (recommended for vector index creation)
resource "azurerm_postgresql_flexible_server_configuration" "maintenance_work_mem" {
  name      = "maintenance_work_mem"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "512MB"
}

# Create the main database
resource "azurerm_postgresql_flexible_server_database" "vibecode" {
  name      = "vibecode_prod"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"

  # Prevent deletion during development
  lifecycle {
    prevent_destroy = true
  }
}

# PostgreSQL Firewall Rule for Azure Services
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# PostgreSQL Firewall Rule for AKS subnet
resource "azurerm_postgresql_flexible_server_firewall_rule" "aks_subnet" {
  name             = "AllowAKSSubnet"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = cidrhost(azurerm_subnet.aks.address_prefixes[0], 0)
  end_ip_address   = cidrhost(azurerm_subnet.aks.address_prefixes[0], -1)
}

# Store PostgreSQL connection string in Key Vault
resource "azurerm_key_vault_secret" "postgres_connection_string" {
  name         = "postgres-connection-string"
  value        = "postgresql://${var.postgresql_admin_username}:${random_password.postgres_admin_password.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.vibecode.name}?sslmode=require"
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

# PostgreSQL extensions to be enabled via Azure CLI or manual setup
# Note: Extensions must be enabled manually after server creation
# Required extensions for VibeCode:
# - vector (for pgvector functionality)
# - uuid-ossp (for UUID generation)
# - pg_stat_statements (for Datadog DBM)

# Datadog Database Monitoring configuration
# Create a dedicated monitoring user for Datadog
# This will be done via null_resource and Azure CLI since Terraform doesn't support user creation directly

resource "null_resource" "setup_postgresql_extensions" {
  depends_on = [
    azurerm_postgresql_flexible_server.main,
    azurerm_postgresql_flexible_server_database.vibecode,
    azurerm_postgresql_flexible_server_configuration.pgvector
  ]

  # Trigger re-execution when server configuration changes
  triggers = {
    server_id = azurerm_postgresql_flexible_server.main.id
    database_id = azurerm_postgresql_flexible_server_database.vibecode.id
  }

  # Setup extensions and Datadog monitoring user
  provisioner "local-exec" {
    command = <<-EOT
      # Wait for PostgreSQL to be ready
      echo "Waiting for PostgreSQL server to be ready..."
      sleep 60
      
      # Install Azure CLI extension for PostgreSQL if not already installed
      az extension add --name rdbms-connect --only-show-errors || true
      
      # Enable required extensions
      echo "Enabling PostgreSQL extensions..."
      
      # Connect and enable extensions
      PGPASSWORD='${random_password.postgres_admin_password.result}' psql \
        "host=${azurerm_postgresql_flexible_server.main.fqdn} port=5432 dbname=${azurerm_postgresql_flexible_server_database.vibecode.name} user=${var.postgresql_admin_username} sslmode=require" \
        -c "CREATE EXTENSION IF NOT EXISTS vector;" \
        -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" \
        -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" \
        -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp', 'pg_stat_statements');" \
        || echo "Extensions setup completed with warnings (may already exist)"
      
      # Create Datadog monitoring user
      echo "Setting up Datadog monitoring user..."
      PGPASSWORD='${random_password.postgres_admin_password.result}' psql \
        "host=${azurerm_postgresql_flexible_server.main.fqdn} port=5432 dbname=${azurerm_postgresql_flexible_server_database.vibecode.name} user=${var.postgresql_admin_username} sslmode=require" \
        -c "CREATE USER datadog WITH password 'dd-monitoring-password-${random_id.datadog_user.hex}';" \
        -c "GRANT SELECT ON pg_stat_database TO datadog;" \
        -c "GRANT SELECT ON pg_stat_activity TO datadog;" \
        -c "GRANT SELECT ON pg_stat_statements TO datadog;" \
        -c "GRANT SELECT ON pg_stat_user_tables TO datadog;" \
        -c "GRANT SELECT ON pg_stat_user_indexes TO datadog;" \
        -c "GRANT CONNECT ON DATABASE ${azurerm_postgresql_flexible_server_database.vibecode.name} TO datadog;" \
        || echo "Datadog user setup completed with warnings (may already exist)"
      
      echo "PostgreSQL extensions and monitoring setup completed"
    EOT
    
    interpreter = ["/bin/bash", "-c"]
    
    environment = {
      PGCONNECT_TIMEOUT = "30"
    }
  }
}

# Random ID for Datadog monitoring user password
resource "random_id" "datadog_user" {
  byte_length = 16
}

# Store Datadog monitoring user credentials in Key Vault
resource "azurerm_key_vault_secret" "datadog_postgres_user" {
  name         = "datadog-postgres-username"
  value        = "datadog"
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "datadog_postgres_password" {
  name         = "datadog-postgres-password"
  value        = "dd-monitoring-password-${random_id.datadog_user.hex}"
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

# Diagnostic Settings for PostgreSQL (Datadog integration)
resource "azurerm_monitor_diagnostic_setting" "postgresql" {
  name                       = "${local.name_prefix}-postgresql-diagnostics"
  target_resource_id         = azurerm_postgresql_flexible_server.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "PostgreSQLLogs"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# Output PostgreSQL connection information
output "postgresql_server_fqdn" {
  description = "Fully qualified domain name of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.fqdn
  sensitive   = false
}

output "postgresql_database_name" {
  description = "Name of the PostgreSQL database"
  value       = azurerm_postgresql_flexible_server_database.vibecode.name
  sensitive   = false
}

output "postgresql_admin_username" {
  description = "Administrator username for PostgreSQL"
  value       = var.postgresql_admin_username
  sensitive   = false
}

output "postgresql_connection_string_secret" {
  description = "Key Vault secret name for PostgreSQL connection string"
  value       = azurerm_key_vault_secret.postgres_connection_string.name
  sensitive   = false
} 