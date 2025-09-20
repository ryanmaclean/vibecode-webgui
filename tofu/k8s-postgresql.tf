# PostgreSQL deployment for AKS with Datadog monitoring integration

# PostgreSQL Secret for Datadog monitoring user
resource "kubernetes_secret" "postgres_datadog_secret" {
  metadata {
    name      = "postgres-datadog-secret"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name
  }

  data = {
    username = "datadog"
    password = random_password.postgres_datadog_password.result
  }

  type = "Opaque"

  depends_on = [kubernetes_namespace.vibecode_platform]
}

# Generate secure password for Datadog monitoring user
resource "random_password" "postgres_datadog_password" {
  length  = 32
  special = true
}

# PostgreSQL main secret
resource "kubernetes_secret" "postgres_secret" {
  metadata {
    name      = "postgres-secret"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name
  }

  data = {
    POSTGRES_DB       = "vibecode"
    POSTGRES_USER     = "vibecode"
    POSTGRES_PASSWORD = random_password.postgres_password.result
  }

  type = "Opaque"

  depends_on = [kubernetes_namespace.vibecode_platform]
}

# Generate secure password for main PostgreSQL user
resource "random_password" "postgres_password" {
  length  = 32
  special = true
}

# PostgreSQL ConfigMap with enhanced initialization
resource "kubernetes_config_map" "postgres_init" {
  metadata {
    name      = "postgres-init-sql"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name
  }

  data = {
    "init.sql"         = <<-SQL
      -- Initial database setup
      -- Ensure pgvector extension is available for embeddings
      CREATE EXTENSION IF NOT EXISTS vector;
    SQL
    "datadog-user.sql" = <<-EOT
      -- Create Datadog monitoring user
      CREATE USER datadog WITH PASSWORD '${random_password.postgres_datadog_password.result}';

      -- Grant necessary permissions for monitoring
      GRANT SELECT ON pg_stat_database TO datadog;
      GRANT SELECT ON pg_stat_user_tables TO datadog;
      GRANT SELECT ON pg_stat_user_indexes TO datadog;
      GRANT SELECT ON pg_statio_user_tables TO datadog;
      GRANT SELECT ON pg_database TO datadog;

      -- For replication monitoring
      GRANT EXECUTE ON FUNCTION pg_ls_dir(text) TO datadog;
      GRANT EXECUTE ON FUNCTION pg_stat_file(text) TO datadog;

      -- Create extension for monitoring if not exists
      CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
      GRANT SELECT ON pg_stat_statements TO datadog;
    EOT
  }

  depends_on = [kubernetes_namespace.vibecode_platform]
}

# PostgreSQL PersistentVolumeClaim with enhanced storage
resource "kubernetes_persistent_volume_claim" "postgres_pvc" {
  metadata {
    name      = "postgres-pvc"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name

    labels = {
      app       = "postgres"
      component = "database"
    }
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "${var.postgres_storage_size_gb}Gi"
      }
    }

    storage_class_name = "managed-csi"
  }

  depends_on = [kubernetes_namespace.vibecode_platform]
}

# PostgreSQL Deployment with Datadog annotations
resource "kubernetes_deployment" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name

    labels = {
      app       = "postgres"
      component = "database"
      version   = "16"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "postgres"
      }
    }

    template {
      metadata {
        labels = {
          app       = "postgres"
          component = "database"
          version   = "16"
        }

        annotations = {
          # Datadog autodiscovery annotations
          "ad.datadoghq.com/postgres.check_names"  = jsonencode(["postgres"])
          "ad.datadoghq.com/postgres.init_configs" = jsonencode([{}])
          "ad.datadoghq.com/postgres.instances" = jsonencode([{
            host                          = "%%host%%"
            port                          = 5432
            username                      = "datadog"
            password                      = "%%env_POSTGRES_DATADOG_PASSWORD%%"
            dbname                        = "vibecode"
            ssl                           = "prefer"
            tags                          = ["environment:${var.environment}", "cluster:${local.aks_cluster_name}"]
            collect_count_metrics         = true
            collect_activity_metrics      = true
            collect_database_size_metrics = true
            collect_default_db            = true
          }])

          # Custom metrics collection
          "ad.datadoghq.com/postgres.logs" = jsonencode([{
            source  = "postgresql"
            service = "vibecode-postgres"
            tags    = ["environment:${var.environment}"]
          }])
        }
      }

      spec {
        container {
          name  = "postgres"
          image = "pgvector/pgvector:pg16"

          port {
            container_port = 5432
            name           = "postgres"
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.postgres_secret.metadata[0].name
                key  = "POSTGRES_DB"
              }
            }
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.postgres_secret.metadata[0].name
                key  = "POSTGRES_USER"
              }
            }
          }

          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.postgres_secret.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          env {
            name = "POSTGRES_DATADOG_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.postgres_datadog_secret.metadata[0].name
                key  = "password"
              }
            }
          }

          # Enhanced PostgreSQL configuration
          env {
            name  = "POSTGRES_INITDB_ARGS"
            value = "--auth-host=md5 --auth-local=trust"
          }

          env {
            name  = "POSTGRES_HOST_AUTH_METHOD"
            value = "md5"
          }

          # Performance tuning
          env {
            name  = "POSTGRES_SHARED_PRELOAD_LIBRARIES"
            value = "pg_stat_statements,pgvector"
          }

          volume_mount {
            name       = "postgres-storage"
            mount_path = "/var/lib/postgresql/data"
          }

          volume_mount {
            name       = "init-db"
            mount_path = "/docker-entrypoint-initdb.d"
          }

          # Resource limits for production
          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1000m"
              memory = "2Gi"
            }
          }

          # Enhanced health checks
          readiness_probe {
            exec {
              command = [
                "pg_isready",
                "-U", "vibecode",
                "-d", "vibecode",
                "-h", "localhost"
              ]
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          liveness_probe {
            exec {
              command = [
                "pg_isready",
                "-U", "vibecode",
                "-d", "vibecode",
                "-h", "localhost"
              ]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          # Startup probe for slow initialization
          startup_probe {
            exec {
              command = [
                "pg_isready",
                "-U", "vibecode",
                "-d", "vibecode",
                "-h", "localhost"
              ]
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 30
          }
        }

        volume {
          name = "postgres-storage"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.postgres_pvc.metadata[0].name
          }
        }

        volume {
          name = "init-db"
          config_map {
            name = kubernetes_config_map.postgres_init.metadata[0].name
          }
        }

        # Security context
        security_context {
          run_as_user     = 999
          run_as_group    = 999
          fs_group        = 999
          run_as_non_root = true
        }

        # Node affinity for stable scheduling
        affinity {
          node_affinity {
            required_during_scheduling_ignored_during_execution {
              node_selector_term {
                match_expressions {
                  key      = "nodepool"
                  operator = "In"
                  values   = ["user"]
                }
              }
            }
          }
        }

        # Tolerations for node taints
        toleration {
          key      = "workload"
          operator = "Equal"
          value    = "database"
          effect   = "NoSchedule"
        }
      }
    }

    strategy {
      type = "Recreate"
    }
  }

  depends_on = [
    kubernetes_persistent_volume_claim.postgres_pvc,
    kubernetes_secret.postgres_secret,
    kubernetes_secret.postgres_datadog_secret,
    kubernetes_config_map.postgres_init
  ]
}

# PostgreSQL Service
resource "kubernetes_service" "postgres_service" {
  metadata {
    name      = "postgres-service"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name

    labels = {
      app       = "postgres"
      component = "database"
    }

    annotations = {
      # Service monitor annotations for Prometheus/Datadog
      "prometheus.io/scrape" = "true"
      "prometheus.io/port"   = "5432"
      "prometheus.io/path"   = "/metrics"
    }
  }

  spec {
    selector = {
      app = "postgres"
    }

    port {
      name        = "postgres"
      port        = 5432
      target_port = 5432
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.postgres]
}

# PostgreSQL NetworkPolicy for security
resource "kubernetes_network_policy" "postgres_network_policy" {
  metadata {
    name      = "postgres-network-policy"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name
  }

  spec {
    pod_selector {
      match_labels = {
        app = "postgres"
      }
    }

    policy_types = ["Ingress", "Egress"]

    # Allow ingress from VibeCode application pods
    ingress {
      from {
        pod_selector {
          match_labels = {
            app = "vibecode-webgui"
          }
        }
      }

      ports {
        port     = "5432"
        protocol = "TCP"
      }
    }

    # Allow ingress from Datadog agent
    ingress {
      from {
        pod_selector {
          match_labels = {
            app = "datadog-agent"
          }
        }
      }

      ports {
        port     = "5432"
        protocol = "TCP"
      }
    }

    # Allow egress for DNS resolution
    egress {
      to {
        namespace_selector {}
      }

      ports {
        port     = "53"
        protocol = "UDP"
      }
    }

    # Allow egress for NTP
    egress {
      ports {
        port     = "123"
        protocol = "UDP"
      }
    }
  }

  depends_on = [kubernetes_deployment.postgres]
}

# PostgreSQL PodDisruptionBudget
resource "kubernetes_pod_disruption_budget_v1" "postgres_pdb" {
  metadata {
    name      = "postgres-pdb"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name
  }

  spec {
    min_available = 1

    selector {
      match_labels = {
        app = "postgres"
      }
    }
  }

  depends_on = [kubernetes_deployment.postgres]
}