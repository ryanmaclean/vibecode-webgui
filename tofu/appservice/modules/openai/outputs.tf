output "openai_account_id" {
  description = "Resource ID of the Azure OpenAI account"
  value       = azurerm_cognitive_account.openai.id
}

output "openai_endpoint" {
  description = "Endpoint URL for Azure OpenAI"
  value       = azurerm_cognitive_account.openai.endpoint
}

output "chat_deployment_name" {
  description = "Chat deployment name"
  value       = azurerm_cognitive_deployment.chat.name
}

output "embedding_deployment_name" {
  description = "Embedding deployment name"
  value       = azurerm_cognitive_deployment.embedding.name
}
