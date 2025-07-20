variable "datadog_api_key" {
  type        = string
  description = "The API key for Datadog."
  sensitive   = true
}

variable "datadog_app_key" {
  type        = string
  description = "The application key for Datadog."
  sensitive   = true
}

variable "app_url" {
  type        = string
  description = "The URL of the VibeCode application to test."
  default     = "https://vibecode.io" # Replace with your actual application URL
}