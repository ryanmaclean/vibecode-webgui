variable "project_name" {
  type        = string
  description = "Base name for created resources"
  default     = "vibecode-docs"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
  default     = "demo"
}

variable "location" {
  type        = string
  description = "Azure region"
  default     = "East US 2"
}

variable "tags" {
  type        = map(string)
  description = "Additional tags to apply to resources"
  default = {
    Application = "VibeCode"
  }
}

variable "container_image" {
  type        = string
  description = "Container image for the frontend/API"
}

variable "container_cpu" {
  type        = number
  description = "vCPU for the container"
  default     = 0.5
}

variable "container_memory" {
  type        = string
  description = "Memory allocation (e.g., 1.0Gi)"
  default     = "1.0Gi"
}

variable "container_port" {
  type        = number
  description = "Port exposed by the container"
  default     = 3000
}

variable "http_scale_concurrency" {
  type        = number
  description = "Concurrent request threshold for scaling"
  default     = 10
}

variable "azure_openai_endpoint" {
  type        = string
  description = "Azure OpenAI endpoint"
  default     = ""
}

variable "azure_openai_api_key" {
  type        = string
  description = "Azure OpenAI API key"
  default     = ""
  sensitive   = true
}

variable "azure_openai_sku_name" {
  type        = string
  description = "Azure OpenAI SKU"
  default     = "S0"
}

variable "azure_openai_restore_soft_deleted" {
  type        = bool
  description = "Set to true to restore a soft-deleted Azure OpenAI account"
  default     = false
}

variable "postgresql_sku_name" {
  type        = string
  description = "Flexible server SKU"
  default     = "B_Standard_B1ms"
}

variable "postgresql_storage_mb" {
  type        = number
  description = "Storage size in MB"
  default     = 32768
}

variable "postgresql_backup_retention_days" {
  type        = number
  description = "Backup retention in days"
  default     = 7
}

variable "postgresql_geo_redundant_backup_enabled" {
  type    = bool
  default = false
}

variable "postgresql_zone" {
  type        = string
  description = "Availability zone"
  default     = "1"
}

variable "postgresql_admin_username" {
  type        = string
  description = "Admin username"
  default     = "vibecode"
}

variable "database_name" {
  type        = string
  description = "Database name"
  default     = "vibecode_docs"
}
