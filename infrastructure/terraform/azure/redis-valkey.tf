# Redis and Valkey Services Configuration
# Provides multiple options for key-value storage:
# 1. Azure Cache for Redis (traditional managed service)
# 2. Azure Managed Redis (new enterprise service)
# 3. Valkey (open-source Redis fork running on AKS)

# Variable to control which Redis/KV service to deploy
variable "redis_deployment_type" {
  description = "Type of Redis/KV deployment: azure_cache_redis, azure_managed_redis, valkey, or all"
  type        = string
  default     = "azure_cache_redis"
  validation {
    condition = contains([
      "azure_cache_redis", 
      "azure_managed_redis", 
      "valkey", 
      "all"
    ], var.redis_deployment_type)
    error_message = "redis_deployment_type must be one of: azure_cache_redis, azure_managed_redis, valkey, or all"
  }
}

# Azure Cache for Redis Configuration
variable "azure_cache_redis_config" {
  description = "Configuration for Azure Cache for Redis"
  type = object({
    sku_name               = optional(string, "Premium")
    family                 = optional(string, "P")
    capacity              = optional(number, 1)
    enable_non_ssl_port   = optional(bool, false)
    minimum_tls_version   = optional(string, "1.2")
    redis_version         = optional(string, "6")
    zones                 = optional(list(string), ["1", "2", "3"])
    redis_configuration = optional(object({
      enable_authentication         = optional(bool, true)
      maxmemory_reserved           = optional(number, 50)
      maxmemory_delta              = optional(number, 50)
      maxmemory_policy             = optional(string, "allkeys-lru")
      rdb_backup_enabled           = optional(bool, true)
      rdb_backup_frequency         = optional(number, 60)
      rdb_backup_max_snapshot_count = optional(number, 5)
    }), {})
  })
  default = {}
}

# Azure Managed Redis Configuration  
variable "azure_managed_redis_config" {
  description = "Configuration for Azure Managed Redis"
  type = object({
    sku_name              = optional(string, "Balanced")
    capacity_gb           = optional(number, 12)
    zones                 = optional(list(string), ["1", "2", "3"])
    high_availability     = optional(bool, true)
    clustering_enabled    = optional(bool, true)
    data_persistence      = optional(bool, true)
    backup_frequency      = optional(string, "Daily")
    modules = optional(list(string), [
      "RediSearch", 
      "RedisJSON", 
      "RedisTimeSeries", 
      "RedisBloom"
    ])
  })
  default = {}
}

# Valkey Configuration
variable "valkey_config" {
  description = "Configuration for Valkey deployment on AKS"
  type = object({
    cluster_size          = optional(number, 3)
    replica_count         = optional(number, 1)
    memory_limit          = optional(string, "4Gi")
    cpu_limit             = optional(string, "2")
    storage_size          = optional(string, "10Gi")
    storage_class         = optional(string, "managed-premium")
    enable_persistence    = optional(bool, true)
    enable_monitoring     = optional(bool, true)
    namespace             = optional(string, "valkey")
  })
  default = {}
}

# Azure Cache for Redis (Traditional)
resource "azurerm_redis_cache" "main" {
  count               = contains(["azure_cache_redis", "all"], var.redis_deployment_type) ? 1 : 0
  name                = "${var.project_name}-${var.environment}-redis"
  location            = var.azure_region
  resource_group_name = azurerm_resource_group.main.name
  
  capacity            = var.azure_cache_redis_config.capacity
  family              = var.azure_cache_redis_config.family
  sku_name            = var.azure_cache_redis_config.sku_name
  enable_non_ssl_port = var.azure_cache_redis_config.enable_non_ssl_port
  minimum_tls_version = var.azure_cache_redis_config.minimum_tls_version
  redis_version       = var.azure_cache_redis_config.redis_version
  zones               = var.azure_cache_redis_config.zones

  # Network configuration
  subnet_id = azurerm_subnet.redis[0].id

  # Redis configuration
  redis_configuration {
    enable_authentication         = var.azure_cache_redis_config.redis_configuration.enable_authentication
    maxmemory_reserved           = var.azure_cache_redis_config.redis_configuration.maxmemory_reserved
    maxmemory_delta              = var.azure_cache_redis_config.redis_configuration.maxmemory_delta
    maxmemory_policy             = var.azure_cache_redis_config.redis_configuration.maxmemory_policy
    rdb_backup_enabled           = var.azure_cache_redis_config.redis_configuration.rdb_backup_enabled
    rdb_backup_frequency         = var.azure_cache_redis_config.redis_configuration.rdb_backup_frequency
    rdb_backup_max_snapshot_count = var.azure_cache_redis_config.redis_configuration.rdb_backup_max_snapshot_count
    rdb_storage_connection_string = azurerm_storage_account.redis_backup[0].primary_blob_connection_string
  }

  # Enable patch schedules for maintenance
  patch_schedule {
    day_of_week    = "Sunday"
    start_hour_utc = 2
  }

  tags = var.additional_tags
}

# Azure Managed Redis (New Service - Preview)
resource "azurerm_redis_enterprise_cluster" "main" {
  count               = contains(["azure_managed_redis", "all"], var.redis_deployment_type) ? 1 : 0
  name                = "${var.project_name}-${var.environment}-managed-redis"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.azure_region

  sku_name = var.azure_managed_redis_config.sku_name
  zones    = var.azure_managed_redis_config.zones

  tags = var.additional_tags
}

resource "azurerm_redis_enterprise_database" "main" {
  count               = contains(["azure_managed_redis", "all"], var.redis_deployment_type) ? 1 : 0
  name                = "default"
  resource_group_name = azurerm_resource_group.main.name
  
  cluster_id          = azurerm_redis_enterprise_cluster.main[0].id
  
  # Configure modules
  module {
    name = "RediSearch"
  }
  
  module {
    name = "RedisJSON"
  }
  
  module {
    name = "RedisTimeSeries"
  }
  
  module {
    name = "RedisBloom"
  }

  # Enable clustering if specified
  clustering_policy = var.azure_managed_redis_config.clustering_enabled ? "EnterpriseCluster" : "OSS"
  
  # High availability
  linked_database_id = var.azure_managed_redis_config.high_availability ? [
    azurerm_redis_enterprise_cluster.main[0].id
  ] : []
}

# Dedicated subnet for Redis services
resource "azurerm_subnet" "redis" {
  count                = contains(["azure_cache_redis", "azure_managed_redis", "all"], var.redis_deployment_type) ? 1 : 0
  name                 = "redis-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.4.0/24"]

  # Enable private endpoints
  private_endpoint_network_policies_enabled = false
}

# Storage account for Redis backups
resource "azurerm_storage_account" "redis_backup" {
  count                    = contains(["azure_cache_redis", "all"], var.redis_deployment_type) ? 1 : 0
  name                     = "${replace(var.project_name, "-", "")}${var.environment}redisbkp"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = var.azure_region
  account_tier             = "Standard"
  account_replication_type = "GRS"
  
  # Enable advanced threat protection
  enable_https_traffic_only = true
  min_tls_version          = "TLS1_2"
  
  tags = var.additional_tags
}

# Private endpoint for Redis
resource "azurerm_private_endpoint" "redis" {
  count               = contains(["azure_cache_redis", "azure_managed_redis", "all"], var.redis_deployment_type) ? 1 : 0
  name                = "${var.project_name}-${var.environment}-redis-pe"
  location            = var.azure_region
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.redis[0].id

  private_service_connection {
    name                           = "${var.project_name}-${var.environment}-redis-psc"
    private_connection_resource_id = var.redis_deployment_type == "azure_cache_redis" ? azurerm_redis_cache.main[0].id : azurerm_redis_enterprise_cluster.main[0].id
    is_manual_connection           = false
    subresource_names              = ["redisCache"]
  }

  private_dns_zone_group {
    name                 = "redis-dns-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.redis[0].id]
  }

  tags = var.additional_tags
}

# Private DNS zone for Redis
resource "azurerm_private_dns_zone" "redis" {
  count               = contains(["azure_cache_redis", "azure_managed_redis", "all"], var.redis_deployment_type) ? 1 : 0
  name                = "privatelink.redis.cache.windows.net"
  resource_group_name = azurerm_resource_group.main.name
  tags                = var.additional_tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "redis" {
  count                 = contains(["azure_cache_redis", "azure_managed_redis", "all"], var.redis_deployment_type) ? 1 : 0
  name                  = "redis-dns-vnet-link"
  resource_group_name   = azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.redis[0].name
  virtual_network_id    = azurerm_virtual_network.main.id
  tags                  = var.additional_tags
}

# Valkey Namespace
resource "kubernetes_namespace" "valkey" {
  count = contains(["valkey", "all"], var.redis_deployment_type) ? 1 : 0
  
  metadata {
    name = var.valkey_config.namespace
    labels = {
      name        = "valkey"
      environment = var.environment
    }
  }
  
  depends_on = [azurerm_kubernetes_cluster.main]
}

# Valkey ConfigMap
resource "kubernetes_config_map" "valkey" {
  count = contains(["valkey", "all"], var.redis_deployment_type) ? 1 : 0
  
  metadata {
    name      = "valkey-config"
    namespace = kubernetes_namespace.valkey[0].metadata[0].name
  }

  data = {
    "valkey.conf" = <<-EOT
      # Valkey Configuration
      bind 0.0.0.0
      protected-mode yes
      port 6379
      
      # Memory configuration
      maxmemory-policy allkeys-lru
      
      # Persistence configuration
      ${var.valkey_config.enable_persistence ? "save 900 1" : ""}
      ${var.valkey_config.enable_persistence ? "save 300 10" : ""}
      ${var.valkey_config.enable_persistence ? "save 60 10000" : ""}
      
      # Cluster configuration
      cluster-enabled yes
      cluster-config-file nodes.conf
      cluster-node-timeout 5000
      cluster-announce-ip $(hostname -i)
      cluster-announce-port 6379
      cluster-announce-bus-port 16379
      
      # Security
      requirepass ${random_password.valkey_password[0].result}
      
      # Logging
      loglevel notice
      logfile ""
      
      # Performance tuning
      tcp-keepalive 300
      timeout 0
      tcp-backlog 511
      
      # Enable experimental features
      enable-debug-command local
      enable-module-command yes
    EOT
  }
}

# Valkey Password
resource "random_password" "valkey_password" {
  count   = contains(["valkey", "all"], var.redis_deployment_type) ? 1 : 0
  length  = 32
  special = true
}

resource "kubernetes_secret" "valkey" {
  count = contains(["valkey", "all"], var.redis_deployment_type) ? 1 : 0
  
  metadata {
    name      = "valkey-secret"
    namespace = kubernetes_namespace.valkey[0].metadata[0].name
  }

  data = {
    password = random_password.valkey_password[0].result
  }
}

# Valkey Service
resource "kubernetes_service" "valkey" {
  count = contains(["valkey", "all"], var.redis_deployment_type) ? 1 : 0
  
  metadata {
    name      = "valkey-service"
    namespace = kubernetes_namespace.valkey[0].metadata[0].name
    labels = {
      app = "valkey"
    }
  }

  spec {
    selector = {
      app = "valkey"
    }

    port {
      name        = "redis"
      port        = 6379
      target_port = 6379
    }

    port {
      name        = "cluster"
      port        = 16379
      target_port = 16379
    }

    type                        = "ClusterIP"
    cluster_ip                  = "None"
    publish_not_ready_addresses = true
  }
}

# Valkey StatefulSet
resource "kubernetes_stateful_set" "valkey" {
  count = contains(["valkey", "all"], var.redis_deployment_type) ? 1 : 0
  
  metadata {
    name      = "valkey"
    namespace = kubernetes_namespace.valkey[0].metadata[0].name
    labels = {
      app = "valkey"
    }
  }

  spec {
    service_name = kubernetes_service.valkey[0].metadata[0].name
    replicas     = var.valkey_config.cluster_size

    selector {
      match_labels = {
        app = "valkey"
      }
    }

    template {
      metadata {
        labels = {
          app = "valkey"
        }
      }

      spec {
        # Security context
        security_context {
          fs_group    = 1000
          run_as_user = 1000
        }

        # Anti-affinity to spread pods across nodes
        affinity {
          pod_anti_affinity {
            preferred_during_scheduling_ignored_during_execution {
              weight = 100
              pod_affinity_term {
                label_selector {
                  match_expressions {
                    key      = "app"
                    operator = "In"
                    values   = ["valkey"]
                  }
                }
                topology_key = "kubernetes.io/hostname"
              }
            }
          }
        }

        container {
          name  = "valkey"
          image = "valkey/valkey:8.1-alpine"

          port {
            container_port = 6379
            name           = "redis"
          }

          port {
            container_port = 16379
            name           = "cluster"
          }

          # Resource limits
          resources {
            limits = {
              cpu    = var.valkey_config.cpu_limit
              memory = var.valkey_config.memory_limit
            }
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
          }

          # Environment variables
          env {
            name = "VALKEY_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.valkey[0].metadata[0].name
                key  = "password"
              }
            }
          }

          # Volume mounts
          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          volume_mount {
            name       = "config"
            mount_path = "/usr/local/etc/valkey"
          }

          # Liveness probe
          liveness_probe {
            exec {
              command = [
                "sh", "-c",
                "valkey-cli --no-auth-warning -a $VALKEY_PASSWORD ping"
              ]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          # Readiness probe
          readiness_probe {
            exec {
              command = [
                "sh", "-c",
                "valkey-cli --no-auth-warning -a $VALKEY_PASSWORD ping"
              ]
            }
            initial_delay_seconds = 5
            period_seconds        = 2
            timeout_seconds       = 1
            failure_threshold     = 3
          }

          # Startup probe
          startup_probe {
            exec {
              command = [
                "sh", "-c",
                "valkey-cli --no-auth-warning -a $VALKEY_PASSWORD ping"
              ]
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 1
            failure_threshold     = 30
          }
        }

        # Volumes
        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.valkey[0].metadata[0].name
          }
        }
      }
    }

    # Volume claim template for persistent storage
    volume_claim_template {
      metadata {
        name = "data"
      }

      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = var.valkey_config.storage_class

        resources {
          requests = {
            storage = var.valkey_config.storage_size
          }
        }
      }
    }

    update_strategy {
      type = "RollingUpdate"
      rolling_update {
        partition = 0
      }
    }
  }
}

# Valkey Cluster Initialization Job
resource "kubernetes_job" "valkey_cluster_init" {
  count = contains(["valkey", "all"], var.redis_deployment_type) ? 1 : 0
  
  metadata {
    name      = "valkey-cluster-init"
    namespace = kubernetes_namespace.valkey[0].metadata[0].name
  }

  spec {
    template {
      metadata {
        labels = {
          app = "valkey-cluster-init"
        }
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "cluster-init"
          image = "valkey/valkey:8.1-alpine"

          command = [
            "sh", "-c",
            <<-EOT
              echo "Waiting for Valkey pods to be ready..."
              sleep 30
              
              NODES=""
              for i in $(seq 0 $((${var.valkey_config.cluster_size} - 1))); do
                NODES="$NODES valkey-$i.valkey-service.${var.valkey_config.namespace}.svc.cluster.local:6379"
              done
              
              echo "Creating Valkey cluster with nodes: $NODES"
              valkey-cli --cluster create $NODES \
                --cluster-replicas ${var.valkey_config.replica_count} \
                --cluster-yes \
                -a $VALKEY_PASSWORD
              
              echo "Valkey cluster initialization completed"
            EOT
          ]

          env {
            name = "VALKEY_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.valkey[0].metadata[0].name
                key  = "password"
              }
            }
          }
        }
      }
    }

    backoff_limit              = 3
    ttl_seconds_after_finished = 300
  }

  depends_on = [kubernetes_stateful_set.valkey]
}

# Key Vault secrets for Redis/Valkey connection strings
resource "azurerm_key_vault_secret" "redis_connection_string" {
  count        = contains(["azure_cache_redis", "all"], var.redis_deployment_type) ? 1 : 0
  name         = "redis-connection-string"
  value        = azurerm_redis_cache.main[0].primary_connection_string
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.current_user]
}

resource "azurerm_key_vault_secret" "managed_redis_connection_string" {
  count        = contains(["azure_managed_redis", "all"], var.redis_deployment_type) ? 1 : 0
  name         = "managed-redis-connection-string"
  value        = azurerm_redis_enterprise_database.main[0].primary_access_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.current_user]
}

resource "azurerm_key_vault_secret" "valkey_password" {
  count        = contains(["valkey", "all"], var.redis_deployment_type) ? 1 : 0
  name         = "valkey-password"
  value        = random_password.valkey_password[0].result
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.current_user]
}

# Outputs for Redis/Valkey services
output "redis_services" {
  description = "Redis and Valkey service endpoints and details"
  value = {
    deployment_type = var.redis_deployment_type
    
    azure_cache_redis = var.redis_deployment_type == "azure_cache_redis" || var.redis_deployment_type == "all" ? {
      hostname      = try(azurerm_redis_cache.main[0].hostname, null)
      ssl_port      = try(azurerm_redis_cache.main[0].ssl_port, null)
      port          = try(azurerm_redis_cache.main[0].port, null)
      primary_key   = try(azurerm_redis_cache.main[0].primary_access_key, null)
    } : null
    
    azure_managed_redis = var.redis_deployment_type == "azure_managed_redis" || var.redis_deployment_type == "all" ? {
      hostname    = try(azurerm_redis_enterprise_cluster.main[0].hostname, null)
      access_keys = try(azurerm_redis_enterprise_database.main[0].primary_access_key, null)
    } : null
    
    valkey = var.redis_deployment_type == "valkey" || var.redis_deployment_type == "all" ? {
      service_name = try(kubernetes_service.valkey[0].metadata[0].name, null)
      namespace    = try(kubernetes_namespace.valkey[0].metadata[0].name, null)
      cluster_size = var.valkey_config.cluster_size
      endpoint     = try("${kubernetes_service.valkey[0].metadata[0].name}.${kubernetes_namespace.valkey[0].metadata[0].name}.svc.cluster.local:6379", null)
    } : null
  }
  sensitive = true
} 