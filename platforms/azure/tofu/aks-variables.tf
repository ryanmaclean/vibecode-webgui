# Project Configuration
variable "project_name" {
  type        = string
  description = "Name of the project"
  default     = "vibecode"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Azure Configuration
variable "location" {
  type        = string
  description = "Azure region for all resources"
  default     = "East US 2"
}

variable "resource_group_name" {
  type        = string
  description = "Name of the Azure Resource Group"
  default     = "rg-vibecode-aks"
}

# Networking Configuration
variable "vnet_address_space" {
  type        = string
  description = "Address space for the virtual network"
  default     = "10.1.0.0/16"
}

variable "aks_subnet_address_prefix" {
  type        = string
  description = "Address prefix for AKS subnet"
  default     = "10.1.1.0/24"
}

variable "postgres_subnet_address_prefix" {
  type        = string
  description = "Address prefix for PostgreSQL subnet"
  default     = "10.1.2.0/24"
}

# AKS Configuration
variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version for the AKS cluster"
  default     = "1.30.14"
}

variable "aks_admin_group_object_ids" {
  type        = list(string)
  description = "Azure AD group object IDs for AKS administrators"
  default     = []
}

# System Node Pool Configuration
variable "system_node_count" {
  type        = number
  description = "Initial number of nodes in the system node pool"
  default     = 2

  validation {
    condition     = var.system_node_count >= 1 && var.system_node_count <= 10
    error_message = "System node count must be between 1 and 10."
  }
}

variable "system_node_min_count" {
  type        = number
  description = "Minimum number of nodes in the system node pool"
  default     = 1
}

variable "system_node_max_count" {
  type        = number
  description = "Maximum number of nodes in the system node pool"
  default     = 5
}

variable "system_node_vm_size" {
  type        = string
  description = "VM size for system node pool"
  default     = "Standard_D2s_v3"

  validation {
    condition = contains([
      "Standard_D2s_v3", "Standard_D4s_v3", "Standard_D8s_v3",
      "Standard_DS2_v2", "Standard_DS3_v2", "Standard_DS4_v2"
    ], var.system_node_vm_size)
    error_message = "System node VM size must be a supported Azure VM size."
  }
}

# User Node Pool Configuration
variable "user_node_count" {
  type        = number
  description = "Initial number of nodes in the user node pool"
  default     = 2

  validation {
    condition     = var.user_node_count >= 1 && var.user_node_count <= 20
    error_message = "User node count must be between 1 and 20."
  }
}

variable "user_node_min_count" {
  type        = number
  description = "Minimum number of nodes in the user node pool"
  default     = 1
}

variable "user_node_max_count" {
  type        = number
  description = "Maximum number of nodes in the user node pool"
  default     = 10
}

variable "user_node_vm_size" {
  type        = string
  description = "VM size for user node pool"
  default     = "Standard_D4s_v3"

  validation {
    condition = contains([
      "Standard_D2s_v3", "Standard_D4s_v3", "Standard_D8s_v3", "Standard_D16s_v3",
      "Standard_DS2_v2", "Standard_DS3_v2", "Standard_DS4_v2", "Standard_DS5_v2"
    ], var.user_node_vm_size)
    error_message = "User node VM size must be a supported Azure VM size."
  }
}

# Monitoring Configuration
variable "log_retention_days" {
  type        = number
  description = "Number of days to retain logs in Log Analytics workspace"
  default     = 30

  validation {
    condition     = var.log_retention_days >= 30 && var.log_retention_days <= 730
    error_message = "Log retention must be between 30 and 730 days."
  }
}

# Datadog Configuration
variable "datadog_api_key" {
  type        = string
  description = "Datadog API key"
  sensitive   = true
}

variable "datadog_app_key" {
  type        = string
  description = "Datadog application key"
  sensitive   = true
}

variable "dbm_sp_client_id" {
  type        = string
  description = "Azure AD client ID used by External Secrets to read Datadog DBM credentials."
}

variable "dbm_sp_client_secret" {
  type        = string
  description = "Azure AD client secret used by External Secrets to read Datadog DBM credentials."
  sensitive   = true
}

variable "dbm_sp_tenant_id" {
  type        = string
  description = "Azure AD tenant ID for the Datadog DBM service principal."
}

variable "dbm_key_vault_url" {
  type        = string
  description = "Azure Key Vault URL containing Datadog DBM secrets (e.g. https://vibecode-prod-kv.vault.azure.net/)."
}

variable "datadog_api_url" {
  type        = string
  description = "Datadog API URL"
  default     = "https://api.datadoghq.com/"
}

variable "app_url" {
  type        = string
  description = "The URL of the VibeCode application for monitoring"
  default     = "https://vibecode.io"
}

# PostgreSQL Configuration (for in-cluster deployment)
variable "postgres_storage_size_gb" {
  type        = number
  description = "Storage size for PostgreSQL in GB"
  default     = 20

  validation {
    condition     = var.postgres_storage_size_gb >= 20 && var.postgres_storage_size_gb <= 1024
    error_message = "PostgreSQL storage size must be between 20GB and 1024GB."
  }
}

variable "postgres_backup_retention_days" {
  type        = number
  description = "Number of days to retain PostgreSQL backups"
  default     = 7

  validation {
    condition     = var.postgres_backup_retention_days >= 7 && var.postgres_backup_retention_days <= 35
    error_message = "PostgreSQL backup retention must be between 7 and 35 days."
  }
}

# Security Configuration
variable "enable_private_cluster" {
  type        = bool
  description = "Enable private AKS cluster"
  default     = false
}

variable "enable_azure_policy" {
  type        = bool
  description = "Enable Azure Policy for AKS"
  default     = true
}

variable "enable_pod_security_policy" {
  type        = bool
  description = "Enable Pod Security Policy"
  default     = true
}

# Resource Tags
variable "tags" {
  type        = map(string)
  description = "Additional tags to apply to all resources"
  default = {
    Project    = "VibeCode"
    Owner      = "Platform Team"
    CostCenter = "Engineering"
  }
}

# Deployment Configuration
variable "deployment_timeout" {
  type        = string
  description = "Timeout for deployment operations"
  default     = "30m"
}

variable "enable_rollback" {
  type        = bool
  description = "Enable automatic rollback on deployment failure"
  default     = true
}

variable "rollback_timeout" {
  type        = string
  description = "Timeout for rollback operations"
  default     = "15m"
}

# Application Configuration
variable "postgresql_admin_password" {
  type        = string
  description = "PostgreSQL admin password"
  sensitive   = true
}

variable "nextauth_secret" {
  type        = string
  description = "NextAuth.js secret for JWT encryption"
  sensitive   = true
}

variable "datadog_site" {
  type        = string
  description = "Datadog site (e.g., datadoghq.com, datadoghq.eu)"
  default     = "datadoghq.com"
}

variable "llm_observability_enabled" {
  type        = bool
  description = "Enable Datadog LLM Observability for application workloads"
  default     = true
}

variable "llm_observability_agentless" {
  type        = bool
  description = "Send LLM observability telemetry directly to Datadog intake (agentless mode)"
  default     = true
}

variable "llm_observability_ml_app" {
  type        = string
  description = "Identifier used by Datadog to group LLM observability spans"
  default     = "vibecode-ai"
}

variable "app_image_tag" {
  type        = string
  description = "Docker image tag for the VibeCode application"
  default     = "latest"
}

variable "openrouter_api_key" {
  type        = string
  description = "OpenRouter API key for AI services"
  sensitive   = true
  default     = ""
}

variable "azure_openai_api_key" {
  type        = string
  description = "Azure OpenAI API key"
  sensitive   = true
  default     = ""
}

variable "azure_openai_endpoint" {
  type        = string
  description = "Azure OpenAI endpoint URL"
  default     = ""
}

variable "ingress_hostname" {
  type        = string
  description = "Hostname for the application ingress"
  default     = "vibecode.eastus2.cloudapp.azure.com"
}

# Container Registry Configuration
variable "acr_sku" {
  type        = string
  description = "Azure Container Registry SKU"
  default     = "Premium"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.acr_sku)
    error_message = "ACR SKU must be Basic, Standard, or Premium."
  }
}

# Feature Flags
variable "enable_datadog_monitoring" {
  type        = bool
  description = "Enable Datadog monitoring integration"
  default     = true
}

variable "enable_backup_operator" {
  type        = bool
  description = "Enable PostgreSQL backup operator"
  default     = true
}

variable "enable_cert_manager" {
  type        = bool
  description = "Enable cert-manager for TLS certificate management"
  default     = true
}

variable "enable_ingress_nginx" {
  type        = bool
  description = "Enable NGINX ingress controller"
  default     = true
}
