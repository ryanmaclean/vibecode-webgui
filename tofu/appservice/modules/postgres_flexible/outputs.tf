output "server_id" {
  description = "Resource ID of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.this.id
}

output "server_name" {
  description = "Name of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.this.name
}

output "fully_qualified_domain_name" {
  description = "Hostname of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.this.fqdn
}

output "administrator_login" {
  description = "Administrator login name"
  value       = azurerm_postgresql_flexible_server.this.administrator_login
}

output "database_name" {
  description = "Primary database name"
  value       = azurerm_postgresql_flexible_server_database.primary.name
}

output "connection_string_template" {
  description = "Connection string template without password"
  value       = "postgresql://${azurerm_postgresql_flexible_server.this.administrator_login}@${azurerm_postgresql_flexible_server.this.fqdn}:5432/${azurerm_postgresql_flexible_server_database.primary.name}?sslmode=require"
}
