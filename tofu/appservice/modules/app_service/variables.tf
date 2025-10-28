variable "name_prefix" {
  description = "Prefix for App Service resources"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group hosting App Service"
  type        = string
}

variable "app_service_plan_sku" {
  description = "SKU for the App Service plan"
  type        = string
}

variable "runtime_stack" {
  description = "Runtime stack identifier"
  type        = string
}

variable "app_settings" {
  description = "Additional application settings to merge"
  type        = map(string)
  default     = {}
}

variable "connection_strings" {
  description = "Optional connection strings for the web app"
  type = list(
    object({
      name  = string
      type  = string
      value = string
    })
  )
  default = []
}

variable "health_check_path" {
  description = "Optional health check path"
  type        = string
  default     = ""
}

variable "always_on" {
  description = "Enable Always On for the web app"
  type        = bool
  default     = true
}

variable "minimum_tls_version" {
  description = "Minimum TLS version"
  type        = string
  default     = "1.2"
}

variable "monitoring_instrumentation_key" {
  description = "App Insights instrumentation key"
  type        = string
  default     = ""
}

variable "storage_account_id" {
  description = "Storage account ID used for mounting or settings"
  type        = string
  default     = ""
}

variable "storage_container_name" {
  description = "Blob container for content"
  type        = string
  default     = ""
}

variable "key_vault_id" {
  description = "Key Vault ID for secret references"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply"
  type        = map(string)
}
