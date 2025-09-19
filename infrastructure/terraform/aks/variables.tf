# Variables for Azure Kubernetes Service (AKS) Infrastructure

# Basic Configuration
variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "East US"
}

variable "resource_group_name" {
  description = "Name of the Azure resource group"
  type        = string
  default     = "vibecode-rg"
}

variable "cluster_name" {
  description = "Name of the AKS cluster"
  type        = string
  default     = "vibecode-aks"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Application = "VibeCode"
    Owner       = "Platform Team"
  }
}

# Network Configuration
variable "vnet_cidr" {
  description = "CIDR block for the virtual network"
  type        = string
  default     = "10.0.0.0/16"
}

variable "aks_subnet_cidr" {
  description = "CIDR block for AKS nodes subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "pods_subnet_cidr" {
  description = "CIDR block for pods subnet (CNI)"
  type        = string
  default     = "10.0.2.0/23"
}

variable "service_cidr" {
  description = "CIDR block for Kubernetes services"
  type        = string
  default     = "10.1.0.0/16"
}

variable "dns_service_ip" {
  description = "IP address for DNS service within service CIDR"
  type        = string
  default     = "10.1.0.10"
}

# AKS Cluster Configuration
variable "kubernetes_version" {
  description = "Kubernetes version for the AKS cluster"
  type        = string
  default     = "1.28"
}

variable "private_cluster_enabled" {
  description = "Enable private AKS cluster"
  type        = bool
  default     = false
}

variable "automatic_channel_upgrade" {
  description = "Automatic upgrade channel for AKS cluster"
  type        = string
  default     = "stable"
  validation {
    condition     = contains(["rapid", "node-image", "stable", "patch", "none"], var.automatic_channel_upgrade)
    error_message = "Automatic channel upgrade must be one of: rapid, node-image, stable, patch, none."
  }
}

variable "enable_http_application_routing" {
  description = "Enable HTTP application routing (not recommended for production)"
  type        = bool
  default     = false
}

variable "availability_zones" {
  description = "List of availability zones for node pools"
  type        = list(string)
  default     = ["1", "2", "3"]
}

# System Node Pool Configuration
variable "system_node_count" {
  description = "Initial number of nodes in the system node pool"
  type        = number
  default     = 3
}

variable "system_node_min_count" {
  description = "Minimum number of nodes in the system node pool"
  type        = number
  default     = 3
}

variable "system_node_max_count" {
  description = "Maximum number of nodes in the system node pool"
  type        = number
  default     = 6
}

variable "system_node_size" {
  description = "VM size for system node pool"
  type        = string
  default     = "Standard_D4s_v3"
}

# Application Node Pool Configuration
variable "app_node_count" {
  description = "Initial number of nodes in the application node pool"
  type        = number
  default     = 3
}

variable "app_node_min_count" {
  description = "Minimum number of nodes in the application node pool"
  type        = number
  default     = 3
}

variable "app_node_max_count" {
  description = "Maximum number of nodes in the application node pool"
  type        = number
  default     = 10
}

variable "app_node_size" {
  description = "VM size for application node pool"
  type        = string
  default     = "Standard_D4s_v3"
}

# Database Node Pool Configuration
variable "enable_database_node_pool" {
  description = "Enable dedicated database node pool"
  type        = bool
  default     = true
}

variable "db_node_count" {
  description = "Initial number of nodes in the database node pool"
  type        = number
  default     = 2
}

variable "db_node_min_count" {
  description = "Minimum number of nodes in the database node pool"
  type        = number
  default     = 2
}

variable "db_node_max_count" {
  description = "Maximum number of nodes in the database node pool"
  type        = number
  default     = 4
}

variable "db_node_size" {
  description = "VM size for database node pool"
  type        = string
  default     = "Standard_D8s_v3"
}

# Azure Container Registry Configuration
variable "acr_name" {
  description = "Base name for Azure Container Registry (suffix will be added)"
  type        = string
  default     = "vibecodecr"
}

variable "acr_sku" {
  description = "SKU for Azure Container Registry"
  type        = string
  default     = "Premium"
  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.acr_sku)
    error_message = "ACR SKU must be one of: Basic, Standard, Premium."
  }
}

variable "acr_public_access" {
  description = "Enable public access to ACR"
  type        = bool
  default     = false
}

variable "acr_allowed_ips" {
  description = "List of IP ranges allowed to access ACR"
  type        = list(string)
  default     = []
}

variable "acr_geo_replications" {
  description = "List of regions for ACR geo-replication (Premium SKU only)"
  type        = list(string)
  default     = ["West US 2", "West Europe"]
}

# Key Vault Configuration
variable "key_vault_public_access" {
  description = "Enable public access to Key Vault"
  type        = bool
  default     = false
}

variable "key_vault_allowed_ips" {
  description = "List of IP addresses allowed to access Key Vault"
  type        = list(string)
  default     = []
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "Log retention period in days for Log Analytics workspace"
  type        = number
  default     = 30
}

# RBAC Configuration
variable "aks_admin_group_object_ids" {
  description = "List of Azure AD group object IDs for AKS admin access"
  type        = list(string)
  default     = []
}

# Backup Configuration
variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Enable spot instances for cost optimization"
  type        = bool
  default     = false
}

variable "spot_max_price" {
  description = "Maximum price for spot instances (-1 for current on-demand price)"
  type        = number
  default     = -1
}

# Security Configuration
variable "enable_defender" {
  description = "Enable Microsoft Defender for containers"
  type        = bool
  default     = true
}

variable "enable_image_cleaner" {
  description = "Enable image cleaner to remove unused images"
  type        = bool
  default     = true
}

variable "image_cleaner_interval_hours" {
  description = "Interval in hours for image cleaner to run"
  type        = number
  default     = 24
}

# Networking Security
variable "authorized_ip_ranges" {
  description = "List of IP ranges authorized to access the API server"
  type        = list(string)
  default     = []
}

variable "enable_private_cluster_public_fqdn" {
  description = "Enable public FQDN for private cluster"
  type        = bool
  default     = false
}

# Node Configuration
variable "max_pods_per_node" {
  description = "Maximum number of pods per node"
  type        = number
  default     = 30
}

variable "node_os_disk_size_gb" {
  description = "OS disk size in GB for nodes"
  type        = number
  default     = 100
}

variable "node_os_disk_type" {
  description = "OS disk type for nodes"
  type        = string
  default     = "Managed"
  validation {
    condition     = contains(["Ephemeral", "Managed"], var.node_os_disk_type)
    error_message = "Node OS disk type must be either 'Ephemeral' or 'Managed'."
  }
}

# Workload Identity
variable "enable_workload_identity" {
  description = "Enable workload identity for secure access to Azure resources"
  type        = bool
  default     = true
}

variable "enable_oidc_issuer" {
  description = "Enable OIDC issuer for workload identity"
  type        = bool
  default     = true
}

# Storage Configuration
variable "storage_account_tier" {
  description = "Storage account tier for backups"
  type        = string
  default     = "Standard"
  validation {
    condition     = contains(["Standard", "Premium"], var.storage_account_tier)
    error_message = "Storage account tier must be either 'Standard' or 'Premium'."
  }
}

variable "storage_replication_type" {
  description = "Storage replication type for backups"
  type        = string
  default     = "GRS"
  validation {
    condition     = contains(["LRS", "GRS", "RAGRS", "ZRS", "GZRS", "RAGZRS"], var.storage_replication_type)
    error_message = "Storage replication type must be one of: LRS, GRS, RAGRS, ZRS, GZRS, RAGZRS."
  }
}

# Application Gateway (optional)
variable "enable_application_gateway" {
  description = "Enable Application Gateway for ingress"
  type        = bool
  default     = false
}

variable "app_gateway_sku" {
  description = "SKU for Application Gateway"
  type        = string
  default     = "Standard_v2"
}

# DNS Configuration
variable "dns_zone_name" {
  description = "Name of the DNS zone for the application"
  type        = string
  default     = ""
}

variable "dns_zone_resource_group" {
  description = "Resource group containing the DNS zone"
  type        = string
  default     = ""
}
