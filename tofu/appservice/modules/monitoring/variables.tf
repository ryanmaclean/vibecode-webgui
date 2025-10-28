variable "name_prefix" {
  description = "Prefix for monitoring resources"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group hosting monitoring resources"
  type        = string
}

variable "tags" {
  description = "Tags to apply"
  type        = map(string)
}

variable "log_analytics_retention_days" {
  description = "Retention in days for Log Analytics workspace"
  type        = number
  default     = 30
}

variable "app_insights_application_type" {
  description = "Application Insights application type"
  type        = string
  default     = "web"
}
