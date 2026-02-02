locals {
  prefix_letters = regexall("[a-z0-9]", lower(var.name_prefix))
  normalized     = length(local.prefix_letters) > 0 ? join("", local.prefix_letters) : "vibecode"
  server_base    = substr(local.normalized, 0, 20)
  database_name  = lower(var.database_name)
}

resource "random_string" "server_suffix" {
  length  = 4
  upper   = false
  numeric = true
  special = false
}

resource "azurerm_postgresql_flexible_server" "this" {
  name                = "${local.server_base}${random_string.server_suffix.result}"
  resource_group_name = var.resource_group_name
  location            = var.location

  administrator_login    = var.administrator_login
  administrator_password = var.administrator_password

  version  = "16"
  sku_name = var.sku_name

  storage_mb                    = var.storage_size_gb * 1024
  backup_retention_days         = var.backup_retention_days
  create_mode                   = "Default"
  public_network_access_enabled = var.allowed_public_network
  delegated_subnet_id           = var.delegated_subnet_id != "" ? var.delegated_subnet_id : null

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server_database" "primary" {
  name      = local.database_name
  server_id = azurerm_postgresql_flexible_server.this.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_configuration" "pgvector" {
  name      = "shared_preload_libraries"
  server_id = azurerm_postgresql_flexible_server.this.id
  value     = "vector"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "allowed_ips" {
  for_each = { for ip in var.allowed_ip_rules : ip => ip }

  name             = "allow-${replace(each.key, ".", "-")}"
  server_id        = azurerm_postgresql_flexible_server.this.id
  start_ip_address = each.value
  end_ip_address   = each.value
}
