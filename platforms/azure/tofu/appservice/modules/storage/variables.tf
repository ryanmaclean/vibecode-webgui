variable "name_prefix" {
  description = "Prefix used for storage resources"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group for storage resources"
  type        = string
}

variable "tags" {
  description = "Tags to apply"
  type        = map(string)
}

variable "account_kind" {
  description = "Storage account kind"
  type        = string
  default     = "StorageV2"
}

variable "replication_type" {
  description = "Replication type for the storage account"
  type        = string
  default     = "LRS"
}

variable "enable_https_traffic_only" {
  description = "Force HTTPS traffic only"
  type        = bool
  default     = true
}

variable "blob_container_name" {
  description = "Optional custom blob container name"
  type        = string
  default     = ""
}

variable "queue_name" {
  description = "Optional custom queue name"
  type        = string
  default     = ""
}
