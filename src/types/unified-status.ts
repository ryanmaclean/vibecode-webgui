/**
 * Unified Status Type Definitions
 *
 * Extended types for multi-service health monitoring including:
 * - Kubernetes (KIND cluster, pods)
 * - AI Model Providers (OpenAI, Anthropic, Azure OpenAI)
 * - Monitoring Stack (Datadog, OpenTelemetry)
 * - Docker Containers
 * - Database Services (PostgreSQL, pgvector)
 *
 * Extends the base health monitoring types for unified status bar.
 */

import type { ServiceHealthStatus, AggregatedHealthStatus } from './health';

/**
 * Extended service names including Kubernetes, AI, and monitoring services
 */
export type UnifiedServiceName =
  | 'ssh'
  | 'postgresql'
  | 'valkey'
  | 'openvscode'
  | 'docker'
  | 'kubernetes'
  | 'ai-openai'
  | 'ai-anthropic'
  | 'ai-azure'
  | 'monitoring-datadog'
  | 'monitoring-otel'
  | 'pgvector';

/**
 * Service category for grouping in the status bar
 */
export type ServiceCategory =
  | 'infrastructure'
  | 'database'
  | 'ai-providers'
  | 'monitoring'
  | 'development';

/**
 * Kubernetes cluster health status
 */
export interface KubernetesClusterHealth {
  /** Cluster name (e.g., 'kind-harness') */
  clusterName: string;
  /** Cluster health status */
  status: ServiceHealthStatus;
  /** Kubernetes version */
  version?: string;
  /** Number of nodes */
  nodeCount?: number;
  /** Number of ready nodes */
  readyNodes?: number;
  /** API server reachable */
  apiServerReachable: boolean;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Kubernetes pod health information
 */
export interface KubernetesPodHealth {
  /** Pod name */
  name: string;
  /** Pod namespace */
  namespace: string;
  /** Pod status */
  status: ServiceHealthStatus;
  /** Pod phase (Running, Pending, Failed, etc.) */
  phase?: string;
  /** Number of ready containers */
  readyContainers?: number;
  /** Total containers */
  totalContainers?: number;
  /** Restart count */
  restarts?: number;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Aggregated Kubernetes health
 */
export interface KubernetesHealthResult {
  /** Kubernetes service name */
  name: 'kubernetes';
  /** Overall Kubernetes health status */
  status: AggregatedHealthStatus;
  /** Cluster health */
  cluster: KubernetesClusterHealth;
  /** Pod health statuses */
  pods: KubernetesPodHealth[];
  /** Latency of the health check in milliseconds */
  latencyMs: number;
  /** ISO timestamp of when the check was performed */
  lastChecked: string;
  /** Summary counts */
  summary?: {
    totalPods: number;
    healthyPods: number;
    unhealthyPods: number;
  };
}

/**
 * AI provider names
 */
export type AIProviderName = 'openai' | 'anthropic' | 'azure-openai';

/**
 * AI model endpoint health
 */
export interface AIModelEndpointHealth {
  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus') */
  modelId: string;
  /** Endpoint health status */
  status: ServiceHealthStatus;
  /** Response time in milliseconds */
  responseTimeMs?: number;
  /** Whether the model is available */
  available: boolean;
  /** Rate limit status */
  rateLimitStatus?: {
    remaining?: number;
    limit?: number;
    resetAt?: string;
  };
  /** Error message if unhealthy */
  error?: string;
}

/**
 * AI provider health result
 */
export interface AIProviderHealthResult {
  /** Provider name */
  name: AIProviderName;
  /** Overall provider health status */
  status: AggregatedHealthStatus;
  /** API endpoint reachable */
  endpointReachable: boolean;
  /** API key configured */
  apiKeyConfigured: boolean;
  /** Model endpoint health statuses */
  models: AIModelEndpointHealth[];
  /** Latency of the health check in milliseconds */
  latencyMs: number;
  /** ISO timestamp of when the check was performed */
  lastChecked: string;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Monitoring service names
 */
export type MonitoringServiceName = 'datadog' | 'opentelemetry';

/**
 * Datadog agent health
 */
export interface DatadogHealthResult {
  /** Service name */
  name: 'datadog';
  /** Overall Datadog health status */
  status: ServiceHealthStatus;
  /** Agent running */
  agentRunning: boolean;
  /** Agent version */
  agentVersion?: string;
  /** API connection status */
  apiConnected: boolean;
  /** Metrics being sent */
  metricsActive: boolean;
  /** Traces being sent */
  tracesActive: boolean;
  /** Logs being sent */
  logsActive: boolean;
  /** Latency of the health check in milliseconds */
  latencyMs: number;
  /** ISO timestamp of when the check was performed */
  lastChecked: string;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * OpenTelemetry collector health
 */
export interface OpenTelemetryHealthResult {
  /** Service name */
  name: 'opentelemetry';
  /** Overall OTEL health status */
  status: ServiceHealthStatus;
  /** Collector running */
  collectorRunning: boolean;
  /** Collector version */
  collectorVersion?: string;
  /** OTLP endpoint reachable */
  otlpEndpointReachable: boolean;
  /** Receivers active */
  receiversActive: boolean;
  /** Exporters active */
  exportersActive: boolean;
  /** Latency of the health check in milliseconds */
  latencyMs: number;
  /** ISO timestamp of when the check was performed */
  lastChecked: string;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Union type for monitoring service health
 */
export type MonitoringHealthResult = DatadogHealthResult | OpenTelemetryHealthResult;

/**
 * Docker container health information
 */
export interface DockerContainerHealth {
  /** Container ID */
  id: string;
  /** Container name */
  name: string;
  /** Container status */
  status: ServiceHealthStatus;
  /** Container state (running, exited, etc.) */
  state?: string;
  /** Health check status if defined */
  healthStatus?: 'healthy' | 'unhealthy' | 'starting' | 'none';
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Docker daemon health result
 */
export interface DockerHealthResult {
  /** Service name */
  name: 'docker';
  /** Overall Docker health status */
  status: AggregatedHealthStatus;
  /** Daemon reachable */
  daemonReachable: boolean;
  /** Docker version */
  version?: string;
  /** Container health statuses */
  containers: DockerContainerHealth[];
  /** Latency of the health check in milliseconds */
  latencyMs: number;
  /** ISO timestamp of when the check was performed */
  lastChecked: string;
  /** Summary counts */
  summary?: {
    totalContainers: number;
    runningContainers: number;
    healthyContainers: number;
    unhealthyContainers: number;
  };
  /** Error message if unhealthy */
  error?: string;
}

/**
 * pgvector extension health
 */
export interface PgVectorHealthResult {
  /** Service name */
  name: 'pgvector';
  /** Overall pgvector health status */
  status: ServiceHealthStatus;
  /** Extension installed */
  extensionInstalled: boolean;
  /** Extension version */
  version?: string;
  /** Vector operations working */
  vectorOpsWorking: boolean;
  /** Latency of the health check in milliseconds */
  latencyMs: number;
  /** ISO timestamp of when the check was performed */
  lastChecked: string;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Unified service health result (union of all service types)
 */
export type UnifiedServiceHealthResult =
  | KubernetesHealthResult
  | AIProviderHealthResult
  | MonitoringHealthResult
  | DockerHealthResult
  | PgVectorHealthResult;

/**
 * Categorized service health for status bar display
 */
export interface CategorizedServiceHealth {
  /** Service category */
  category: ServiceCategory;
  /** Category display name */
  categoryName: string;
  /** Services in this category */
  services: UnifiedServiceHealthResult[];
  /** Overall category health status */
  status: AggregatedHealthStatus;
}

/**
 * Unified health response for all services
 */
export interface UnifiedHealthResponse {
  /** Overall system health status */
  status: AggregatedHealthStatus;
  /** ISO timestamp of the response */
  timestamp: string;
  /** Total time to complete all checks */
  totalCheckTimeMs: number;
  /** Services grouped by category */
  categories: CategorizedServiceHealth[];
  /** Summary counts across all services */
  summary: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    unknownServices: number;
  };
  /** Whether this response is from cache */
  fromCache?: boolean;
  /** Cache TTL in milliseconds if cached */
  cacheTtlMs?: number;
}

/**
 * Service health check configuration for unified monitoring
 */
export interface UnifiedHealthCheckConfig {
  /** Services to check (empty = all) */
  services?: UnifiedServiceName[];
  /** Timeout for the entire health check operation in milliseconds */
  timeout: number;
  /** Whether to use cached results if available */
  useCache: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Whether to run checks in parallel */
  parallel: boolean;
  /** Maximum concurrent checks if parallel */
  maxConcurrent?: number;
}

/**
 * Status bar display preferences
 */
export interface StatusBarPreferences {
  /** Whether the status bar is collapsed */
  collapsed: boolean;
  /** Which categories to show (empty = all) */
  visibleCategories?: ServiceCategory[];
  /** Auto-expand on unhealthy status */
  autoExpandOnUnhealthy: boolean;
  /** Show detailed metrics */
  showDetailedMetrics: boolean;
  /** Refresh interval in milliseconds */
  refreshIntervalMs: number;
  /** Use WebSocket for real-time updates */
  useWebSocket: boolean;
}

/**
 * Status bar state
 */
export interface StatusBarState {
  /** Current health data */
  health: UnifiedHealthResponse | null;
  /** Whether data is loading */
  loading: boolean;
  /** Last error if any */
  error: string | null;
  /** Last successful update timestamp */
  lastUpdate: string | null;
  /** WebSocket connection status */
  wsConnected: boolean;
  /** Display preferences */
  preferences: StatusBarPreferences;
}

/**
 * Default status bar preferences
 */
export const DEFAULT_STATUS_BAR_PREFERENCES: StatusBarPreferences = {
  collapsed: false,
  autoExpandOnUnhealthy: true,
  showDetailedMetrics: false,
  refreshIntervalMs: 30000,
  useWebSocket: true,
};

/**
 * Default unified health check configuration
 */
export const DEFAULT_UNIFIED_HEALTH_CONFIG: UnifiedHealthCheckConfig = {
  timeout: 10000,
  useCache: true,
  cacheTtlMs: 5000,
  parallel: true,
  maxConcurrent: 5,
};

/**
 * Service category mapping
 */
export const SERVICE_CATEGORY_MAP: Record<UnifiedServiceName, ServiceCategory> = {
  ssh: 'infrastructure',
  docker: 'infrastructure',
  kubernetes: 'infrastructure',
  postgresql: 'database',
  pgvector: 'database',
  valkey: 'database',
  openvscode: 'development',
  'ai-openai': 'ai-providers',
  'ai-anthropic': 'ai-providers',
  'ai-azure': 'ai-providers',
  'monitoring-datadog': 'monitoring',
  'monitoring-otel': 'monitoring',
};

/**
 * Category display names
 */
export const CATEGORY_DISPLAY_NAMES: Record<ServiceCategory, string> = {
  infrastructure: 'Infrastructure',
  database: 'Database Services',
  'ai-providers': 'AI Providers',
  monitoring: 'Monitoring',
  development: 'Development Tools',
};
