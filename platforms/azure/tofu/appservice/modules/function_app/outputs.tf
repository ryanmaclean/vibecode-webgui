output "default_hostname" {
  description = "Default hostname for the Function App"
  value       = azurerm_linux_function_app.this.default_hostname
}

output "function_app_id" {
  description = "Function App resource ID"
  value       = azurerm_linux_function_app.this.id
}

output "principal_id" {
  description = "Managed identity principal ID for the Function App"
  value       = azurerm_linux_function_app.this.identity[0].principal_id
}
