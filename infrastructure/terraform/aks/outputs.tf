# Outputs for Azure Kubernetes Service (AKS) Infrastructure

# Resource Group
output "resource_group_name" {
  description = "Name of the created resource group"
  value       = azurerm_resource_group.main.name
}

output "resource_group_location" {
  description = "Location of the created resource group"
  value       = azurerm_resource_group.main.location
}

# AKS Cluster
output "cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.name
}

output "cluster_id" {
  description = "ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
}

output "cluster_fqdn" {
  description = "FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.fqdn
}

output "cluster_private_fqdn" {
  description = "Private FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.private_fqdn
}

output "cluster_portal_fqdn" {
  description = "Portal FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.portal_fqdn
}

output "kubernetes_version" {
  description = "Version of Kubernetes running on the cluster"
  value       = azurerm_kubernetes_cluster.main.kubernetes_version
}

# Kubeconfig
output "kube_config" {
  description = "Raw kubeconfig for the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

output "kube_config_host" {
  description = "Host endpoint for the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config.0.host
  sensitive   = true
}

output "kube_config_client_certificate" {
  description = "Client certificate for AKS cluster authentication"
  value       = azurerm_kubernetes_cluster.main.kube_config.0.client_certificate
  sensitive   = true
}

output "kube_config_client_key" {
  description = "Client key for AKS cluster authentication"
  value       = azurerm_kubernetes_cluster.main.kube_config.0.client_key
  sensitive   = true
}

output "kube_config_cluster_ca_certificate" {
  description = "Cluster CA certificate for AKS cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate
  sensitive   = true
}

# Networking
output "vnet_id" {
  description = "ID of the virtual network"
  value       = azurerm_virtual_network.aks.id
}

output "vnet_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.aks.name
}

output "nodes_subnet_id" {
  description = "ID of the nodes subnet"
  value       = azurerm_subnet.aks_nodes.id
}

output "pods_subnet_id" {
  description = "ID of the pods subnet"
  value       = azurerm_subnet.aks_pods.id
}

output "network_security_group_id" {
  description = "ID of the network security group"
  value       = azurerm_network_security_group.aks.id
}

# Azure Container Registry
output "acr_name" {
  description = "Name of the Azure Container Registry"
  value       = azurerm_container_registry.main.name
}

output "acr_login_server" {
  description = "Login server URL for the Azure Container Registry"
  value       = azurerm_container_registry.main.login_server
}

output "acr_id" {
  description = "ID of the Azure Container Registry"
  value       = azurerm_container_registry.main.id
}

# Key Vault
output "key_vault_name" {
  description = "Name of the Azure Key Vault"
  value       = azurerm_key_vault.main.name
}

output "key_vault_id" {
  description = "ID of the Azure Key Vault"
  value       = azurerm_key_vault.main.id
}

output "key_vault_uri" {
  description = "URI of the Azure Key Vault"
  value       = azurerm_key_vault.main.vault_uri
}

# Managed Identity
output "aks_identity_principal_id" {
  description = "Principal ID of the AKS managed identity"
  value       = azurerm_user_assigned_identity.aks.principal_id
}

output "aks_identity_client_id" {
  description = "Client ID of the AKS managed identity"
  value       = azurerm_user_assigned_identity.aks.client_id
}

output "aks_identity_id" {
  description = "ID of the AKS managed identity"
  value       = azurerm_user_assigned_identity.aks.id
}

# Monitoring
output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.main.id
}

output "log_analytics_workspace_name" {
  description = "Name of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.main.name
}

output "application_insights_id" {
  description = "ID of the Application Insights instance"
  value       = azurerm_application_insights.main.id
}

output "application_insights_instrumentation_key" {
  description = "Instrumentation key for Application Insights"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Connection string for Application Insights"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

# Storage
output "backup_storage_account_name" {
  description = "Name of the backup storage account"
  value       = azurerm_storage_account.backup.name
}

output "backup_storage_account_primary_access_key" {
  description = "Primary access key for the backup storage account"
  value       = azurerm_storage_account.backup.primary_access_key
  sensitive   = true
}

output "backup_storage_account_primary_connection_string" {
  description = "Primary connection string for the backup storage account"
  value       = azurerm_storage_account.backup.primary_connection_string
  sensitive   = true
}

output "backup_container_name" {
  description = "Name of the backup storage container"
  value       = azurerm_storage_container.backup.name
}

# Node Pools
output "system_node_pool_name" {
  description = "Name of the system node pool"
  value       = azurerm_kubernetes_cluster.main.default_node_pool[0].name
}

output "application_node_pool_name" {
  description = "Name of the application node pool"
  value       = azurerm_kubernetes_cluster_node_pool.application.name
}

output "database_node_pool_name" {
  description = "Name of the database node pool"
  value       = var.enable_database_node_pool ? azurerm_kubernetes_cluster_node_pool.database[0].name : null
}

# Connection Information
output "cluster_connection_info" {
  description = "Information needed to connect to the AKS cluster"
  value = {
    cluster_name         = azurerm_kubernetes_cluster.main.name
    resource_group_name  = azurerm_resource_group.main.name
    subscription_id      = data.azurerm_client_config.current.subscription_id
    tenant_id           = data.azurerm_client_config.current.tenant_id
    location            = azurerm_resource_group.main.location
  }
}

# Environment Configuration
output "environment_config" {
  description = "Environment configuration for deployment scripts"
  value = {
    # Azure Configuration
    resource_group      = azurerm_resource_group.main.name
    cluster_name       = azurerm_kubernetes_cluster.main.name
    acr_name          = azurerm_container_registry.main.name
    location          = azurerm_resource_group.main.location
    
    # Key Vault
    key_vault_name    = azurerm_key_vault.main.name
    
    # Storage
    backup_storage_account = azurerm_storage_account.backup.name
    backup_container       = azurerm_storage_container.backup.name
    
    # Monitoring
    log_analytics_workspace = azurerm_log_analytics_workspace.main.name
    application_insights     = azurerm_application_insights.main.name
    
    # Networking
    vnet_name         = azurerm_virtual_network.aks.name
    nodes_subnet_name = azurerm_subnet.aks_nodes.name
    pods_subnet_name  = azurerm_subnet.aks_pods.name
  }
}

# Deployment Commands
output "deployment_commands" {
  description = "Commands to deploy applications to the cluster"
  value = {
    get_credentials = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
    acr_login      = "az acr login --name ${azurerm_container_registry.main.name}"
    helm_deploy    = "helm upgrade --install vibecode-app ./charts/vibecode --namespace vibecode-platform --values charts/vibecode/values-aks.yaml"
    bootstrap      = "./scripts/aks-bootstrap.sh"
  }
}

# URLs and Endpoints
output "endpoints" {
  description = "Important endpoints for the deployment"
  value = {
    acr_login_server = azurerm_container_registry.main.login_server
    key_vault_uri   = azurerm_key_vault.main.vault_uri
    cluster_fqdn    = azurerm_kubernetes_cluster.main.fqdn
    portal_fqdn     = azurerm_kubernetes_cluster.main.portal_fqdn
  }
}

# Cost Information
output "cost_estimates" {
  description = "Estimated monthly costs for major components"
  value = {
    cluster_management = "Free (managed service)"
    system_nodes      = "~$${var.system_node_max_count * 150}/month (${var.system_node_size})"
    application_nodes = "~$${var.app_node_max_count * 150}/month (${var.app_node_size})"
    database_nodes    = var.enable_database_node_pool ? "~$${var.db_node_max_count * 300}/month (${var.db_node_size})" : "Not enabled"
    acr              = var.acr_sku == "Premium" ? "~$500/month" : var.acr_sku == "Standard" ? "~$100/month" : "~$15/month"
    log_analytics    = "~$2-5/GB ingested"
    storage          = "~$0.02/GB/month"
    note             = "Estimates are approximate and vary by region and usage"
  }
}

# Security Information
output "security_info" {
  description = "Security-related information"
  value = {
    private_cluster_enabled = var.private_cluster_enabled
    rbac_enabled           = true
    network_policy_enabled = true
    key_vault_enabled      = true
    workload_identity      = var.enable_workload_identity
    defender_enabled       = var.enable_defender
    authorized_ip_ranges   = var.authorized_ip_ranges
  }
}
