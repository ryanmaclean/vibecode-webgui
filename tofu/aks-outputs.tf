# AKS Cluster Outputs
output "aks_cluster_id" {
  description = "The ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
}

output "aks_cluster_name" {
  description = "The name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_cluster_fqdn" {
  description = "The FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.fqdn
}

output "aks_cluster_endpoint" {
  description = "The Kubernetes API server endpoint"
  value       = azurerm_kubernetes_cluster.main.kube_config.0.host
  sensitive   = true
}

output "aks_cluster_ca_certificate" {
  description = "The Cluster CA certificate"
  value       = azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate
  sensitive   = true
}

output "aks_client_certificate" {
  description = "The Client certificate"
  value       = azurerm_kubernetes_cluster.main.kube_config.0.client_certificate
  sensitive   = true
}

output "aks_client_key" {
  description = "The Client key"
  value       = azurerm_kubernetes_cluster.main.kube_config.0.client_key
  sensitive   = true
}

output "aks_kube_config_raw" {
  description = "Raw kubeconfig for the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

# Resource Group Outputs
output "resource_group_name" {
  description = "The name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "resource_group_location" {
  description = "The location of the resource group"
  value       = azurerm_resource_group.main.location
}

# Container Registry Outputs
output "acr_name" {
  description = "The name of the Azure Container Registry"
  value       = azurerm_container_registry.main.name
}

output "acr_login_server" {
  description = "The login server URL for the Azure Container Registry"
  value       = azurerm_container_registry.main.login_server
}

output "acr_admin_username" {
  description = "The admin username for the Azure Container Registry"
  value       = azurerm_container_registry.main.admin_username
  sensitive   = true
}

output "acr_admin_password" {
  description = "The admin password for the Azure Container Registry"
  value       = azurerm_container_registry.main.admin_password
  sensitive   = true
}

output "resource_group_id" {
  description = "The ID of the resource group"
  value       = azurerm_resource_group.main.id
}

# Networking Outputs
output "vnet_id" {
  description = "The ID of the virtual network"
  value       = azurerm_virtual_network.aks_vnet.id
}

output "vnet_name" {
  description = "The name of the virtual network"
  value       = azurerm_virtual_network.aks_vnet.name
}

output "aks_subnet_id" {
  description = "The ID of the AKS subnet"
  value       = azurerm_subnet.aks_subnet.id
}

output "postgres_subnet_id" {
  description = "The ID of the PostgreSQL subnet"
  value       = azurerm_subnet.postgres_subnet.id
}

# Identity Outputs
output "aks_identity_client_id" {
  description = "The Client ID of the AKS User Assigned Identity"
  value       = azurerm_user_assigned_identity.aks_identity.client_id
}

output "aks_identity_principal_id" {
  description = "The Principal ID of the AKS User Assigned Identity"
  value       = azurerm_user_assigned_identity.aks_identity.principal_id
}

# Monitoring Outputs
output "log_analytics_workspace_id" {
  description = "The ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.aks_logs.id
}

output "log_analytics_workspace_name" {
  description = "The name of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.aks_logs.name
}

output "log_analytics_workspace_key" {
  description = "The primary shared key for the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.aks_logs.primary_shared_key
  sensitive   = true
}

# Kubernetes Namespace
output "kubernetes_namespace" {
  description = "The name of the Kubernetes namespace for VibeCode"
  value       = kubernetes_namespace.vibecode_platform.metadata[0].name
}

# Deployment Information
output "deployment_id" {
  description = "Unique deployment identifier"
  value       = random_id.deployment.hex
}

output "deployment_timestamp" {
  description = "Deployment timestamp"
  value       = formatdate("YYYY-MM-DD hh:mm:ss ZZZ", timestamp())
}

# Connection Information for kubectl
output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
}

# Connection Information for Applications
output "postgres_connection_info" {
  description = "PostgreSQL connection information for in-cluster deployment"
  value = {
    service_name = "postgres-service"
    namespace    = kubernetes_namespace.vibecode_platform.metadata[0].name
    port         = 5432
    database     = "vibecode"
    username     = "vibecode"
  }
  sensitive = false
}

# Datadog Integration Information
output "datadog_cluster_name" {
  description = "Cluster name for Datadog monitoring"
  value       = local.aks_cluster_name
}

# Resource Naming Information
output "resource_prefix" {
  description = "Resource naming prefix used"
  value       = local.resource_prefix
}

output "unique_suffix" {
  description = "Unique suffix used for resource naming"
  value       = local.unique_suffix
}

# Tags Applied
output "common_tags" {
  description = "Common tags applied to all resources"
  value       = local.common_tags
}

# Validation Outputs
output "deployment_validation" {
  description = "Deployment validation information"
  value = {
    system_node_count     = azurerm_kubernetes_cluster.main.default_node_pool[0].node_count
    user_node_count       = azurerm_kubernetes_cluster_node_pool.user_pool.node_count
    kubernetes_version    = azurerm_kubernetes_cluster.main.kubernetes_version
    location              = azurerm_resource_group.main.location
    managed_identity_type = azurerm_kubernetes_cluster.main.identity[0].type
    cluster_fqdn          = azurerm_kubernetes_cluster.main.fqdn
  }
}