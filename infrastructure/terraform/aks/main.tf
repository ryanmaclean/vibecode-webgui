# Azure Kubernetes Service (AKS) Infrastructure for VibeCode Platform
# Production-ready AKS cluster with monitoring, security, and scalability

terraform {
  required_version = ">= 1.5"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.45"
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

# Configure the Azure Provider
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

# Data sources
data "azurerm_client_config" "current" {}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location

  tags = local.common_tags
}

# Virtual Network for AKS
resource "azurerm_virtual_network" "aks" {
  name                = "${var.cluster_name}-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = [var.vnet_cidr]

  tags = local.common_tags
}

# Subnet for AKS nodes
resource "azurerm_subnet" "aks_nodes" {
  name                 = "${var.cluster_name}-nodes-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.aks.name
  address_prefixes     = [var.aks_subnet_cidr]
}

# Subnet for pods (CNI)
resource "azurerm_subnet" "aks_pods" {
  name                 = "${var.cluster_name}-pods-subnet"
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

# Network Security Group for AKS
resource "azurerm_network_security_group" "aks" {
  name                = "${var.cluster_name}-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  # Allow HTTPS
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

  # Allow HTTP (for health checks)
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

  tags = local.common_tags
}

# Associate NSG with subnet
resource "azurerm_subnet_network_security_group_association" "aks_nodes" {
  subnet_id                 = azurerm_subnet.aks_nodes.id
  network_security_group_id = azurerm_network_security_group.aks.id
}

# Azure Container Registry
resource "azurerm_container_registry" "main" {
  name                = "${var.acr_name}${random_id.suffix.hex}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = var.acr_sku
  admin_enabled       = false

  # Enable geo-replication for Premium SKU
  dynamic "georeplications" {
    for_each = var.acr_sku == "Premium" ? var.acr_geo_replications : []
    content {
      location = georeplications.value
      tags     = local.common_tags
    }
  }

  # Network access rules
  network_rule_set {
    default_action = var.acr_public_access ? "Allow" : "Deny"
    
    dynamic "ip_rule" {
      for_each = var.acr_allowed_ips
      content {
        action   = "Allow"
        ip_range = ip_rule.value
      }
    }
  }

  tags = local.common_tags
}

# Log Analytics Workspace for monitoring
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.cluster_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days

  tags = local.common_tags
}

# Application Insights for APM
resource "azurerm_application_insights" "main" {
  name                = "${var.cluster_name}-insights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"

  tags = local.common_tags
}

# Azure Key Vault for secrets
resource "azurerm_key_vault" "main" {
  name                = "${var.cluster_name}-kv-${random_id.suffix.hex}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "premium"

  # Enable soft delete and purge protection
  soft_delete_retention_days = 7
  purge_protection_enabled   = true

  # Network access rules
  network_acls {
    default_action = var.key_vault_public_access ? "Allow" : "Deny"
    bypass         = "AzureServices"
    
    dynamic "ip_rules" {
      for_each = var.key_vault_allowed_ips
      content {
        value = ip_rules.value
      }
    }
    
    virtual_network_subnet_ids = [
      azurerm_subnet.aks_nodes.id,
      azurerm_subnet.aks_pods.id
    ]
  }

  tags = local.common_tags
}

# Key Vault access policy for current user/service principal
resource "azurerm_key_vault_access_policy" "current_user" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  key_permissions = [
    "Get", "List", "Create", "Delete", "Update", "Recover", "Backup", "Restore"
  ]

  secret_permissions = [
    "Get", "List", "Set", "Delete", "Recover", "Backup", "Restore"
  ]

  certificate_permissions = [
    "Get", "List", "Create", "Delete", "Update", "ManageContacts", "ManageIssuers"
  ]
}

# Managed Identity for AKS
resource "azurerm_user_assigned_identity" "aks" {
  name                = "${var.cluster_name}-identity"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  tags = local.common_tags
}

# Role assignment for ACR pull
resource "azurerm_role_assignment" "aks_acr_pull" {
  principal_id         = azurerm_user_assigned_identity.aks.principal_id
  role_definition_name = "AcrPull"
  scope                = azurerm_container_registry.main.id
}

# Role assignment for network contributor
resource "azurerm_role_assignment" "aks_network" {
  principal_id         = azurerm_user_assigned_identity.aks.principal_id
  role_definition_name = "Network Contributor"
  scope                = azurerm_virtual_network.aks.id
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "main" {
  name                = var.cluster_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "${var.cluster_name}-dns"
  kubernetes_version  = var.kubernetes_version

  # Enable private cluster if specified
  private_cluster_enabled = var.private_cluster_enabled
  
  # Network configuration
  network_profile {
    network_plugin      = "azure"
    network_policy      = "azure"
    dns_service_ip      = var.dns_service_ip
    service_cidr        = var.service_cidr
    load_balancer_sku   = "standard"
    outbound_type       = "loadBalancer"
  }

  # Default system node pool
  default_node_pool {
    name                = "system"
    node_count          = var.system_node_count
    vm_size            = var.system_node_size
    type               = "VirtualMachineScaleSets"
    availability_zones = var.availability_zones
    
    # Enable autoscaling
    enable_auto_scaling = true
    min_count          = var.system_node_min_count
    max_count          = var.system_node_max_count
    
    # Network configuration
    vnet_subnet_id     = azurerm_subnet.aks_nodes.id
    pod_subnet_id      = azurerm_subnet.aks_pods.id
    
    # Node configuration
    os_disk_size_gb    = 100
    os_disk_type       = "Managed"
    max_pods           = 30
    
    # Taints for system workloads only
    node_taints = ["CriticalAddonsOnly=true:NoSchedule"]
    
    tags = merge(local.common_tags, {
      "nodepool-type" = "system"
    })
  }

  # Identity configuration
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aks.id]
  }

  # Enable monitoring
  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  }

  # Enable Azure Policy
  azure_policy_enabled = true

  # Enable HTTP application routing (for development)
  http_application_routing_enabled = var.enable_http_application_routing

  # Enable role-based access control
  role_based_access_control_enabled = true

  azure_active_directory_role_based_access_control {
    managed                = true
    admin_group_object_ids = var.aks_admin_group_object_ids
    azure_rbac_enabled     = true
  }

  # Auto-upgrade configuration
  automatic_channel_upgrade = var.automatic_channel_upgrade

  # Maintenance window
  maintenance_window {
    allowed {
      day   = "Sunday"
      hours = [2, 3, 4]
    }
  }

  # Key Vault secrets provider
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "2m"
  }

  tags = local.common_tags
}

# Application node pool for workloads
resource "azurerm_kubernetes_cluster_node_pool" "application" {
  name                  = "application"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size              = var.app_node_size
  node_count           = var.app_node_count
  availability_zones   = var.availability_zones

  # Enable autoscaling
  enable_auto_scaling = true
  min_count          = var.app_node_min_count
  max_count          = var.app_node_max_count

  # Network configuration
  vnet_subnet_id = azurerm_subnet.aks_nodes.id
  pod_subnet_id  = azurerm_subnet.aks_pods.id

  # Node configuration
  os_disk_size_gb = 100
  os_disk_type    = "Managed"
  max_pods        = 30

  # Node labels
  node_labels = {
    "nodepool-type" = "application"
    "workload-type" = "general"
  }

  tags = merge(local.common_tags, {
    "nodepool-type" = "application"
  })
}

# Database node pool (optional, for dedicated database workloads)
resource "azurerm_kubernetes_cluster_node_pool" "database" {
  count                 = var.enable_database_node_pool ? 1 : 0
  name                  = "database"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size              = var.db_node_size
  node_count           = var.db_node_count
  availability_zones   = var.availability_zones

  # Enable autoscaling
  enable_auto_scaling = true
  min_count          = var.db_node_min_count
  max_count          = var.db_node_max_count

  # Network configuration
  vnet_subnet_id = azurerm_subnet.aks_nodes.id
  pod_subnet_id  = azurerm_subnet.aks_pods.id

  # Node configuration
  os_disk_size_gb = 200
  os_disk_type    = "Premium_LRS"
  max_pods        = 15

  # Node labels and taints for database workloads
  node_labels = {
    "nodepool-type" = "database"
    "workload-type" = "database"
  }

  node_taints = ["database=true:NoSchedule"]

  tags = merge(local.common_tags, {
    "nodepool-type" = "database"
  })
}

# Storage classes
resource "azurerm_kubernetes_cluster" "storage_classes" {
  depends_on = [azurerm_kubernetes_cluster.main]
  
  # This is a dummy resource to ensure storage classes are created after cluster
  # The actual storage classes are created via the bootstrap script
}

# Backup storage account
resource "azurerm_storage_account" "backup" {
  name                     = "${var.cluster_name}backup${random_id.suffix.hex}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
  
  # Enable blob versioning and soft delete
  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 30
    }
    container_delete_retention_policy {
      days = 30
    }
  }

  tags = local.common_tags
}

# Backup container
resource "azurerm_storage_container" "backup" {
  name                  = "backups"
  storage_account_name  = azurerm_storage_account.backup.name
  container_access_type = "private"
}

# Local values
locals {
  common_tags = merge(var.tags, {
    Environment = var.environment
    Project     = "VibeCode"
    ManagedBy   = "Terraform"
    CreatedDate = formatdate("YYYY-MM-DD", timestamp())
  })
}
