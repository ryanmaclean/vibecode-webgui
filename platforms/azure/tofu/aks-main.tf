# AKS Infrastructure Configuration
# Providers and terraform configuration are in providers.tf

# Data sources
data "azurerm_client_config" "current" {}

# Generate random suffix for unique resource names
resource "random_id" "deployment" {
  byte_length = 4
  keepers = {
    resource_group = var.resource_group_name
    environment    = var.environment
  }
}

locals {
  # Common tags for all resources
  common_tags = merge(var.tags, {
    Environment  = var.environment
    Application  = "vibecode"
    ManagedBy    = "opentofu"
    DeploymentId = random_id.deployment.hex
    CreatedDate  = formatdate("YYYY-MM-DD", timestamp())
  })

  # Resource naming convention
  resource_prefix = "${var.project_name}-${var.environment}"
  unique_suffix   = random_id.deployment.hex

  # AKS cluster name with uniqueness
  aks_cluster_name = "${local.resource_prefix}-aks-${local.unique_suffix}"

  # Kubernetes namespace
  k8s_namespace = "vibecode-platform"
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}

# Virtual Network for AKS
resource "azurerm_virtual_network" "aks_vnet" {
  name                = "${local.resource_prefix}-vnet-${local.unique_suffix}"
  address_space       = [var.vnet_address_space]
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Subnet for AKS nodes
resource "azurerm_subnet" "aks_subnet" {
  name                 = "${local.resource_prefix}-aks-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.aks_vnet.name
  address_prefixes     = [var.aks_subnet_address_prefix]
}

# Subnet for PostgreSQL (when using flexible server)
resource "azurerm_subnet" "postgres_subnet" {
  name                 = "${local.resource_prefix}-postgres-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.aks_vnet.name
  address_prefixes     = [var.postgres_subnet_address_prefix]

  delegation {
    name = "fs"
    service_delegation {
      name = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action",
      ]
    }
  }
}

# Network Security Group for AKS
resource "azurerm_network_security_group" "aks_nsg" {
  name                = "${local.resource_prefix}-aks-nsg-${local.unique_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags

  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowHTTP"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

# Associate NSG with AKS subnet
resource "azurerm_subnet_network_security_group_association" "aks_nsg_association" {
  subnet_id                 = azurerm_subnet.aks_subnet.id
  network_security_group_id = azurerm_network_security_group.aks_nsg.id
}

# User Assigned Identity for AKS
resource "azurerm_user_assigned_identity" "aks_identity" {
  name                = "${local.resource_prefix}-aks-identity-${local.unique_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Azure Container Registry
resource "azurerm_container_registry" "main" {
  name                = "${var.project_name}cr${local.unique_suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = var.acr_sku
  admin_enabled       = true
  tags                = local.common_tags

  # Network access rules
  public_network_access_enabled = true
}

# Role assignment for AKS identity (Network Contributor)
resource "azurerm_role_assignment" "aks_network_contributor" {
  scope                = azurerm_virtual_network.aks_vnet.id
  role_definition_name = "Network Contributor"
  principal_id         = azurerm_user_assigned_identity.aks_identity.principal_id
  principal_type       = "ServicePrincipal"
}

# Role assignment for AKS to pull from ACR
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.aks_identity.principal_id
  principal_type       = "ServicePrincipal"
}

# Log Analytics Workspace for monitoring
resource "azurerm_log_analytics_workspace" "aks_logs" {
  name                = "${local.resource_prefix}-logs-${local.unique_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days
  tags                = local.common_tags
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "main" {
  name                              = local.aks_cluster_name
  location                          = azurerm_resource_group.main.location
  resource_group_name               = azurerm_resource_group.main.name
  dns_prefix                        = "${local.resource_prefix}-aks-${local.unique_suffix}"
  kubernetes_version                = var.kubernetes_version
  automatic_channel_upgrade         = "stable"
  node_resource_group               = "${var.resource_group_name}-nodes"
  local_account_disabled            = false
  role_based_access_control_enabled = true

  tags = local.common_tags

  # System node pool
  default_node_pool {
    name                = "system"
    node_count          = var.system_node_count
    vm_size             = var.system_node_vm_size
    vnet_subnet_id      = azurerm_subnet.aks_subnet.id
    type                = "VirtualMachineScaleSets"
    enable_auto_scaling = true
    min_count           = var.system_node_min_count
    max_count           = var.system_node_max_count
    max_pods            = 30
    os_disk_size_gb     = 100
    os_disk_type        = "Managed"

    upgrade_settings {
      max_surge = "10%"
    }

    node_labels = {
      "nodepool" = "system"
      "workload" = "system"
    }

  }

  # Identity configuration
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aks_identity.id]
  }

  # Network configuration
  network_profile {
    network_plugin    = "azure"
    network_policy    = "azure"
    dns_service_ip    = "10.2.0.10"
    service_cidr      = "10.2.0.0/24"
    load_balancer_sku = "standard"
    outbound_type     = "loadBalancer"
  }

  # Enable monitoring
  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.aks_logs.id
  }

  # Enable Azure AD integration
  azure_active_directory_role_based_access_control {
    managed                = true
    admin_group_object_ids = var.aks_admin_group_object_ids
    azure_rbac_enabled     = false
  }

  # Key Vault Secrets Provider
  key_vault_secrets_provider {
    secret_rotation_enabled = true
  }

  # Auto-scaler profile
  auto_scaler_profile {
    balance_similar_node_groups      = false
    expander                         = "random"
    max_graceful_termination_sec     = 600
    max_node_provisioning_time       = "15m"
    max_unready_nodes                = 3
    max_unready_percentage           = 45
    new_pod_scale_up_delay           = "10s"
    scale_down_delay_after_add       = "10m"
    scale_down_delay_after_delete    = "10s"
    scale_down_delay_after_failure   = "3m"
    scan_interval                    = "10s"
    scale_down_unneeded              = "10m"
    scale_down_unready               = "20m"
    scale_down_utilization_threshold = 0.5
    empty_bulk_delete_max            = 10
    skip_nodes_with_local_storage    = true
    skip_nodes_with_system_pods      = true
  }

  lifecycle {
    ignore_changes = [
      default_node_pool[0].node_count
    ]
  }

  depends_on = [
    azurerm_role_assignment.aks_network_contributor,
    azurerm_subnet_network_security_group_association.aks_nsg_association
  ]
}

# User node pool for application workloads
resource "azurerm_kubernetes_cluster_node_pool" "user_pool" {
  name                  = "user"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size               = var.user_node_vm_size
  node_count            = var.user_node_count
  enable_auto_scaling   = true
  min_count             = var.user_node_min_count
  max_count             = var.user_node_max_count
  vnet_subnet_id        = azurerm_subnet.aks_subnet.id
  max_pods              = 30
  os_disk_size_gb       = 100
  os_disk_type          = "Managed"
  os_type               = "Linux"

  upgrade_settings {
    max_surge = "33%"
  }

  node_labels = {
    "nodepool" = "user"
    "workload" = "application"
  }

  tags = local.common_tags

  lifecycle {
    ignore_changes = [node_count]
  }
}

# Create namespace for VibeCode application
resource "kubernetes_namespace" "vibecode_platform" {
  metadata {
    name = local.k8s_namespace

    labels = {
      name        = local.k8s_namespace
      environment = var.environment
      managed-by  = "opentofu"
    }

    annotations = {
      "azure.workload.identity/use" = "true"
    }
  }

  depends_on = [azurerm_kubernetes_cluster.main]
}
