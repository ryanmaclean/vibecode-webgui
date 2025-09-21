variable "name_prefix" {
  description = "Prefix for Function App naming"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group hosting the Function App"
  type        = string
}

variable "storage_account_id" {
  description = "Storage account backing the Function App"
  type        = string
}

variable "storage_queue_name" {
  description = "Queue used for trigger"
  type        = string
  default     = ""
}

variable "monitoring_connection_string" {
  description = "Application Insights connection string"
  type        = string
  default     = ""
}

variable "app_settings" {
  description = "Additional application settings"
  type        = map(string)
  default     = {}
}

variable "functions_version" {
  description = "Azure Functions runtime version"
  type        = string
  default     = "4"
}

variable "tags" {
  description = "Tags to apply"
  type        = map(string)
}
