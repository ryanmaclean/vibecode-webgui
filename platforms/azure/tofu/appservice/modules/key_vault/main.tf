locals {
  prefix_chars      = regexall("[a-z0-9-]", lower(var.name_prefix))
  normalized_prefix = length(local.prefix_chars) > 0 ? join("", local.prefix_chars) : "vibecode"
  base_name         = substr(replace(local.normalized_prefix, "-", ""), 0, 20)
}

resource "random_string" "suffix" {
  length  = 6
  upper   = false
  numeric = true
  special = false
}

resource "azurerm_key_vault" "this" {
  name                        = substr("${local.base_name}${random_string.suffix.result}", 0, 24)
  resource_group_name         = var.resource_group_name
  location                    = var.location
  tenant_id                   = var.tenant_id
  sku_name                    = "standard"
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false
  enabled_for_disk_encryption = false
  enable_rbac_authorization   = false

  network_acls {
    bypass         = "AzureServices"
    default_action = "Allow"
  }

  tags = var.tags
}

resource "azurerm_key_vault_access_policy" "custom" {
  for_each = { for policy in var.access_policies : policy.object_id => policy }

  key_vault_id   = azurerm_key_vault.this.id
  tenant_id      = each.value.tenant_id
  object_id      = each.value.object_id
  application_id = try(each.value.application_id, null)

  key_permissions = lookup(each.value, "key_permissions", [
    "Get",
    "List"
  ])

  secret_permissions = lookup(each.value, "secret_permissions", [
    "Get",
    "List",
    "Set",
    "Delete"
  ])

  certificate_permissions = lookup(each.value, "certificate_permissions", [])
  storage_permissions     = lookup(each.value, "storage_permissions", [])
}
