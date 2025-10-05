locals {
  prefix_chars      = regexall("[a-z0-9]", lower(var.name_prefix))
  normalized_prefix = length(local.prefix_chars) > 0 ? join("", local.prefix_chars) : "vibecode"
  account_base      = substr(local.normalized_prefix, 0, 11)

  container_chars = regexall("[a-z0-9-]", lower(var.name_prefix))
  container_base  = length(local.container_chars) > 0 ? join("", local.container_chars) : "content"
  queue_chars     = local.container_chars
  queue_base      = length(local.queue_chars) > 0 ? join("", local.queue_chars) : "ingest"

  container_name = var.blob_container_name != "" ? lower(var.blob_container_name) : substr("${local.container_base}-uploads", 0, 63)
  queue_name     = var.queue_name != "" ? lower(var.queue_name) : substr("${local.queue_base}-ingest", 0, 63)
}

resource "random_string" "account_suffix" {
  length  = 6
  upper   = false
  special = false
  numeric = true
}

resource "azurerm_storage_account" "this" {
  name                      = substr("${local.account_base}${random_string.account_suffix.result}", 0, 24)
  resource_group_name       = var.resource_group_name
  location                  = var.location
  account_tier              = "Standard"
  account_replication_type  = var.replication_type
  account_kind              = var.account_kind
  min_tls_version           = "TLS1_2"
  enable_https_traffic_only = var.enable_https_traffic_only

  blob_properties {
    versioning_enabled  = true
    change_feed_enabled = true
    delete_retention_policy {
      days = 7
    }
    container_delete_retention_policy {
      days = 7
    }
  }

  queue_properties {
    logging {
      version               = "1.0"
      delete                = true
      read                  = true
      write                 = true
      retention_policy_days = 7
    }
  }

  tags = var.tags
}

resource "azurerm_storage_container" "content" {
  name                  = local.container_name
  storage_account_name  = azurerm_storage_account.this.name
  container_access_type = "private"
}

resource "azurerm_storage_queue" "ingest" {
  name                 = local.queue_name
  storage_account_name = azurerm_storage_account.this.name
}
