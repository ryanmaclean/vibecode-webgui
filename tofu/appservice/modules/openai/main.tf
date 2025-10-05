locals {
  prefix_chars         = regexall("[a-z0-9-]", lower(var.name_prefix))
  normalized_prefix    = length(local.prefix_chars) > 0 ? join("", local.prefix_chars) : "vibecode"
  resource_name        = substr(replace(local.normalized_prefix, "-", ""), 0, 15)
  chat_deployment      = substr("${local.normalized_prefix}-chat", 0, 64)
  embedding_deployment = substr("${local.normalized_prefix}-embed", 0, 64)
}

resource "random_string" "suffix" {
  length  = 4
  upper   = false
  numeric = true
  special = false
}

resource "azurerm_cognitive_account" "openai" {
  name                = "${local.resource_name}${random_string.suffix.result}"
  location            = var.location
  resource_group_name = var.resource_group_name
  kind                = "OpenAI"
  sku_name            = var.deployment_sku

  tags = var.tags
}

resource "azurerm_cognitive_deployment" "chat" {
  name                 = local.chat_deployment
  cognitive_account_id = azurerm_cognitive_account.openai.id
  model {
    format  = "OpenAI"
    name    = var.chat_model
    version = var.chat_model_version
  }
  scale {
    type     = "Manual"
    capacity = 1
  }
}

resource "azurerm_cognitive_deployment" "embedding" {
  name                 = local.embedding_deployment
  cognitive_account_id = azurerm_cognitive_account.openai.id
  model {
    format  = "OpenAI"
    name    = var.embedding_model
    version = var.embedding_model_version
  }
  scale {
    type     = "Manual"
    capacity = 1
  }
}
