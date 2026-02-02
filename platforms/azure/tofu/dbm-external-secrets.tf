# External Secrets configuration for Datadog DBM
# Manages the Azure Key Vault service principal secret and cluster SecretStore.

variable "dbm_sp_client_id" {
  description = "Client ID for the Datadog DBM Azure AD app (vibecode-external-secrets)."
  type        = string
}

variable "dbm_sp_client_secret" {
  description = "Client secret for the Datadog DBM Azure AD app."
  type        = string
  sensitive   = true
}

variable "dbm_sp_tenant_id" {
  description = "Tenant ID for the Datadog DBM Azure AD app."
  type        = string
}

variable "dbm_key_vault_url" {
  description = "Azure Key Vault URL (e.g. https://vibecode-prod-kv.vault.azure.net/)."
  type        = string
}

resource "kubernetes_namespace" "external_secrets" {
  metadata {
    name = "external-secrets"
    labels = {
      "app.kubernetes.io/name"      = "external-secrets"
      "app.kubernetes.io/component" = "secrets-management"
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }
}

resource "kubernetes_secret" "dbm_azure_credentials" {
  metadata {
    name      = "azure-kv-credentials"
    namespace = kubernetes_namespace.external_secrets.metadata[0].name
    labels = {
      "app.kubernetes.io/name"      = "dbm-azure-kv-credentials"
      "app.kubernetes.io/component" = "monitoring"
    }
  }

  data = {
    "client-id"     = var.dbm_sp_client_id
    "client-secret" = var.dbm_sp_client_secret
    "tenant-id"     = var.dbm_sp_tenant_id
  }

  type = "Opaque"
}

resource "kubernetes_manifest" "dbm_cluster_secret_store" {
  manifest = {
    apiVersion = "external-secrets.io/v1"
    kind       = "ClusterSecretStore"
    metadata = {
      name = "vibecode-cluster-secret-store"
      labels = {
        "app.kubernetes.io/name"      = "vibecode-cluster-secret-store"
        "app.kubernetes.io/component" = "monitoring"
      }
    }
    spec = {
      provider = {
        azurekv = {
          authType = "ServicePrincipal"
          tenantId = var.dbm_sp_tenant_id
          vaultUrl = var.dbm_key_vault_url
          authSecretRef = {
            clientId = {
              name      = kubernetes_secret.dbm_azure_credentials.metadata[0].name
              key       = "client-id"
              namespace = kubernetes_namespace.external_secrets.metadata[0].name
            }
            clientSecret = {
              name      = kubernetes_secret.dbm_azure_credentials.metadata[0].name
              key       = "client-secret"
              namespace = kubernetes_namespace.external_secrets.metadata[0].name
            }
            tenantId = {
              name      = kubernetes_secret.dbm_azure_credentials.metadata[0].name
              key       = "tenant-id"
              namespace = kubernetes_namespace.external_secrets.metadata[0].name
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_secret.dbm_azure_credentials]
}
