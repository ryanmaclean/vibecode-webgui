# Azure Kubernetes Service (AKS) Configuration

# User-assigned Managed Identity for AKS cluster
resource "azurerm_user_assigned_identity" "aks_identity" {
  name                = "${local.name_prefix}-aks-identity"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# User-assigned Managed Identity for AKS kubelet
resource "azurerm_user_assigned_identity" "aks_kubelet_identity" {
  name                = "${local.name_prefix}-aks-kubelet-identity"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Role assignments for AKS cluster identity
resource "azurerm_role_assignment" "aks_identity_operator" {
  scope                = azurerm_user_assigned_identity.aks_kubelet_identity.id
  role_definition_name = "Managed Identity Operator"
  principal_id         = azurerm_user_assigned_identity.aks_identity.principal_id
}

resource "azurerm_role_assignment" "aks_vm_contributor" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Virtual Machine Contributor"
  principal_id         = azurerm_user_assigned_identity.aks_identity.principal_id
}

resource "azurerm_role_assignment" "aks_network_contributor" {
  scope                = azurerm_subnet.aks.id
  role_definition_name = "Network Contributor"
  principal_id         = azurerm_user_assigned_identity.aks_identity.principal_id
}

# Role assignments for kubelet identity
resource "azurerm_role_assignment" "aks_kubelet_acr_pull" {
  count                = var.acr_admin_enabled ? 0 : 1
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.aks_kubelet_identity.principal_id
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "main" {
  name                = "${local.name_prefix}-aks"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "${local.name_prefix}-aks"
  kubernetes_version  = var.aks_kubernetes_version

  # Private cluster configuration
  private_cluster_enabled             = var.enable_private_cluster
  private_dns_zone_id                = var.enable_private_cluster ? "System" : null
  private_cluster_public_fqdn_enabled = false

  # API server configuration
  dynamic "api_server_access_profile" {
    for_each = length(var.authorized_ip_ranges) > 0 ? [1] : []
    content {
      authorized_ip_ranges = var.authorized_ip_ranges
    }
  }

  # System node pool
  default_node_pool {
    name                = local.system_node_pool.name
    vm_size             = local.system_node_pool.vm_size
    node_count          = local.system_node_pool.node_count
    max_pods            = local.system_node_pool.max_pods
    os_disk_size_gb     = local.system_node_pool.os_disk_size_gb
    os_disk_type        = local.system_node_pool.os_disk_type
    vnet_subnet_id      = azurerm_subnet.aks.id
    
    enable_auto_scaling = local.system_node_pool.enable_auto_scaling
    min_count          = local.system_node_pool.min_count
    max_count          = local.system_node_pool.max_count
    
    only_critical_addons_enabled = true
    
    upgrade_settings {
      max_surge = "10%"
    }

    tags = local.common_tags
  }

  # Identity configuration
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aks_identity.id]
  }

  kubelet_identity {
    client_id                 = azurerm_user_assigned_identity.aks_kubelet_identity.client_id
    object_id                 = azurerm_user_assigned_identity.aks_kubelet_identity.principal_id
    user_assigned_identity_id = azurerm_user_assigned_identity.aks_kubelet_identity.id
  }

  # Network configuration
  network_profile {
    network_plugin      = "azure"
    network_policy      = var.enable_network_policy ? "azure" : null
    dns_service_ip      = "10.2.0.10"
    service_cidr        = "10.2.0.0/24"
    load_balancer_sku   = "standard"
    outbound_type       = "loadBalancer"
  }

  # Monitoring and logging
  oms_agent {
    log_analytics_workspace_id      = azurerm_log_analytics_workspace.main.id
    msi_auth_for_monitoring_enabled = true
  }

  # Azure Monitor for containers
  monitor_metrics {
    annotations_allowed = null
    labels_allowed      = null
  }

  # HTTP application routing (disabled for production)
  http_application_routing_enabled = false

  # Azure Key Vault integration
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "2m"
  }

  # Workload identity
  workload_identity_enabled = true
  oidc_issuer_enabled      = true

  # Azure Active Directory integration
  azure_active_directory_role_based_access_control {
    managed                = true
    tenant_id              = data.azurerm_client_config.current.tenant_id
    admin_group_object_ids = []
    azure_rbac_enabled     = true
  }

  # Auto-scaler profile
  auto_scaler_profile {
    balance_similar_node_groups      = false
    expander                        = "random"
    max_graceful_termination_sec    = "600"
    max_node_provisioning_time      = "15m"
    max_unready_nodes               = 3
    max_unready_percentage          = 45
    new_pod_scale_up_delay          = "10s"
    scale_down_delay_after_add      = "10m"
    scale_down_delay_after_delete   = "10s"
    scale_down_delay_after_failure  = "3m"
    scan_interval                   = "10s"
    scale_down_unneeded             = "10m"
    scale_down_unready              = "20m"
    scale_down_utilization_threshold = "0.5"
  }

  # Maintenance configuration
  maintenance_window {
    allowed {
      day   = "Sunday"
      hours = [2, 3, 4, 5]
    }
  }

  tags = local.common_tags

  depends_on = [
    azurerm_role_assignment.aks_identity_operator,
    azurerm_role_assignment.aks_vm_contributor,
    azurerm_role_assignment.aks_network_contributor,
  ]
}

# User node pool for application workloads
resource "azurerm_kubernetes_cluster_node_pool" "user" {
  name                  = local.user_node_pool.name
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size              = local.user_node_pool.vm_size
  node_count           = local.user_node_pool.node_count
  max_pods             = local.user_node_pool.max_pods
  os_disk_size_gb      = local.user_node_pool.os_disk_size_gb
  os_disk_type         = local.user_node_pool.os_disk_type
  vnet_subnet_id       = azurerm_subnet.aks.id

  enable_auto_scaling = local.user_node_pool.enable_auto_scaling
  min_count          = local.user_node_pool.min_count
  max_count          = local.user_node_pool.max_count

  # Node labels and taints
  node_labels = {
    "workload" = "user"
  }

  upgrade_settings {
    max_surge = "33%"
  }

  tags = local.common_tags
}

# Azure Container Registry
resource "azurerm_container_registry" "main" {
  name                = "${replace(local.name_prefix, "-", "")}acr"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = var.acr_sku
  admin_enabled       = var.acr_admin_enabled

  # Identity configuration
  identity {
    type = "SystemAssigned"
  }

  # Network configuration for Premium SKU
  dynamic "network_rule_set" {
    for_each = var.acr_sku == "Premium" ? [1] : []
    content {
      default_action = "Allow"
      
      virtual_network {
        action    = "Allow"
        subnet_id = azurerm_subnet.aks.id
      }
    }
  }

  # Retention policy for Premium SKU
  dynamic "retention_policy" {
    for_each = var.acr_sku == "Premium" ? [1] : []
    content {
      days    = 30
      enabled = true
    }
  }

  # Trust policy for Premium SKU
  dynamic "trust_policy" {
    for_each = var.acr_sku == "Premium" ? [1] : []
    content {
      enabled = true
    }
  }

  tags = local.common_tags
}

# Store ACR credentials in Key Vault (if admin enabled)
resource "azurerm_key_vault_secret" "acr_server" {
  name         = "acr-server"
  value        = azurerm_container_registry.main.login_server
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "acr_username" {
  count        = var.acr_admin_enabled ? 1 : 0
  name         = "acr-username"
  value        = azurerm_container_registry.main.admin_username
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "acr_password" {
  count        = var.acr_admin_enabled ? 1 : 0
  name         = "acr-password"
  value        = azurerm_container_registry.main.admin_password
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

# Outputs
output "aks_cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_cluster_id" {
  description = "ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
}

output "aks_cluster_fqdn" {
  description = "FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.fqdn
}

output "aks_cluster_identity" {
  description = "Identity information for the AKS cluster"
  value = {
    principal_id = azurerm_kubernetes_cluster.main.identity[0].principal_id
    tenant_id    = azurerm_kubernetes_cluster.main.identity[0].tenant_id
  }
}

output "acr_login_server" {
  description = "Login server for Azure Container Registry"
  value       = azurerm_container_registry.main.login_server
}

output "acr_admin_username" {
  description = "Admin username for Azure Container Registry"
  value       = var.acr_admin_enabled ? azurerm_container_registry.main.admin_username : null
  sensitive   = true
} 