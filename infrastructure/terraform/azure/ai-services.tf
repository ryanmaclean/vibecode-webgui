# Azure AI Services Configuration
# Provides OpenAI and Cognitive Services that can be used like OpenRouter

# Azure OpenAI Service
resource "azurerm_cognitive_account" "openai" {
  name                = "${local.name_prefix}-openai"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "OpenAI"
  sku_name            = var.azure_openai_sku_name

  # Network configuration
  network_acls {
    default_action = "Allow"
    
    # Restrict to Azure services and AKS subnet in production
    ip_rules = var.authorized_ip_ranges
    
    virtual_network_rules {
      subnet_id = azurerm_subnet.aks.id
    }
  }

  # Customer managed keys (optional)
  # customer_managed_key {
  #   key_vault_key_id = azurerm_key_vault_key.openai.id
  # }

  tags = local.common_tags
}

# Azure OpenAI Model Deployments
resource "azurerm_cognitive_deployment" "openai_models" {
  for_each = {
    for deployment in var.azure_openai_deployments : deployment.name => deployment
  }

  name                 = each.value.name
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = each.value.model_name
    version = each.value.model_version
  }

  sku {
    name     = each.value.scale_type
    capacity = each.value.capacity
  }

  # Prevent accidental deletion of production models
  lifecycle {
    prevent_destroy = true
  }
}

# Azure Cognitive Services (Multi-Service Account)
resource "azurerm_cognitive_account" "multi_service" {
  name                = "${local.name_prefix}-cognitive-services"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "CognitiveServices"
  sku_name            = var.cognitive_services_sku

  # Network configuration
  network_acls {
    default_action = "Allow"
    
    ip_rules = var.authorized_ip_ranges
    
    virtual_network_rules {
      subnet_id = azurerm_subnet.aks.id
    }
  }

  tags = local.common_tags
}

# Azure Computer Vision (for image analysis in code)
resource "azurerm_cognitive_account" "computer_vision" {
  name                = "${local.name_prefix}-computer-vision"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "ComputerVision"
  sku_name            = var.cognitive_services_sku

  tags = local.common_tags
}

# Azure Language Service (for code analysis and documentation)
resource "azurerm_cognitive_account" "language" {
  name                = "${local.name_prefix}-language"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "TextAnalytics"
  sku_name            = var.cognitive_services_sku

  tags = local.common_tags
}

# Store AI service keys in Key Vault
resource "azurerm_key_vault_secret" "azure_openai_endpoint" {
  name         = "azure-openai-endpoint"
  value        = azurerm_cognitive_account.openai.endpoint
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "azure_openai_key" {
  name         = "azure-openai-key"
  value        = azurerm_cognitive_account.openai.primary_access_key
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "cognitive_services_endpoint" {
  name         = "cognitive-services-endpoint"
  value        = azurerm_cognitive_account.multi_service.endpoint
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "cognitive_services_key" {
  name         = "cognitive-services-key"
  value        = azurerm_cognitive_account.multi_service.primary_access_key
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "computer_vision_endpoint" {
  name         = "computer-vision-endpoint"
  value        = azurerm_cognitive_account.computer_vision.endpoint
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "computer_vision_key" {
  name         = "computer-vision-key"
  value        = azurerm_cognitive_account.computer_vision.primary_access_key
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "language_endpoint" {
  name         = "language-endpoint"
  value        = azurerm_cognitive_account.language.endpoint
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "language_key" {
  name         = "language-key"
  value        = azurerm_cognitive_account.language.primary_access_key
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

# Diagnostic Settings for AI Services
resource "azurerm_monitor_diagnostic_setting" "openai" {
  name                       = "${local.name_prefix}-openai-diagnostics"
  target_resource_id         = azurerm_cognitive_account.openai.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "Audit"
  }

  enabled_log {
    category = "RequestResponse"
  }

  enabled_log {
    category = "Trace"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# User-assigned Managed Identity for AI Services access
resource "azurerm_user_assigned_identity" "ai_services" {
  name                = "${local.name_prefix}-ai-services-identity"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Role assignments for Managed Identity
resource "azurerm_role_assignment" "ai_services_openai" {
  scope                = azurerm_cognitive_account.openai.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_user_assigned_identity.ai_services.principal_id
}

resource "azurerm_role_assignment" "ai_services_cognitive" {
  scope                = azurerm_cognitive_account.multi_service.id
  role_definition_name = "Cognitive Services User"
  principal_id         = azurerm_user_assigned_identity.ai_services.principal_id
}

# Output AI Services information
output "azure_openai_endpoint" {
  description = "Azure OpenAI service endpoint"
  value       = azurerm_cognitive_account.openai.endpoint
  sensitive   = false
}

output "azure_openai_deployed_models" {
  description = "List of deployed Azure OpenAI models"
  value = [
    for deployment in azurerm_cognitive_deployment.openai_models : {
      name         = deployment.name
      model        = deployment.model[0].name
      version      = deployment.model[0].version
      endpoint_url = "${azurerm_cognitive_account.openai.endpoint}openai/deployments/${deployment.name}"
    }
  ]
  sensitive = false
}

output "cognitive_services_endpoint" {
  description = "Azure Cognitive Services endpoint"
  value       = azurerm_cognitive_account.multi_service.endpoint
  sensitive   = false
}

output "ai_services_identity_client_id" {
  description = "Client ID of the managed identity for AI services"
  value       = azurerm_user_assigned_identity.ai_services.client_id
  sensitive   = false
} 