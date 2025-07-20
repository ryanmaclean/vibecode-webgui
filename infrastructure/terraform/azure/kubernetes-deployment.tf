# Kubernetes Deployment Configuration for VibeCode WebGUI
# Deploys the application to AKS with Azure AI Services integration

# Configure Kubernetes provider
provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.main.kube_config.0.host
  client_certificate     = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_certificate)
  client_key             = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_key)
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate)
}

# Configure Helm provider
provider "helm" {
  kubernetes {
    host                   = azurerm_kubernetes_cluster.main.kube_config.0.host
    client_certificate     = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_certificate)
    client_key             = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_key)
    cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate)
  }
}

# Create namespace
resource "kubernetes_namespace" "vibecode" {
  metadata {
    name = "vibecode"
    labels = {
      name        = "vibecode"
      environment = var.environment
      project     = var.project_name
    }
  }
}

# Secret for application configuration
resource "kubernetes_secret" "app_config" {
  metadata {
    name      = "vibecode-config"
    namespace = kubernetes_namespace.vibecode.metadata[0].name
  }

  type = "Opaque"

  data = {
    # Database configuration
    DATABASE_URL = azurerm_key_vault_secret.postgres_connection_string.value
    
    # Azure AI Services configuration
    AZURE_OPENAI_ENDPOINT     = azurerm_cognitive_account.openai.endpoint
    AZURE_OPENAI_API_KEY      = azurerm_cognitive_account.openai.primary_access_key
    AZURE_OPENAI_API_VERSION  = "2024-02-01"
    AZURE_OPENAI_DEPLOYMENT   = "gpt-4-turbo"
    
    # Cognitive Services configuration
    AZURE_COGNITIVE_ENDPOINT  = azurerm_cognitive_account.multi_service.endpoint
    AZURE_COGNITIVE_KEY       = azurerm_cognitive_account.multi_service.primary_access_key
    
    # Computer Vision configuration
    AZURE_VISION_ENDPOINT     = azurerm_cognitive_account.computer_vision.endpoint
    AZURE_VISION_KEY          = azurerm_cognitive_account.computer_vision.primary_access_key
    
    # Language Service configuration
    AZURE_LANGUAGE_ENDPOINT   = azurerm_cognitive_account.language.endpoint
    AZURE_LANGUAGE_KEY        = azurerm_cognitive_account.language.primary_access_key
    
    # NextAuth configuration
    NEXTAUTH_URL              = "https://${var.domain_name}"
    NEXTAUTH_SECRET           = random_password.nextauth_secret.result
    
    # Application configuration
    NODE_ENV                  = "production"
    PORT                      = "3000"
    
    # Monitoring configuration
    DD_API_KEY               = var.datadog_api_key
    DD_APP_KEY               = var.datadog_app_key
    DD_SITE                  = "datadoghq.com"
    DD_SERVICE               = "vibecode-webgui"
    DD_ENV                   = var.environment
    DD_VERSION               = "1.0.0"
    
    # Database monitoring
    DD_DATABASE_MONITORING_ENABLED = "true"
    DATADOG_POSTGRES_USER          = azurerm_key_vault_secret.datadog_postgres_user.value
    DATADOG_POSTGRES_PASSWORD      = azurerm_key_vault_secret.datadog_postgres_password.value
  }
}

# ConfigMap for non-sensitive application configuration
resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "vibecode-app-config"
    namespace = kubernetes_namespace.vibecode.metadata[0].name
  }

  data = {
    # AI Model configurations (public information)
    AZURE_OPENAI_MODELS = jsonencode([
      for deployment in azurerm_cognitive_deployment.openai_models : {
        name           = deployment.name
        deployment_id  = deployment.name
        model_name     = deployment.model[0].name
        model_version  = deployment.model[0].version
        endpoint_url   = "${azurerm_cognitive_account.openai.endpoint}openai/deployments/${deployment.name}"
      }
    ])
    
    # Azure region and resource information
    AZURE_REGION         = var.azure_region
    AZURE_RESOURCE_GROUP = azurerm_resource_group.main.name
    
    # PostgreSQL connection info (non-sensitive)
    POSTGRES_HOST        = azurerm_postgresql_flexible_server.main.fqdn
    POSTGRES_DB          = azurerm_postgresql_flexible_server_database.vibecode.name
    POSTGRES_PORT        = "5432"
    
    # Application features
    ENABLE_AZURE_AI      = "true"
    ENABLE_VECTOR_SEARCH = "true"
    ENABLE_RAG           = "true"
  }
}

# Service Account with workload identity
resource "kubernetes_service_account" "vibecode" {
  metadata {
    name      = "vibecode-sa"
    namespace = kubernetes_namespace.vibecode.metadata[0].name
    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.ai_services.client_id
    }
    labels = {
      "azure.workload.identity/use" = "true"
    }
  }
}

# Federated identity credential for workload identity
resource "azurerm_federated_identity_credential" "vibecode" {
  name                = "vibecode-federated-identity"
  resource_group_name = azurerm_resource_group.main.name
  audience            = ["api://AzureADTokenExchange"]
  issuer              = azurerm_kubernetes_cluster.main.oidc_issuer_url
  parent_id           = azurerm_user_assigned_identity.ai_services.id
  subject             = "system:serviceaccount:${kubernetes_namespace.vibecode.metadata[0].name}:${kubernetes_service_account.vibecode.metadata[0].name}"
}

# Deploy Datadog Agent using Helm
resource "helm_release" "datadog" {
  name       = "datadog"
  repository = "https://helm.datadoghq.com"
  chart      = "datadog"
  version    = "3.47.0"
  namespace  = "datadog"
  
  create_namespace = true

  values = [
    yamlencode({
      datadog = {
        apiKeyExistingSecret = kubernetes_secret.datadog_config.metadata[0].name
        appKeyExistingSecret = kubernetes_secret.datadog_config.metadata[0].name
        site                 = "datadoghq.com"
        clusterName         = azurerm_kubernetes_cluster.main.name
        
        # Enable Database Monitoring
        dbm = {
          enabled = true
        }
        
        # Enable Log Collection
        logs = {
          enabled             = true
          containerCollectAll = true
        }
        
        # Enable APM
        apm = {
          portEnabled = true
        }
        
        # Enable Process Monitoring
        processAgent = {
          enabled = true
        }
        
        # Enable Network Monitoring
        networkMonitoring = {
          enabled = true
        }
        
        # Orchestrator Explorer
        orchestratorExplorer = {
          enabled = true
        }
      }
      
      clusterAgent = {
        enabled = true
        image = {
          tag = "1.24.0"
        }
        metricsProvider = {
          enabled = true
        }
      }
      
      agents = {
        image = {
          tag = "7.66.1"
        }
      }
    })
  ]

  depends_on = [kubernetes_secret.datadog_config]
}

# Datadog configuration secret
resource "kubernetes_secret" "datadog_config" {
  metadata {
    name      = "datadog-secret"
    namespace = "datadog"
  }

  type = "Opaque"

  data = {
    api-key = var.datadog_api_key
    app-key = var.datadog_app_key
  }
}

# Deploy VibeCode application
resource "kubernetes_deployment" "vibecode_app" {
  metadata {
    name      = "vibecode-app"
    namespace = kubernetes_namespace.vibecode.metadata[0].name
    labels = {
      app     = "vibecode"
      version = "1.0.0"
    }
  }

  spec {
    replicas = 3

    selector {
      match_labels = {
        app = "vibecode"
      }
    }

    template {
      metadata {
        labels = {
          app     = "vibecode"
          version = "1.0.0"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "3000"
          "prometheus.io/path"   = "/api/metrics"
        }
      }

      spec {
        service_account_name = kubernetes_service_account.vibecode.metadata[0].name

        container {
          name  = "vibecode"
          image = "${azurerm_container_registry.main.login_server}/vibecode:latest"

          port {
            container_port = 3000
            name          = "http"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app_config.metadata[0].name
            }
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_config.metadata[0].name
            }
          }

          # Resource limits and requests
          resources {
            limits = {
              cpu    = "2000m"
              memory = "4Gi"
            }
            requests = {
              cpu    = "500m"
              memory = "1Gi"
            }
          }

          # Health checks
          liveness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 30
            timeout_seconds       = 10
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          # Security context
          security_context {
            read_only_root_filesystem  = false
            run_as_non_root           = true
            run_as_user               = 1000
            allow_privilege_escalation = false
            capabilities {
              drop = ["ALL"]
            }
          }
        }

        # Pod security context
        security_context {
          fs_group = 1000
        }

        # Node affinity for user workloads
        affinity {
          node_affinity {
            required_during_scheduling_ignored_during_execution {
              node_selector_term {
                match_expressions {
                  key      = "workload"
                  operator = "In"
                  values   = ["user"]
                }
              }
            }
          }

          pod_anti_affinity {
            preferred_during_scheduling_ignored_during_execution {
              weight = 100
              pod_affinity_term {
                label_selector {
                  match_expressions {
                    key      = "app"
                    operator = "In"
                    values   = ["vibecode"]
                  }
                }
                topology_key = "kubernetes.io/hostname"
              }
            }
          }
        }
      }
    }
  }
}

# Service for VibeCode application
resource "kubernetes_service" "vibecode_app" {
  metadata {
    name      = "vibecode-service"
    namespace = kubernetes_namespace.vibecode.metadata[0].name
    labels = {
      app = "vibecode"
    }
  }

  spec {
    selector = {
      app = "vibecode"
    }

    port {
      name        = "http"
      port        = 80
      target_port = 3000
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# Horizontal Pod Autoscaler
resource "kubernetes_horizontal_pod_autoscaler_v2" "vibecode_app" {
  metadata {
    name      = "vibecode-hpa"
    namespace = kubernetes_namespace.vibecode.metadata[0].name
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.vibecode_app.metadata[0].name
    }

    min_replicas = 3
    max_replicas = 20

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }

    metric {
      type = "Resource"
      resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = 80
        }
      }
    }
  }
}

# Outputs
output "kubernetes_namespace" {
  description = "Kubernetes namespace for VibeCode"
  value       = kubernetes_namespace.vibecode.metadata[0].name
}

output "service_account_name" {
  description = "Service account name for workload identity"
  value       = kubernetes_service_account.vibecode.metadata[0].name
}

output "application_url" {
  description = "Internal application URL"
  value       = "http://${kubernetes_service.vibecode_app.metadata[0].name}.${kubernetes_namespace.vibecode.metadata[0].name}.svc.cluster.local"
} 