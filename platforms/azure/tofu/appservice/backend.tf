terraform {
  backend "azurerm" {
    resource_group_name  = "rg-vibecode-tofu-state"
    storage_account_name = "vibecodetfstate01"
    container_name       = "opentofu-state"
    key                  = "appservice/terraform.tfstate"
  }
}
