# Tundra Dome AKS Cluster - Azure Kubernetes Service
# Multi-cluster infrastructure for distributed bead processing

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.45"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Backend configuration for state management
  backend "azurerm" {
    # Configure via backend.tf or environment variables
  }
}

# Provider configuration
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.tundra_dome.kube_config[0].host
  client_certificate     = base64decode(azurerm_kubernetes_cluster.tundra_dome.kube_config[0].client_certificate)
  client_key             = base64decode(azurerm_kubernetes_cluster.tundra_dome.kube_config[0].client_key)
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.tundra_dome.kube_config[0].cluster_ca_certificate)
}

# Data sources
data "azurerm_client_config" "current" {}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Local values
locals {
  cluster_name    = "${var.cluster_prefix}-${var.environment}-${random_id.suffix.hex}"
  resource_prefix = "${var.cluster_prefix}-${var.environment}"

  common_tags = merge(var.tags, {
    Environment  = var.environment
    Project      = "tundra-dome"
    ManagedBy    = "terraform"
    ClusterType  = "multi-cluster"
    CreatedDate  = formatdate("YYYY-MM-DD", timestamp())
  })
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${local.resource_prefix}-rg-${random_id.suffix.hex}"
  location = var.location
  tags     = local.common_tags
}

# Virtual Network
resource "azurerm_virtual_network" "aks" {
  name                = "${local.cluster_name}-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = [var.vnet_cidr]
  tags                = local.common_tags
}

# Subnet for AKS nodes
resource "azurerm_subnet" "aks_nodes" {
  name                 = "${local.cluster_name}-nodes-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.aks.name
  address_prefixes     = [var.nodes_subnet_cidr]
}

# Subnet for pods (CNI)
resource "azurerm_subnet" "aks_pods" {
  name                 = "${local.cluster_name}-pods-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.aks.name
  address_prefixes     = [var.pods_subnet_cidr]

  delegation {
    name = "aks-delegation"
    service_delegation {
      name    = "Microsoft.ContainerService/managedClusters"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

# Network Security Group
resource "azurerm_network_security_group" "aks" {
  name                = "${local.cluster_name}-nsg"
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

# Associate NSG with subnet
resource "azurerm_subnet_network_security_group_association" "aks_nodes" {
  subnet_id                 = azurerm_subnet.aks_nodes.id
  network_security_group_id = azurerm_network_security_group.aks.id
}

# User Assigned Identity for AKS
resource "azurerm_user_assigned_identity" "aks" {
  name                = "${local.cluster_name}-identity"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Role assignment for network contributor
resource "azurerm_role_assignment" "aks_network" {
  principal_id         = azurerm_user_assigned_identity.aks.principal_id
  role_definition_name = "Network Contributor"
  scope                = azurerm_virtual_network.aks.id
}

# Azure Container Registry
resource "azurerm_container_registry" "main" {
  count = var.create_acr ? 1 : 0

  name                = "${var.cluster_prefix}${var.environment}acr${random_id.suffix.hex}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = var.acr_sku
  admin_enabled       = false
  tags                = local.common_tags

  network_rule_set {
    default_action = var.acr_public_access ? "Allow" : "Deny"
  }
}

# Role assignment for ACR pull
resource "azurerm_role_assignment" "aks_acr_pull" {
  count = var.create_acr ? 1 : 0

  principal_id         = azurerm_user_assigned_identity.aks.principal_id
  role_definition_name = "AcrPull"
  scope                = azurerm_container_registry.main[0].id
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.cluster_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days
  tags                = local.common_tags
}

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = "${local.cluster_name}-insights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = local.common_tags
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "tundra_dome" {
  name                              = local.cluster_name
  location                          = azurerm_resource_group.main.location
  resource_group_name               = azurerm_resource_group.main.name
  dns_prefix                        = "${local.resource_prefix}-dns"
  kubernetes_version                = var.kubernetes_version
  automatic_channel_upgrade         = var.automatic_channel_upgrade
  node_resource_group               = "${azurerm_resource_group.main.name}-nodes"
  local_account_disabled            = false
  role_based_access_control_enabled = true
  private_cluster_enabled           = var.private_cluster_enabled

  tags = local.common_tags

  # Default system node pool
  default_node_pool {
    name                = "system"
    node_count          = var.system_node_count
    vm_size             = var.system_node_vm_size
    type                = "VirtualMachineScaleSets"
    availability_zones  = var.availability_zones
    enable_auto_scaling = true
    min_count           = var.system_node_min_count
    max_count           = var.system_node_max_count
    vnet_subnet_id      = azurerm_subnet.aks_nodes.id
    pod_subnet_id       = azurerm_subnet.aks_pods.id
    os_disk_size_gb     = 100
    os_disk_type        = "Managed"
    max_pods            = 30

    node_labels = {
      nodepool     = "system"
      workload     = "system"
      cluster-type = "tundra-dome"
    }

    node_taints = ["CriticalAddonsOnly=true:NoSchedule"]

    upgrade_settings {
      max_surge = "10%"
    }
  }

  # Identity configuration
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aks.id]
  }

  # Network profile
  network_profile {
    network_plugin      = "azure"
    network_policy      = "azure"
    dns_service_ip      = var.dns_service_ip
    service_cidr        = var.service_cidr
    load_balancer_sku   = "standard"
    outbound_type       = "loadBalancer"
  }

  # Monitoring
  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  }

  # Azure Policy
  azure_policy_enabled = var.enable_azure_policy

  # Azure AD RBAC
  dynamic "azure_active_directory_role_based_access_control" {
    for_each = var.enable_azure_ad_rbac ? [1] : []
    content {
      managed                = true
      admin_group_object_ids = var.aks_admin_group_object_ids
      azure_rbac_enabled     = true
    }
  }

  # Key Vault secrets provider
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "2m"
  }

  # Maintenance window
  maintenance_window {
    allowed {
      day   = "Sunday"
      hours = [2, 3, 4]
    }
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
    azurerm_role_assignment.aks_network
  ]
}

# Application node pool
resource "azurerm_kubernetes_cluster_node_pool" "application" {
  name                  = "application"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.tundra_dome.id
  vm_size               = var.app_node_vm_size
  node_count            = var.app_node_count
  availability_zones    = var.availability_zones
  enable_auto_scaling   = true
  min_count             = var.app_node_min_count
  max_count             = var.app_node_max_count
  vnet_subnet_id        = azurerm_subnet.aks_nodes.id
  pod_subnet_id         = azurerm_subnet.aks_pods.id
  os_disk_size_gb       = 100
  os_disk_type          = "Managed"
  max_pods              = 30

  node_labels = {
    nodepool     = "application"
    workload     = "beads"
    cluster-type = "tundra-dome"
  }

  upgrade_settings {
    max_surge = "33%"
  }

  tags = merge(local.common_tags, {
    "nodepool-type" = "application"
  })

  lifecycle {
    ignore_changes = [node_count]
  }
}

# Kubernetes namespace
resource "kubernetes_namespace" "tundra_dome" {
  metadata {
    name = "tundra-dome"

    labels = {
      name        = "tundra-dome"
      environment = var.environment
      managed-by  = "terraform"
      cluster     = local.cluster_name
    }
  }

  depends_on = [azurerm_kubernetes_cluster.tundra_dome]
}

# Variables
variable "location" {
  description = "Azure region"
  type        = string
  default     = "East US"
}

variable "cluster_prefix" {
  description = "Prefix for cluster name"
  type        = string
  default     = "tundra-dome"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "vnet_cidr" {
  description = "CIDR block for VNet"
  type        = string
  default     = "10.0.0.0/16"
}

variable "nodes_subnet_cidr" {
  description = "CIDR block for nodes subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "pods_subnet_cidr" {
  description = "CIDR block for pods subnet"
  type        = string
  default     = "10.0.2.0/24"
}

variable "dns_service_ip" {
  description = "DNS service IP"
  type        = string
  default     = "10.2.0.10"
}

variable "service_cidr" {
  description = "Service CIDR"
  type        = string
  default     = "10.2.0.0/24"
}

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "automatic_channel_upgrade" {
  description = "Automatic upgrade channel (patch, stable, rapid, node-image)"
  type        = string
  default     = "stable"
}

variable "private_cluster_enabled" {
  description = "Enable private cluster"
  type        = bool
  default     = false
}

variable "availability_zones" {
  description = "Availability zones for node pools"
  type        = list(string)
  default     = ["1", "2", "3"]
}

variable "system_node_count" {
  description = "Initial number of system nodes"
  type        = number
  default     = 2
}

variable "system_node_min_count" {
  description = "Minimum number of system nodes"
  type        = number
  default     = 1
}

variable "system_node_max_count" {
  description = "Maximum number of system nodes"
  type        = number
  default     = 4
}

variable "system_node_vm_size" {
  description = "VM size for system nodes"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "app_node_count" {
  description = "Initial number of application nodes"
  type        = number
  default     = 3
}

variable "app_node_min_count" {
  description = "Minimum number of application nodes"
  type        = number
  default     = 2
}

variable "app_node_max_count" {
  description = "Maximum number of application nodes"
  type        = number
  default     = 10
}

variable "app_node_vm_size" {
  description = "VM size for application nodes"
  type        = string
  default     = "Standard_D4s_v3"
}

variable "create_acr" {
  description = "Create Azure Container Registry"
  type        = bool
  default     = true
}

variable "acr_sku" {
  description = "ACR SKU (Basic, Standard, Premium)"
  type        = string
  default     = "Standard"
}

variable "acr_public_access" {
  description = "Allow public access to ACR"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Log Analytics retention in days"
  type        = number
  default     = 7
}

variable "enable_azure_policy" {
  description = "Enable Azure Policy for AKS"
  type        = bool
  default     = true
}

variable "enable_azure_ad_rbac" {
  description = "Enable Azure AD RBAC"
  type        = bool
  default     = false
}

variable "aks_admin_group_object_ids" {
  description = "Azure AD group object IDs for AKS admin"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}

# Outputs
output "cluster_name" {
  description = "AKS cluster name"
  value       = azurerm_kubernetes_cluster.tundra_dome.name
}

output "cluster_id" {
  description = "AKS cluster ID"
  value       = azurerm_kubernetes_cluster.tundra_dome.id
}

output "kube_config" {
  description = "Kubernetes config"
  value       = azurerm_kubernetes_cluster.tundra_dome.kube_config_raw
  sensitive   = true
}

output "cluster_fqdn" {
  description = "AKS cluster FQDN"
  value       = azurerm_kubernetes_cluster.tundra_dome.fqdn
}

output "node_resource_group" {
  description = "Auto-created resource group for AKS nodes"
  value       = azurerm_kubernetes_cluster.tundra_dome.node_resource_group
}

output "acr_login_server" {
  description = "ACR login server URL"
  value       = var.create_acr ? azurerm_container_registry.main[0].login_server : null
}
