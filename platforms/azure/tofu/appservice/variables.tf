variable "project_name" {
  description = "Human-readable project name used for resource naming and tagging"
  type        = string
}

variable "environment" {
  description = "Deployment environment identifier (e.g., prod, staging)"
  type        = string
  default     = "prod"
}

variable "owner" {
  description = "Primary contact or team responsible for the deployment"
  type        = string
  default     = "platform"
}

variable "datadog_api_key" {
  description = "Datadog API key used by App Service workloads"
  type        = string
  sensitive   = true
}

variable "datadog_site" {
  description = "Datadog site endpoint"
  type        = string
  default     = "datadoghq.com"
}

variable "datadog_service" {
  description = "Service tag value for Datadog APM"
  type        = string
  default     = "vibecode-webgui"
}

variable "datadog_env" {
  description = "Environment tag for Datadog"
  type        = string
  default     = "production"
}

variable "datadog_version" {
  description = "Application version tag for Datadog"
  type        = string
  default     = "1.0.0"
}

variable "appservice_additional_app_settings" {
  description = "Extra app settings to merge into the App Service configuration"
  type        = map(string)
  default     = {}
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus2"
}

variable "resource_group_name" {
  description = "Existing or desired resource group name"
  type        = string
}

variable "tenant_id" {
  description = "Azure Active Directory tenant ID for Key Vault access policies"
  type        = string
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "app_service_plan_sku" {
  description = "App Service Plan SKU (e.g., F1, B1, S1)"
  type        = string
  default     = "B1"
}

variable "app_runtime_stack" {
  description = "Linux App Service runtime stack identifier (e.g., node|20-lts)"
  type        = string
  default     = "node|20-lts"
}

variable "postgres_admin_login" {
  description = "Administrator login name for PostgreSQL Flexible Server"
  type        = string
  default     = "vibecode_admin"
}

variable "postgres_admin_password" {
  description = "Administrator password for PostgreSQL Flexible Server"
  type        = string
  sensitive   = true
}

variable "postgres_sku_name" {
  description = "PostgreSQL Flexible SKU name (e.g., B_Standard_B1ms)"
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_size_gb" {
  description = "Allocated storage for PostgreSQL Flexible Server in GB"
  type        = number
  default     = 32
}

variable "postgres_backup_retention_days" {
  description = "Backup retention for PostgreSQL Flexible Server"
  type        = number
  default     = 7
}

variable "postgres_database_name" {
  description = "Primary database name"
  type        = string
  default     = "vibecode"
}

variable "postgres_allowed_ip_rules" {
  description = "List of public IPv4 addresses allowed to reach the server"
  type        = list(string)
  default     = []
}

variable "postgres_delegated_subnet_id" {
  description = "Delegated subnet ID for VNet integration"
  type        = string
  default     = ""
}

variable "postgres_public_network_access" {
  description = "Enable public network access"
  type        = bool
  default     = true
}

variable "key_vault_access_policies" {
  description = "Access policies to assign to the Key Vault"
  type = list(
    object({
      tenant_id               = string
      object_id               = string
      application_id          = optional(string)
      key_permissions         = optional(list(string))
      secret_permissions      = optional(list(string))
      certificate_permissions = optional(list(string))
      storage_permissions     = optional(list(string))
    })
  )
  default = []
}
