# Datadog Agent deployment for AKS with comprehensive monitoring

locals {
  datadog_enabled = var.enable_datadog_monitoring
}

# Datadog API Key secret
resource "kubernetes_secret" "datadog_secret" {
  count = local.datadog_enabled ? 1 : 0

  metadata {
    name      = "datadog-secret"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name
  }

  data = {
    api-key = var.datadog_api_key
    app-key = var.datadog_app_key
  }

  type = "Opaque"

  depends_on = [kubernetes_namespace.vibecode_platform]
}

# Auth token for Agent <-> Cluster Agent communication
resource "random_password" "datadog_cluster_agent_token" {
  count   = local.datadog_enabled ? 1 : 0
  length  = 64
  special = false
}

resource "kubernetes_secret" "datadog_cluster_agent_token" {
  count = local.datadog_enabled ? 1 : 0

  metadata {
    name      = "datadog-cluster-agent-token"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name
  }

  data = {
    token = random_password.datadog_cluster_agent_token[count.index].result
  }

  type = "Opaque"

  depends_on = [kubernetes_namespace.vibecode_platform]
}

# Datadog Agent ServiceAccount
resource "kubernetes_service_account" "datadog_agent" {
  count = local.datadog_enabled ? 1 : 0

  metadata {
    name      = "datadog-agent"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name

    labels = {
      app = "datadog-agent"
    }
  }

  depends_on = [kubernetes_namespace.vibecode_platform]
}

# ClusterRole for Datadog Agent
resource "kubernetes_cluster_role" "datadog_agent" {
  count = local.datadog_enabled ? 1 : 0

  metadata {
    name = "datadog-agent"

    labels = {
      app = "datadog-agent"
    }
  }

  rule {
    api_groups = [""]
    resources = [
      "services",
      "events",
      "endpoints",
      "pods",
      "nodes",
      "componentstatuses"
    ]
    verbs = ["get", "list", "watch"]
  }

  rule {
    api_groups = [""]
    resources  = ["configmaps"]
    verbs      = ["get", "update"]
  }

  rule {
    api_groups = ["apps"]
    resources = [
      "deployments",
      "replicasets",
      "daemonsets"
    ]
    verbs = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["extensions"]
    resources = [
      "deployments",
      "replicasets"
    ]
    verbs = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["batch"]
    resources  = ["jobs", "cronjobs"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["autoscaling"]
    resources  = ["horizontalpodautoscalers"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = [""]
    resources  = ["nodes/metrics", "nodes/spec", "nodes/proxy", "nodes/stats"]
    verbs      = ["get"]
  }

  # For Cluster Agent
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["coordination.k8s.io"]
    resources  = ["leases"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
}

# ClusterRoleBinding for Datadog Agent
resource "kubernetes_cluster_role_binding" "datadog_agent" {
  count = local.datadog_enabled ? 1 : 0

  metadata {
    name = "datadog-agent"

    labels = {
      app = "datadog-agent"
    }
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.datadog_agent[count.index].metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.datadog_agent[count.index].metadata[0].name
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name
  }
}

# Datadog Agent ConfigMap
resource "kubernetes_config_map" "datadog_config" {
  count = local.datadog_enabled ? 1 : 0

  metadata {
    name      = "datadog-config"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name

    labels = {
      app = "datadog-agent"
    }
  }

  data = {
    "datadog.yaml" = yamlencode({
      api_key = "ENC[k8s_secret@${kubernetes_namespace.vibecode_platform.metadata[0].name}/datadog-secret/api-key]"
      site    = "datadoghq.com"

      # Cluster configuration
      cluster_name = local.aks_cluster_name

      # Tags
      tags = [
        "environment:${var.environment}",
        "platform:vibecode",
        "cluster:aks",
        "deployment:${random_id.deployment.hex}"
      ]

      # Log collection
      logs_enabled = true
      logs_config = {
        container_collect_all     = true
        auto_multi_line_detection = true
      }

      # APM configuration
      apm_config = {
        enabled = true
        env     = var.environment
      }

      # Process monitoring
      process_config = {
        enabled = "true"
      }

      # Kubernetes configuration
      kubernetes_kubelet_host    = "status.hostIP"
      kubernetes_kubeconfig_path = ""

      # Container runtime
      cri_socket_path = "/var/run/containerd/containerd.sock"

      # Autodiscovery
      config_providers = [
        {
          name    = "kubelet"
          polling = true
        }
      ]

      # Checks
      confd_path         = "/etc/datadog-agent/conf.d"
      additional_checksd = "/etc/datadog-agent/checks.d"
    })

    # PostgreSQL integration configuration
    "postgres.yaml" = yamlencode({
      init_config = {}
      instances = [
        {
          host     = "postgres-service.${kubernetes_namespace.vibecode_platform.metadata[0].name}.svc.cluster.local"
          port     = 5432
          username = "datadog"
          password = "ENC[k8s_secret@${kubernetes_namespace.vibecode_platform.metadata[0].name}/postgres-datadog-secret/password]"
          dbname   = "vibecode"
          ssl      = "prefer"
          tags = [
            "environment:${var.environment}",
            "service:vibecode-postgres",
            "cluster:${local.aks_cluster_name}"
          ]
          collect_count_metrics         = true
          collect_activity_metrics      = true
          collect_database_size_metrics = true
          collect_default_db            = true
          collect_function_metrics      = true
          collect_bloat_metrics         = true
          relations = [
            {
              relation_name = "users"
              schemas       = ["public"]
            },
            {
              relation_name = "projects"
              schemas       = ["public"]
            },
            {
              relation_name = "ai_interactions"
              schemas       = ["public"]
            }
          ]
        }
      ]
    })

    # Custom check for VibeCode application
    "vibecode_health.yaml" = yamlencode({
      init_config = {}
      instances = [
        {
          url  = "http://vibecode-app-vibecode.${kubernetes_namespace.vibecode_platform.metadata[0].name}.svc.cluster.local:80/api/health"
          name = "vibecode-health"
          tags = [
            "environment:${var.environment}",
            "service:vibecode-app",
            "cluster:${local.aks_cluster_name}"
          ]
          timeout                   = 5
          http_response_status_code = "200"
          content_match             = "healthy"
        }
      ]
    })
  }

  depends_on = [kubernetes_namespace.vibecode_platform]
}

# Datadog Agent DaemonSet
resource "kubernetes_daemonset" "datadog_agent" {
  count = local.datadog_enabled ? 1 : 0

  metadata {
    name      = "datadog-agent"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name

    labels = {
      app = "datadog-agent"
    }
  }

  spec {
    selector {
      match_labels = {
        app = "datadog-agent"
      }
    }

    template {
      metadata {
        labels = {
          app = "datadog-agent"
        }

        annotations = {
          "container.apparmor.security.beta.kubernetes.io/agent" = "unconfined"
        }
      }

      spec {
        service_account_name = kubernetes_service_account.datadog_agent[count.index].metadata[0].name
        host_network         = true
        host_pid             = true

        container {
          name  = "agent"
          image = "datadog/docker-dd-agent:latest-alpine"

          env {
            name = "DD_API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.datadog_secret[count.index].metadata[0].name
                key  = "api-key"
              }
            }
          }

          env {
            name = "DD_APP_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.datadog_secret[count.index].metadata[0].name
                key  = "app-key"
              }
            }
          }

          env {
            name  = "DD_SITE"
            value = "datadoghq.com"
          }

          env {
            name  = "DD_CLUSTER_NAME"
            value = local.aks_cluster_name
          }

          # Enable Cluster Agent + Orchestrator Explorer
          env {
            name  = "DD_CLUSTER_AGENT_ENABLED"
            value = "true"
          }
          env {
            name = "DD_CLUSTER_AGENT_AUTH_TOKEN"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.datadog_cluster_agent_token[count.index].metadata[0].name
                key  = "token"
              }
            }
          }
          env {
            name  = "DD_CLUSTER_AGENT_URL"
            value = "http://datadog-cluster-agent:5005"
          }
          env {
            name  = "DD_CLUSTER_AGENT_USE_TLS"
            value = "false"
          }
          env {
            name  = "DD_ORCHESTRATOR_EXPLORER_ENABLED"
            value = "true"
          }

          env {
            name = "DD_KUBERNETES_KUBELET_HOST"
            value_from {
              field_ref {
                field_path = "status.hostIP"
              }
            }
          }

          env {
            name = "DD_KUBERNETES_POD_LABELS_AS_TAGS"
            value = jsonencode({
              "app"       = "kube_app"
              "version"   = "kube_version"
              "component" = "kube_component"
            })
          }

          env {
            name  = "DD_LOGS_ENABLED"
            value = "true"
          }

          env {
            name  = "DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL"
            value = "true"
          }

          env {
            name  = "DD_APM_ENABLED"
            value = "true"
          }

          env {
            name  = "DD_PROCESS_AGENT_ENABLED"
            value = "true"
          }

          env {
            name  = "DD_CONTAINER_EXCLUDE"
            value = "name:datadog-agent"
          }

          env {
            name  = "DD_HEALTH_PORT"
            value = "5555"
          }

          env {
            name  = "DD_DOGSTATSD_NON_LOCAL_TRAFFIC"
            value = "true"
          }

          port {
            container_port = 8125
            name           = "dogstatsdport"
            protocol       = "UDP"
          }

          port {
            container_port = 8126
            name           = "traceport"
            protocol       = "TCP"
          }

          port {
            container_port = 5555
            name           = "healthport"
            protocol       = "TCP"
          }

          volume_mount {
            name       = "dockersocket"
            mount_path = "/var/run/docker.sock"
            read_only  = true
          }

          volume_mount {
            name       = "containersocket"
            mount_path = "/var/run/containerd/containerd.sock"
            read_only  = true
          }

          volume_mount {
            name       = "procdir"
            mount_path = "/host/proc"
            read_only  = true
          }

          volume_mount {
            name       = "cgroups"
            mount_path = "/host/sys/fs/cgroup"
            read_only  = true
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/datadog-agent/datadog.yaml"
            sub_path   = "datadog.yaml"
            read_only  = true
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/datadog-agent/conf.d/postgres.d/conf.yaml"
            sub_path   = "postgres.yaml"
            read_only  = true
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/datadog-agent/conf.d/http_check.d/conf.yaml"
            sub_path   = "vibecode_health.yaml"
            read_only  = true
          }

          volume_mount {
            name       = "runtimesocketdir"
            mount_path = "/host/var/run"
            read_only  = true
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/live"
              port = "healthport"
            }
            initial_delay_seconds = 15
            period_seconds        = 15
            timeout_seconds       = 5
            failure_threshold     = 6
          }

          readiness_probe {
            http_get {
              path = "/ready"
              port = "healthport"
            }
            initial_delay_seconds = 15
            period_seconds        = 15
            timeout_seconds       = 5
            failure_threshold     = 6
          }

          security_context {
            privileged  = true
            run_as_user = 0
          }
        }

        volume {
          name = "dockersocket"
          host_path {
            path = "/var/run/docker.sock"
          }
        }

        volume {
          name = "containersocket"
          host_path {
            path = "/var/run/containerd/containerd.sock"
          }
        }

        volume {
          name = "procdir"
          host_path {
            path = "/proc"
          }
        }

        volume {
          name = "cgroups"
          host_path {
            path = "/sys/fs/cgroup"
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.datadog_config[count.index].metadata[0].name
          }
        }

        volume {
          name = "runtimesocketdir"
          host_path {
            path = "/var/run"
          }
        }

        # Node affinity to ensure agents run on all nodes
        affinity {
          node_affinity {
            required_during_scheduling_ignored_during_execution {
              node_selector_term {
                match_expressions {
                  key      = "kubernetes.io/os"
                  operator = "In"
                  values   = ["linux"]
                }
              }
            }
          }
        }

        # Tolerate all taints to run on all nodes
        toleration {
          operator = "Exists"
        }
      }
    }
  }

  depends_on = [
    kubernetes_service_account.datadog_agent,
    kubernetes_cluster_role_binding.datadog_agent,
    kubernetes_config_map.datadog_config,
    kubernetes_secret.datadog_secret
  ]
}

# Datadog Cluster Agent Deployment (for advanced features)
resource "kubernetes_deployment" "datadog_cluster_agent" {
  count = local.datadog_enabled ? 1 : 0

  metadata {
    name      = "datadog-cluster-agent"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name

    labels = {
      app = "datadog-cluster-agent"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "datadog-cluster-agent"
      }
    }

    template {
      metadata {
        labels = {
          app = "datadog-cluster-agent"
        }
      }

      spec {
        service_account_name = kubernetes_service_account.datadog_agent[count.index].metadata[0].name

        container {
          name  = "cluster-agent"
          image = "gcr.io/datadoghq/cluster-agent:7.49.1"

          env {
            name = "DD_API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.datadog_secret[count.index].metadata[0].name
                key  = "api-key"
              }
            }
          }

          env {
            name = "DD_APP_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.datadog_secret[count.index].metadata[0].name
                key  = "app-key"
              }
            }
          }

          env {
            name  = "DD_CLUSTER_NAME"
            value = local.aks_cluster_name
          }

          env {
            name  = "DD_SITE"
            value = "datadoghq.com"
          }

          env {
            name  = "DD_CLUSTER_AGENT_ENABLED"
            value = "true"
          }

          env {
            name  = "DD_EXTERNAL_METRICS_PROVIDER_ENABLED"
            value = "true"
          }

          env {
            name  = "DD_COLLECT_KUBERNETES_EVENTS"
            value = "true"
          }

          # Leader election + auth token for Agents
          env {
            name  = "DD_CLUSTER_AGENT_LEADER_ELECTION"
            value = "true"
          }
          env {
            name = "DD_CLUSTER_AGENT_AUTH_TOKEN"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.datadog_cluster_agent_token[count.index].metadata[0].name
                key  = "token"
              }
            }
          }

          port {
            container_port = 5005
            name           = "agentport"
            protocol       = "TCP"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/live"
              port = "agentport"
            }
            initial_delay_seconds = 15
            period_seconds        = 15
            timeout_seconds       = 5
            failure_threshold     = 6
          }

          readiness_probe {
            http_get {
              path = "/ready"
              port = "agentport"
            }
            initial_delay_seconds = 15
            period_seconds        = 15
            timeout_seconds       = 5
            failure_threshold     = 6
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_service_account.datadog_agent,
    kubernetes_cluster_role_binding.datadog_agent,
    kubernetes_secret.datadog_secret
  ]
}

# Service for Datadog Cluster Agent
resource "kubernetes_service" "datadog_cluster_agent" {
  count = local.datadog_enabled ? 1 : 0

  metadata {
    name      = "datadog-cluster-agent"
    namespace = kubernetes_namespace.vibecode_platform.metadata[0].name

    labels = {
      app = "datadog-cluster-agent"
    }
  }

  spec {
    selector = {
      app = "datadog-cluster-agent"
    }

    port {
      name        = "agentport"
      port        = 5005
      target_port = 5005
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.datadog_cluster_agent]
}
