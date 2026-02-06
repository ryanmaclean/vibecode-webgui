# Variables for Vercel-style Doc Search deployment on AKS with OpenTofu
# Based on: https://vercel.com/templates/next.js/nextjs-openai-doc-search-starter

# Project Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "vibecode-docs"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "azure_region" {
  description = "Azure region for resources"
  type        = string
  default     = "East US 2"
}

# AKS Configuration
variable "aks_kubernetes_version" {
  description = "Kubernetes version for AKS cluster"
  type        = string
  default     = "1.28"
}

variable "aks_system_node_vm_size" {
  description = "VM size for AKS system node pool"
  type        = string
  default     = "Standard_D4s_v3"
}

variable "aks_system_node_count" {
  description = "Number of nodes in system node pool"
  type        = number
  default     = 2
}

variable "aks_user_node_vm_size" {
  description = "VM size for AKS user node pool"
  type        = string
  default     = "Standard_D8s_v3"
}

variable "aks_user_node_count" {
  description = "Initial number of nodes in user node pool"
  type        = number
  default     = 3
}

variable "aks_user_node_min_count" {
  description = "Minimum number of nodes in user node pool"
  type        = number
  default     = 1
}

variable "aks_user_node_max_count" {
  description = "Maximum number of nodes in user node pool"
  type        = number
  default     = 10
}

# PostgreSQL Configuration (Supabase alternative)
variable "postgresql_sku_name" {
  description = "SKU name for PostgreSQL Flexible Server"
  type        = string
  default     = "GP_Standard_D4s_v3"
}

variable "postgresql_storage_mb" {
  description = "Storage size in MB for PostgreSQL"
  type        = number
  default     = 65536 # 64GB
}

variable "postgresql_high_availability_enabled" {
  description = "Enable high availability for PostgreSQL flexible server"
  type        = bool
  default     = false
}

variable "postgresql_high_availability_mode" {
  description = "High availability mode for PostgreSQL flexible server"
  type        = string
  default     = "ZoneRedundant"

  validation {
    condition     = contains(["ZoneRedundant", "SameZone"], var.postgresql_high_availability_mode)
    error_message = "High availability mode must be either ZoneRedundant or SameZone."
  }
}

variable "postgresql_backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 35
}

variable "postgresql_geo_redundant_backup_enabled" {
  description = "Enable geo-redundant backups"
  type        = bool
  default     = true
}

variable "postgresql_admin_username" {
  description = "Administrator username for PostgreSQL"
  type        = string
  default     = "vibecodeusr"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{2,62}$", var.postgresql_admin_username))
    error_message = "PostgreSQL admin username must start with a letter and be 3-63 characters long."
  }
}

variable "database_name" {
  description = "Name of the application database"
  type        = string
  default     = "vibecode_docs"
}

# Azure OpenAI Configuration
variable "azure_openai_sku_name" {
  description = "SKU name for Azure OpenAI service"
  type        = string
  default     = "S0"
}

# Application Configuration
variable "nextjs_image_tag" {
  description = "Docker image tag for Next.js application"
  type        = string
  default     = "latest"
}

variable "replicas" {
  description = "Number of application replicas"
  type        = number
  default     = 3
}

# Optional: Direct OpenAI API key for fallback
variable "openai_api_key" {
  description = "OpenAI API key (optional, for fallback)"
  type        = string
  default     = ""
  sensitive   = true
}

# Monitoring Configuration
variable "enable_monitoring" {
  description = "Enable monitoring with Azure Monitor"
  type        = bool
  default     = true
}

# Additional tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Datadog unified service tagging variables
variable "service_name" {
  description = "Service name for Datadog unified service tagging"
  type        = string
  default     = "vibecode-docs"
}

variable "team" {
  description = "Team name for resource ownership and Datadog tagging"
  type        = string
  default     = "platform"
}

variable "app_version" {
  description = "Application version for Datadog unified service tagging"
  type        = string
  default     = "1.0.0"
}
