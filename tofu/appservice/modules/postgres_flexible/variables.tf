variable "name_prefix" {
  description = "Prefix for PostgreSQL server naming"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group to host PostgreSQL"
  type        = string
}

variable "administrator_login" {
  description = "PostgreSQL admin username"
  type        = string
}

variable "administrator_password" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
}

variable "sku_name" {
  description = "PostgreSQL SKU name"
  type        = string
}

variable "storage_size_gb" {
  description = "Storage allocation"
  type        = number
}

variable "backup_retention_days" {
  description = "Backup retention period"
  type        = number
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
}

variable "database_name" {
  description = "Primary database name to create"
  type        = string
  default     = "vibecode"
}

variable "delegated_subnet_id" {
  description = "Optional subnet ID for VNet integration"
  type        = string
  default     = ""
}

variable "allowed_public_network" {
  description = "Allow public network access"
  type        = bool
  default     = true
}

variable "allowed_ip_rules" {
  description = "List of public IPv4 addresses to allow"
  type        = list(string)
  default     = []
}
