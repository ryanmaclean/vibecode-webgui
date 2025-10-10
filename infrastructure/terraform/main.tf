# VibeCode WebGUI Infrastructure as Code
# Comprehensive Terraform configuration for production deployment

terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.32"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.21"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Remote state configuration
  backend "kubernetes" {
    secret_suffix    = "state"
    config_path      = "~/.kube/config"
    namespace        = "terraform-state"
  }
}

# Local variables for configuration
locals {
  app_name         = "vibecode-webgui"
  environment      = var.environment
  namespace        = "${local.app_name}-${local.environment}"
  
  # Common labels
  common_labels = {
    app         = local.app_name
    environment = local.environment
    managed-by  = "terraform"
    version     = var.app_version
  }

  # Database configuration
  db_name = "vibecode_${local.environment}"
  
  # Monitoring configuration
  datadog_enabled = var.datadog_api_key != "" && var.datadog_api_key != null
}

# Variables
variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "development"
}

variable "app_version" {
  description = "Application version to deploy"
  type        = string
  default     = "latest"
}

variable "replicas" {
  description = "Number of application replicas"
  type        = number
  default     = 3
}

variable "database_storage_size" {
  description = "Database storage size"
  type        = string
  default     = "20Gi"
}

variable "redis_memory_limit" {
  description = "Redis memory limit"
  type        = string
  default     = "512Mi"
}

# Secrets
variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "nextauth_secret" {
  description = "NextAuth secret key"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "datadog_api_key" {
  description = "Datadog API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "datadog_app_key" {
  description = "Datadog application key"
  type        = string
  sensitive   = true
  default     = ""
}

# Kubernetes provider configuration
provider "kubernetes" {
  config_path = "~/.kube/config"
}

provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
  }
}

# Datadog provider (conditional)
provider "datadog" {
  count   = local.datadog_enabled ? 1 : 0
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
}

# Create namespace
resource "kubernetes_namespace" "app" {
  metadata {
    name = local.namespace
    labels = merge(local.common_labels, {
      name = local.namespace
    })
  }
}

# Generate random passwords for internal services
resource "random_password" "redis_password" {
  length  = 32
  special = true
}

resource "random_password" "litellm_master_key" {
  length  = 64
  special = false
}

# ConfigMap for application configuration
resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "${local.app_name}-config"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = local.common_labels
  }

  data = {
    NODE_ENV                    = local.environment
    NEXT_PUBLIC_APP_URL        = "https://${local.app_name}-${local.environment}.yourdomain.com"
    DATABASE_URL               = "postgresql://vibecode:${var.database_password}@postgres:5432/${local.db_name}"
    REDIS_URL                  = "redis://:${random_password.redis_password.result}@redis:6379"
    LITELLM_BASE_URL          = "http://litellm:4000"
    LITELLM_MASTER_KEY        = random_password.litellm_master_key.result
    DD_ENV                    = local.environment
    DD_SERVICE               = local.app_name
    DD_VERSION               = var.app_version
    DD_LOGS_INJECTION        = "true"
    DD_PROFILING_ENABLED     = "true"
    DD_RUNTIME_METRICS_ENABLED = "true"
  }
}

# Secret for sensitive configuration
resource "kubernetes_secret" "app_secrets" {
  metadata {
    name      = "${local.app_name}-secrets"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    NEXTAUTH_SECRET     = base64encode(var.nextauth_secret)
    DATABASE_PASSWORD   = base64encode(var.database_password)
    REDIS_PASSWORD     = base64encode(random_password.redis_password.result)
    OPENAI_API_KEY     = base64encode(var.openai_api_key)
    ANTHROPIC_API_KEY  = base64encode(var.anthropic_api_key)
    DD_API_KEY         = base64encode(var.datadog_api_key)
    LITELLM_MASTER_KEY = base64encode(random_password.litellm_master_key.result)
  }
}

# PostgreSQL with pgvector
resource "kubernetes_persistent_volume_claim" "postgres_pvc" {
  metadata {
    name      = "postgres-pvc"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = var.database_storage_size
      }
    }
    storage_class_name = "fast-ssd"
  }
}

resource "kubernetes_deployment" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = merge(local.common_labels, { component = "database" })
  }

  spec {
    replicas = 1
    selector {
      match_labels = {
        app       = "postgres"
        component = "database"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          app       = "postgres"
          component = "database"
        })
        annotations = {
          "ad.datadoghq.com/postgres.check_names"  = "[\"postgres\"]"
          "ad.datadoghq.com/postgres.init_configs" = "[{}]"
          "ad.datadoghq.com/postgres.instances"   = "[{\"host\":\"%%host%%\",\"port\":5432,\"username\":\"datadog\",\"password\":\"${var.database_password}\"}]"
          "ad.datadoghq.com/postgres.logs"        = "[{\"source\":\"postgresql\",\"service\":\"postgres\"}]"
        }
      }

      spec {
        container {
          name  = "postgres"
          image = "pgvector/pgvector:pg16"

          env {
            name  = "POSTGRES_DB"
            value = local.db_name
          }
          env {
            name  = "POSTGRES_USER"
            value = "vibecode"
          }
          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "DATABASE_PASSWORD"
              }
            }
          }
          env {
            name  = "POSTGRES_INITDB_ARGS"
            value = "--encoding=UTF-8"
          }

          port {
            container_port = 5432
          }

          volume_mount {
            mount_path = "/var/lib/postgresql/data"
            name       = "postgres-storage"
          }

          volume_mount {
            mount_path = "/docker-entrypoint-initdb.d"
            name       = "init-scripts"
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "1Gi"
            }
            limits = {
              cpu    = "2"
              memory = "4Gi"
            }
          }

          liveness_probe {
            exec {
              command = ["pg_isready", "-U", "vibecode", "-d", local.db_name]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            exec {
              command = ["pg_isready", "-U", "vibecode", "-d", local.db_name]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
          }
        }

        volume {
          name = "postgres-storage"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.postgres_pvc.metadata[0].name
          }
        }

        volume {
          name = "init-scripts"
          config_map {
            name = kubernetes_config_map.postgres_init.metadata[0].name
          }
        }
      }
    }
  }
}

# PostgreSQL initialization scripts
resource "kubernetes_config_map" "postgres_init" {
  metadata {
    name      = "postgres-init-scripts"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = local.common_labels
  }

  data = {
    "00_extensions.sql" = <<-EOF
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE EXTENSION IF NOT EXISTS btree_gin;
      CREATE EXTENSION IF NOT EXISTS btree_gist;
      
      -- Create datadog monitoring user
      CREATE USER datadog WITH PASSWORD '${var.database_password}';
      GRANT SELECT ON pg_stat_database TO datadog;
      GRANT SELECT ON pg_stat_activity TO datadog;
      GRANT SELECT ON pg_stat_statements TO datadog;
    EOF

    "01_performance.sql" = <<-EOF
      -- Performance optimizations
      ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
      ALTER SYSTEM SET track_activity_query_size = 2048;
      ALTER SYSTEM SET pg_stat_statements.track = 'all';
      ALTER SYSTEM SET log_statement = 'all';
      ALTER SYSTEM SET log_duration = 'on';
      ALTER SYSTEM SET log_min_duration_statement = 1000;
      
      -- Vector search optimizations
      ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
      ALTER SYSTEM SET effective_cache_size = '2GB';
      ALTER SYSTEM SET shared_buffers = '512MB';
      ALTER SYSTEM SET work_mem = '16MB';
    EOF
  }
}

# PostgreSQL Service
resource "kubernetes_service" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = merge(local.common_labels, { component = "database" })
  }

  spec {
    selector = {
      app       = "postgres"
      component = "database"
    }

    port {
      port        = 5432
      target_port = 5432
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# Redis Deployment
resource "kubernetes_deployment" "redis" {
  metadata {
    name      = "redis"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = merge(local.common_labels, { component = "cache" })
  }

  spec {
    replicas = 1
    selector {
      match_labels = {
        app       = "redis"
        component = "cache"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          app       = "redis"
          component = "cache"
        })
        annotations = {
          "ad.datadoghq.com/redis.check_names"  = "[\"redisdb\"]"
          "ad.datadoghq.com/redis.init_configs" = "[{}]"
          "ad.datadoghq.com/redis.instances"   = "[{\"host\":\"%%host%%\",\"port\":6379,\"password\":\"${random_password.redis_password.result}\"}]"
          "ad.datadoghq.com/redis.logs"        = "[{\"source\":\"redis\",\"service\":\"redis\"}]"
        }
      }

      spec {
        container {
          name  = "redis"
          image = "redis:7-alpine"
          
          command = [
            "redis-server",
            "--requirepass", random_password.redis_password.result,
            "--appendonly", "yes",
            "--maxmemory", var.redis_memory_limit,
            "--maxmemory-policy", "allkeys-lru"
          ]

          port {
            container_port = 6379
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = var.redis_memory_limit
            }
          }

          liveness_probe {
            exec {
              command = ["redis-cli", "-a", random_password.redis_password.result, "ping"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "-a", random_password.redis_password.result, "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

# Redis Service
resource "kubernetes_service" "redis" {
  metadata {
    name      = "redis"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = merge(local.common_labels, { component = "cache" })
  }

  spec {
    selector = {
      app       = "redis"
      component = "cache"
    }

    port {
      port        = 6379
      target_port = 6379
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# LiteLLM Deployment
resource "kubernetes_deployment" "litellm" {
  metadata {
    name      = "litellm"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = merge(local.common_labels, { component = "ai-gateway" })
  }

  spec {
    replicas = 2
    selector {
      match_labels = {
        app       = "litellm"
        component = "ai-gateway"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          app       = "litellm"
          component = "ai-gateway"
        })
        annotations = {
          "ad.datadoghq.com/litellm.logs" = "[{\"source\":\"litellm\",\"service\":\"ai-gateway\"}]"
        }
      }

      spec {
        container {
          name  = "litellm"
          image = "ghcr.io/berriai/litellm:main-latest"

          env {
            name  = "DATABASE_URL"
            value = "postgresql://vibecode:${var.database_password}@postgres:5432/${local.db_name}"
          }
          env {
            name  = "REDIS_HOST"
            value = "redis"
          }
          env {
            name  = "REDIS_PORT"
            value = "6379"
          }
          env {
            name  = "REDIS_PASSWORD"
            value = random_password.redis_password.result
          }
          env {
            name = "LITELLM_MASTER_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "LITELLM_MASTER_KEY"
              }
            }
          }
          env {
            name = "OPENAI_API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "OPENAI_API_KEY"
              }
            }
          }
          env {
            name = "ANTHROPIC_API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "ANTHROPIC_API_KEY"
              }
            }
          }
          env {
            name  = "STORE_MODEL_IN_DB"
            value = "True"
          }
          env {
            name  = "COST_TRACKING"
            value = "True"
          }
          env {
            name  = "LITELLM_LOG"
            value = "INFO"
          }

          port {
            container_port = 4000
          }

          resources {
            requests = {
              cpu    = "200m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health/liveliness"
              port = 4000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 4000
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

# LiteLLM Service
resource "kubernetes_service" "litellm" {
  metadata {
    name      = "litellm"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = merge(local.common_labels, { component = "ai-gateway" })
  }

  spec {
    selector = {
      app       = "litellm"
      component = "ai-gateway"
    }

    port {
      port        = 4000
      target_port = 4000
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# Main Application Deployment
resource "kubernetes_deployment" "app" {
  metadata {
    name      = local.app_name
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = merge(local.common_labels, { component = "app" })
  }

  spec {
    replicas = var.replicas
    selector {
      match_labels = {
        app       = local.app_name
        component = "app"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          app       = local.app_name
          component = "app"
        })
        annotations = {
          "ad.datadoghq.com/vibecode-webgui.logs" = "[{\"source\":\"nodejs\",\"service\":\"${local.app_name}\"}]"
        }
      }

      spec {
        container {
          name  = local.app_name
          image = "${local.app_name}:${var.app_version}"

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_config.metadata[0].name
            }
          }

          env {
            name = "NEXTAUTH_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "NEXTAUTH_SECRET"
              }
            }
          }
          env {
            name = "OPENAI_API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "OPENAI_API_KEY"
              }
            }
          }
          env {
            name = "ANTHROPIC_API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "ANTHROPIC_API_KEY"
              }
            }
          }
          env {
            name = "DD_API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.app_secrets.metadata[0].name
                key  = "DD_API_KEY"
              }
            }
          }

          port {
            container_port = 3000
          }

          resources {
            requests = {
              cpu    = "200m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/api/health/simple"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }

          startup_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            failure_threshold     = 30
          }
        }

        # Datadog Agent sidecar (if enabled)
        dynamic "container" {
          for_each = local.datadog_enabled ? [1] : []
          content {
            name  = "datadog-agent"
            image = "datadog/docker-dd-agent:latest-alpine"

            env {
              name = "DD_API_KEY"
              value_from {
                secret_key_ref {
                  name = kubernetes_secret.app_secrets.metadata[0].name
                  key  = "DD_API_KEY"
                }
              }
            }
            env {
              name  = "DD_SITE"
              value = "datadoghq.com"
            }
            env {
              name  = "DD_LOGS_ENABLED"
              value = "true"
            }
            env {
              name  = "DD_APM_ENABLED"
              value = "true"
            }
            env {
              name  = "DD_APM_NON_LOCAL_TRAFFIC"
              value = "true"
            }

            port {
              container_port = 8126
            }
            port {
              container_port = 8125
              protocol       = "UDP"
            }

            resources {
              requests = {
                cpu    = "100m"
                memory = "128Mi"
              }
              limits = {
                cpu    = "200m"
                memory = "256Mi"
              }
            }
          }
        }
      }
    }
  }
}

# Application Service
resource "kubernetes_service" "app" {
  metadata {
    name      = local.app_name
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = merge(local.common_labels, { component = "app" })
  }

  spec {
    selector = {
      app       = local.app_name
      component = "app"
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

# Ingress for external access
resource "kubernetes_ingress_v1" "app" {
  metadata {
    name      = local.app_name
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = local.common_labels
    annotations = {
      "kubernetes.io/ingress.class"                 = "nginx"
      "cert-manager.io/cluster-issuer"             = "letsencrypt-prod"
      "nginx.ingress.kubernetes.io/ssl-redirect"   = "true"
      "nginx.ingress.kubernetes.io/force-ssl-redirect" = "true"
      "nginx.ingress.kubernetes.io/proxy-body-size" = "10m"
      "nginx.ingress.kubernetes.io/rate-limit"     = "100"
    }
  }

  spec {
    tls {
      hosts       = ["${local.app_name}-${local.environment}.yourdomain.com"]
      secret_name = "${local.app_name}-tls"
    }

    rule {
      host = "${local.app_name}-${local.environment}.yourdomain.com"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.app.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}

# Horizontal Pod Autoscaler
resource "kubernetes_horizontal_pod_autoscaler_v2" "app" {
  metadata {
    name      = local.app_name
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.app.metadata[0].name
    }

    min_replicas = 2
    max_replicas = 10

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

# Network Policies
resource "kubernetes_network_policy" "app" {
  metadata {
    name      = "${local.app_name}-network-policy"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    pod_selector {
      match_labels = {
        app = local.app_name
      }
    }

    policy_types = ["Ingress", "Egress"]

    # Allow ingress from ingress controller
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "ingress-nginx"
          }
        }
      }
      ports {
        port     = "3000"
        protocol = "TCP"
      }
    }

    # Allow egress to database and cache
    egress {
      to {
        pod_selector {
          match_labels = {
            component = "database"
          }
        }
      }
      ports {
        port     = "5432"
        protocol = "TCP"
      }
    }

    egress {
      to {
        pod_selector {
          match_labels = {
            component = "cache"
          }
        }
      }
      ports {
        port     = "6379"
        protocol = "TCP"
      }
    }

    egress {
      to {
        pod_selector {
          match_labels = {
            component = "ai-gateway"
          }
        }
      }
      ports {
        port     = "4000"
        protocol = "TCP"
      }
    }

    # Allow egress to external APIs (OpenAI, Anthropic, etc.)
    egress {
      to {}
      ports {
        port     = "443"
        protocol = "TCP"
      }
    }

    egress {
      to {}
      ports {
        port     = "80"
        protocol = "TCP"
      }
    }
  }
}

# Output values
output "namespace" {
  description = "Kubernetes namespace"
  value       = kubernetes_namespace.app.metadata[0].name
}

output "app_url" {
  description = "Application URL"
  value       = "https://${local.app_name}-${local.environment}.yourdomain.com"
}

output "database_host" {
  description = "Database host"
  value       = kubernetes_service.postgres.metadata[0].name
}

output "redis_host" {
  description = "Redis host"
  value       = kubernetes_service.redis.metadata[0].name
}

output "litellm_endpoint" {
  description = "LiteLLM endpoint"
  value       = "http://${kubernetes_service.litellm.metadata[0].name}:4000"
}