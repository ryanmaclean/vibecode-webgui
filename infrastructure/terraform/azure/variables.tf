# Variables for Azure VibeCode Infrastructure

# Project Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "vibecode"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "azure_region" {
  description = "Azure region for all resources"
  type        = string
  default     = "East US 2"
}

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
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
  description = "Number of nodes in AKS system node pool"
  type        = number
  default     = 2
}

variable "aks_user_node_vm_size" {
  description = "VM size for AKS user node pool"
  type        = string
  default     = "Standard_D8s_v3"
}

variable "aks_user_node_count" {
  description = "Initial number of nodes in AKS user node pool"
  type        = number
  default     = 3
}

variable "aks_user_node_min_count" {
  description = "Minimum number of nodes in AKS user node pool"
  type        = number
  default     = 1
}

variable "aks_user_node_max_count" {
  description = "Maximum number of nodes in AKS user node pool"
  type        = number
  default     = 10
}

# PostgreSQL Configuration
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

variable "postgresql_backup_retention_days" {
  description = "Backup retention period in days for PostgreSQL"
  type        = number
  default     = 35
}

variable "postgresql_geo_redundant_backup_enabled" {
  description = "Enable geo-redundant backup for PostgreSQL"
  type        = bool
  default     = true
}

variable "postgresql_high_availability_enabled" {
  description = "Enable high availability for PostgreSQL"
  type        = bool
  default     = true
}

variable "postgresql_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "16"
}

variable "postgresql_admin_username" {
  description = "Administrator username for PostgreSQL"
  type        = string
  default     = "vibecodeusr"
}

# Azure AI Services Configuration
variable "azure_openai_sku_name" {
  description = "SKU name for Azure OpenAI service"
  type        = string
  default     = "S0"
}

variable "azure_openai_deployments" {
  description = "List of Azure OpenAI model deployments"
  type = list(object({
    name          = string
    model_name    = string
    model_version = string
    scale_type    = string
    capacity      = optional(number)
  }))
  default = [
    {
      name          = "gpt-4-turbo"
      model_name    = "gpt-4"
      model_version = "turbo-2024-04-09"
      scale_type    = "Standard"
      capacity      = 30
    },
    {
      name          = "gpt-35-turbo"
      model_name    = "gpt-35-turbo"
      model_version = "0613"
      scale_type    = "Standard"
      capacity      = 120
    },
    {
      name          = "text-embedding-ada-002"
      model_name    = "text-embedding-ada-002"
      model_version = "2"
      scale_type    = "Standard"
      capacity      = 120
    }
  ]
}

variable "cognitive_services_sku" {
  description = "SKU for Azure Cognitive Services"
  type        = string
  default     = "S0"
}

# Monitoring Configuration
variable "log_analytics_retention_days" {
  description = "Retention period in days for Log Analytics"
  type        = number
  default     = 30
}

variable "datadog_api_key" {
  description = "Datadog API key for monitoring"
  type        = string
  sensitive   = true
}

variable "datadog_app_key" {
  description = "Datadog application key for monitoring"
  type        = string
  sensitive   = true
}

# Application Configuration
variable "openai_api_key" {
  description = "OpenAI API key (fallback for non-Azure models)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_client_id" {
  description = "GitHub OAuth client ID"
  type        = string
  default     = ""
}

variable "github_client_secret" {
  description = "GitHub OAuth client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
  default     = ""
}

# Container Registry Configuration
variable "acr_sku" {
  description = "SKU for Azure Container Registry"
  type        = string
  default     = "Premium"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.acr_sku)
    error_message = "ACR SKU must be one of: Basic, Standard, Premium."
  }
}

variable "acr_admin_enabled" {
  description = "Enable admin user for Azure Container Registry"
  type        = bool
  default     = false
}

# Security Configuration
variable "enable_network_policy" {
  description = "Enable network policy for AKS cluster"
  type        = bool
  default     = true
}

variable "enable_private_cluster" {
  description = "Enable private cluster for AKS"
  type        = bool
  default     = false
}

variable "authorized_ip_ranges" {
  description = "Authorized IP ranges for AKS API server access"
  type        = list(string)
  default     = []
}

# DNS Configuration
variable "dns_zone_name" {
  description = "DNS zone name for the application"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

# Backup Configuration
variable "enable_backup" {
  description = "Enable backup for critical resources"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
}

# Redis/Valkey Configuration Variables
variable "redis_deployment_type" {
  description = "Type of Redis/KV deployment: azure_cache_redis, azure_managed_redis, valkey, or all"
  type        = string
  default     = "azure_cache_redis"
  validation {
    condition = contains([
      "azure_cache_redis", 
      "azure_managed_redis", 
      "valkey", 
      "all"
    ], var.redis_deployment_type)
    error_message = "redis_deployment_type must be one of: azure_cache_redis, azure_managed_redis, valkey, or all"
  }
}

variable "azure_cache_redis_config" {
  description = "Configuration for Azure Cache for Redis"
  type = object({
    sku_name               = optional(string, "Premium")
    family                 = optional(string, "P")
    capacity              = optional(number, 1)
    enable_non_ssl_port   = optional(bool, false)
    minimum_tls_version   = optional(string, "1.2")
    redis_version         = optional(string, "6")
    zones                 = optional(list(string), ["1", "2", "3"])
    redis_configuration = optional(object({
      enable_authentication         = optional(bool, true)
      maxmemory_reserved           = optional(number, 50)
      maxmemory_delta              = optional(number, 50)
      maxmemory_policy             = optional(string, "allkeys-lru")
      rdb_backup_enabled           = optional(bool, true)
      rdb_backup_frequency         = optional(number, 60)
      rdb_backup_max_snapshot_count = optional(number, 5)
    }), {})
  })
  default = {}
}

variable "azure_managed_redis_config" {
  description = "Configuration for Azure Managed Redis"
  type = object({
    sku_name              = optional(string, "Balanced")
    capacity_gb           = optional(number, 12)
    zones                 = optional(list(string), ["1", "2", "3"])
    high_availability     = optional(bool, true)
    clustering_enabled    = optional(bool, true)
    data_persistence      = optional(bool, true)
    backup_frequency      = optional(string, "Daily")
    modules = optional(list(string), [
      "RediSearch", 
      "RedisJSON", 
      "RedisTimeSeries", 
      "RedisBloom"
    ])
  })
  default = {}
}

variable "valkey_config" {
  description = "Configuration for Valkey deployment on AKS"
  type = object({
    cluster_size          = optional(number, 3)
    replica_count         = optional(number, 1)
    memory_limit          = optional(string, "4Gi")
    cpu_limit             = optional(string, "2")
    storage_size          = optional(string, "10Gi")
    storage_class         = optional(string, "managed-premium")
    enable_persistence    = optional(bool, true)
    enable_monitoring     = optional(bool, true)
    namespace             = optional(string, "valkey")
  })
  default = {}
} 