output "storage_account_id" {
  description = "ARM ID of the storage account"
  value       = azurerm_storage_account.this.id
}

output "storage_account_name" {
  description = "Name of the storage account"
  value       = azurerm_storage_account.this.name
}

output "content_container_name" {
  description = "Default blob container for uploaded content"
  value       = azurerm_storage_container.content.name
}

output "queue_name" {
  description = "Queue used for ingestion jobs"
  value       = azurerm_storage_queue.ingest.name
}
