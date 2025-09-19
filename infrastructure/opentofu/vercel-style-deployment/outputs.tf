# Outputs for Vercel-style Doc Search deployment on AKS with OpenTofu

# Resource Group
output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "resource_group_location" {
  description = "Location of the resource group"
  value       = azurerm_resource_group.main.location
}

# AKS Cluster Information
output "aks_cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_cluster_fqdn" {
  description = "FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.fqdn
}

output "aks_cluster_id" {
  description = "ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
}

output "aks_kube_config" {
  description = "Kubernetes configuration for the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

output "aks_oidc_issuer_url" {
  description = "OIDC issuer URL for workload identity"
  value       = azurerm_kubernetes_cluster.main.oidc_issuer_url
}

# PostgreSQL Information (Supabase alternative)
output "postgresql_server_name" {
  description = "Name of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.name
}

output "postgresql_server_fqdn" {
  description = "FQDN of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgresql_database_name" {
  description = "Name of the PostgreSQL database"
  value       = azurerm_postgresql_flexible_server_database.main.name
}

output "postgresql_connection_string" {
  description = "PostgreSQL connection string (sensitive)"
  value       = "postgresql://${var.postgresql_admin_username}:${random_password.postgresql_password.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.database_name}?sslmode=require"
  sensitive   = true
}

# Azure OpenAI Information
output "azure_openai_account_name" {
  description = "Name of the Azure OpenAI account"
  value       = azurerm_cognitive_account.openai.name
}

output "azure_openai_endpoint" {
  description = "Endpoint URL for Azure OpenAI service"
  value       = azurerm_cognitive_account.openai.endpoint
}

output "azure_openai_api_key" {
  description = "API key for Azure OpenAI service (sensitive)"
  value       = azurerm_cognitive_account.openai.primary_access_key
  sensitive   = true
}

output "azure_openai_deployments" {
  description = "Azure OpenAI model deployments"
  value = {
    gpt4_turbo = {
      name = azurerm_cognitive_deployment.gpt4.name
      id   = azurerm_cognitive_deployment.gpt4.id
    }
    embeddings = {
      name = azurerm_cognitive_deployment.embeddings.name
      id   = azurerm_cognitive_deployment.embeddings.id
    }
  }
}

# Container Registry Information
output "container_registry_name" {
  description = "Name of the Azure Container Registry"
  value       = azurerm_container_registry.main.name
}

output "container_registry_login_server" {
  description = "Login server for the Azure Container Registry"
  value       = azurerm_container_registry.main.login_server
}

# Key Vault Information
output "key_vault_name" {
  description = "Name of the Azure Key Vault"
  value       = azurerm_key_vault.main.name
}

output "key_vault_uri" {
  description = "URI of the Azure Key Vault"
  value       = azurerm_key_vault.main.vault_uri
}

# Network Information
output "virtual_network_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.main.name
}

output "aks_subnet_id" {
  description = "ID of the AKS subnet"
  value       = azurerm_subnet.aks.id
}

output "postgresql_subnet_id" {
  description = "ID of the PostgreSQL subnet"
  value       = azurerm_subnet.postgresql.id
}

# Deployment Commands
output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
}

output "docker_login_command" {
  description = "Command to login to Azure Container Registry"
  value       = "az acr login --name ${azurerm_container_registry.main.name}"
}

# Application Environment Variables
output "application_environment_variables" {
  description = "Environment variables for the Next.js application"
  value = {
    DATABASE_URL               = "postgresql://${var.postgresql_admin_username}:${random_password.postgresql_password.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.database_name}?sslmode=require"
    AZURE_OPENAI_ENDPOINT      = azurerm_cognitive_account.openai.endpoint
    AZURE_OPENAI_API_KEY       = azurerm_cognitive_account.openai.primary_access_key
    GPT4_DEPLOYMENT_NAME       = azurerm_cognitive_deployment.gpt4.name
    EMBEDDINGS_DEPLOYMENT_NAME = azurerm_cognitive_deployment.embeddings.name
    NEXTAUTH_URL               = "https://docs.${var.project_name}.com"
    NODE_ENV                   = var.environment == "prod" ? "production" : "development"
  }
  sensitive = true
}

# Kubernetes Deployment Commands
output "deployment_commands" {
  description = "Commands to deploy the application"
  value = [
    "# 1. Get AKS credentials",
    "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}",
    "",
    "# 2. Build and push Docker image",
    "az acr login --name ${azurerm_container_registry.main.name}",
    "docker build -t ${azurerm_container_registry.main.login_server}/vibecode-docs:${var.nextjs_image_tag} .",
    "docker push ${azurerm_container_registry.main.login_server}/vibecode-docs:${var.nextjs_image_tag}",
    "",
    "# 3. Deploy application",
    "helm upgrade --install vibecode-docs ./helm/vibecode-docs --namespace vibecode-docs --create-namespace",
    "",
    "# 4. Initialize pgvector database",
    "kubectl exec -it deployment/vibecode-docs -- npm run db:migrate",
    "kubectl exec -it deployment/vibecode-docs -- npm run embeddings:generate"
  ]
}
