variable "name_prefix" {
  description = "Prefix for Azure OpenAI resources"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group hosting Azure OpenAI resources"
  type        = string
}

variable "tags" {
  description = "Tags to apply"
  type        = map(string)
}

variable "deployment_sku" {
  description = "SKU for Azure OpenAI resource"
  type        = string
  default     = "S0"
}

variable "chat_model" {
  description = "Primary chat deployment model"
  type        = string
  default     = "gpt-4o-mini"
}

variable "chat_model_version" {
  description = "Version for chat deployment"
  type        = string
  default     = "2024-05-13"
}

variable "embedding_model" {
  description = "Embedding deployment model"
  type        = string
  default     = "text-embedding-3-large"
}

variable "embedding_model_version" {
  description = "Version for embedding deployment"
  type        = string
  default     = "2024-04-01"
}
