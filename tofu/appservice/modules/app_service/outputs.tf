output "default_hostname" {
  description = "Default hostname for the App Service"
  value       = azurerm_linux_web_app.this.default_hostname
}

output "app_service_plan_id" {
  description = "App Service Plan resource ID"
  value       = azurerm_service_plan.this.id
}

output "principal_id" {
  description = "Managed identity principal ID for the web app"
  value       = azurerm_linux_web_app.this.identity[0].principal_id
}

output "web_app_id" {
  description = "App Service resource ID"
  value       = azurerm_linux_web_app.this.id
}
