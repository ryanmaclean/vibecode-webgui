variable "name_prefix" {
  description = "Prefix for Key Vault naming"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group hosting Key Vault"
  type        = string
}

variable "tenant_id" {
  description = "Tenant ID for access policies"
  type        = string
}

variable "tags" {
  description = "Tags to apply"
  type        = map(string)
}

variable "access_policies" {
  description = "List of access policies to apply to the Key Vault"
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
