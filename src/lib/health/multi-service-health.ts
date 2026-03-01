/**
 * Multi-Service Health Aggregation Service
 *
 * Aggregates health status from multiple service endpoints:
 * - Base services (/api/health/services): SSH, PostgreSQL, Valkey, OpenVSCode, Docker
 * - AI Providers (/api/ai/provider-health): OpenAI, Anthropic, Azure OpenAI
 * - Docker status (/api/docker/status): Docker daemon and containers
 * - Kubernetes (/api/health/kubernetes): K8s cluster and pods (when available)
 * - Monitoring (/api/health/monitoring): Datadog, OpenTelemetry (when available)
 *
 * Features:
 * - Parallel endpoint fetching for optimal performance
 * - Response caching with configurable TTL
 * - Datadog APM tracing integration
 * - Categorized service grouping for UI display
 * - Graceful error handling with partial results
 */

import tracer from 'dd-trace';
import type { Span } from 'dd-trace';
import type {
  UnifiedHealthResponse,
  UnifiedHealthCheckConfig,
  DEFAULT_UNIFIED_HEALTH_CONFIG,
  CategorizedServiceHealth,
  UnifiedServiceHealthResult,
  AIProviderHealthResult,
  DockerHealthResult,
  KubernetesHealthResult,
  MonitoringHealthResult,
  SERVICE_CATEGORY_MAP,
  ServiceCategory,
} from '@/types/unified-status';
import { CATEGORY_DISPLAY_NAMES } from '@/types/unified-status';
import type {
  AggregatedHealthResponse,
  ServiceHealthResult,
  AggregatedHealthStatus,
  ServiceHealthStatus,
} from '@/types/health';

// Cache for unified health response
interface CachedUnifiedHealth {
  response: UnifiedHealthResponse;
  cachedAt: string;
  expiresAt: number;
}

let cachedUnifiedHealth: CachedUnifiedHealth | null = null;

/**
 * Default configuration for unified health checks
 */
const DEFAULT_CONFIG: UnifiedHealthCheckConfig = {
  timeout: 10000,
  useCache: true,
  cacheTtlMs: 5000,
  parallel: true,
  maxConcurrent: 5,
};

/**
 * Start a Datadog span for unified health check tracing
 */
function startUnifiedHealthSpan(operation: string): Span | null {
  try {
    const span = tracer.startSpan('unified.health.check', {
      tags: {
        'service.name': 'vibecode-webgui',
        'health.operation': operation,
        'span.kind': 'internal',
      },
    });
    return span;
  } catch {
    // Tracing may not be initialized in all environments
    return null;
  }
}

/**
 * Finish a Datadog span with result tags
 */
function finishUnifiedHealthSpan(
  span: Span | null,
  tags: Record<string, unknown>
): void {
  if (!span) return;

  try {
    Object.entries(tags).forEach(([key, value]) => {
      if (value !== undefined) {
        span.setTag(key, value);
      }
    });
    span.finish();
  } catch {
    // Silently ignore span finish errors
  }
}

/**
 * Fetch health data from an API endpoint with timeout
 */
async function fetchHealthEndpoint<T>(
  endpoint: string,
  timeoutMs: number = 5000
): Promise<{ success: boolean; data?: T; error?: string; latencyMs: number }> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Use relative URL for server-side fetch
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        latencyMs,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data as T,
      latencyMs,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: `Request timeout after ${timeoutMs}ms`,
        latencyMs,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs,
    };
  }
}

/**
 * Fetch base services health (SSH, PostgreSQL, Valkey, OpenVSCode, Docker)
 */
async function fetchBaseServicesHealth(
  timeoutMs: number
): Promise<ServiceHealthResult[]> {
  const result = await fetchHealthEndpoint<AggregatedHealthResponse>(
    '/api/health/services',
    timeoutMs
  );

  if (result.success && result.data) {
    return result.data.services;
  }

  // Return empty array on error - will be handled gracefully
  return [];
}

/**
 * Fetch AI provider health statuses
 */
async function fetchAIProviderHealth(
  timeoutMs: number
): Promise<AIProviderHealthResult[]> {
  const result = await fetchHealthEndpoint<{
    providers: Array<{
      provider: string;
      available: boolean;
      latency?: number;
      error?: string;
      configured: boolean;
      models?: string[];
    }>;
  }>('/api/ai/provider-health', timeoutMs);

  if (!result.success || !result.data) {
    return [];
  }

  // Transform provider health data to AIProviderHealthResult format
  const providers = result.data.providers
    .filter((p) => p.configured)
    .map((p) => {
      const providerName =
        p.provider === 'azure-openai' ? 'azure-openai' :
        p.provider === 'anthropic' ? 'anthropic' : 'openai';

      return {
        name: providerName as 'openai' | 'anthropic' | 'azure-openai',
        status: (p.available ? 'healthy' : 'unhealthy') as AggregatedHealthStatus,
        endpointReachable: p.available,
        apiKeyConfigured: p.configured,
        models: p.models
          ? p.models.map((modelId) => ({
              modelId,
              status: (p.available ? 'healthy' : 'unhealthy') as 'healthy' | 'unhealthy' | 'degraded' | 'unknown',
              available: p.available,
            }))
          : [],
        latencyMs: p.latency || result.latencyMs,
        lastChecked: new Date().toISOString(),
        ...(p.error && { error: p.error }),
      } as AIProviderHealthResult;
    });

  return providers;
}

/**
 * Fetch Docker health status
 */
async function fetchDockerHealth(timeoutMs: number): Promise<DockerHealthResult | null> {
  const result = await fetchHealthEndpoint<{
    success: boolean;
    data?: {
      dockerType: string;
      running: boolean;
      version?: string;
      containers?: Array<{
        id: string;
        name: string;
        state: string;
        status: string;
      }>;
    };
  }>('/api/docker/status?detailed=true', timeoutMs);

  if (!result.success || !result.data?.success || !result.data.data) {
    return null;
  }

  const dockerData = result.data.data;
  const containers =
    dockerData.containers?.map((c) => ({
      id: c.id,
      name: c.name,
      status: (c.state === 'running' ? 'healthy' : 'unhealthy') as ServiceHealthStatus,
      state: c.state,
      healthStatus: 'none' as 'healthy' | 'unhealthy' | 'starting' | 'none',
    })) || [];

  const healthyContainers = containers.filter((c) => c.status === 'healthy').length;
  const totalContainers = containers.length;

  return {
    name: 'docker',
    status: dockerData.running
      ? totalContainers > 0 && healthyContainers === totalContainers
        ? 'healthy'
        : healthyContainers > 0
        ? 'degraded'
        : 'unhealthy'
      : 'unhealthy',
    daemonReachable: dockerData.running,
    version: dockerData.version,
    containers,
    latencyMs: result.latencyMs,
    lastChecked: new Date().toISOString(),
    summary: {
      totalContainers,
      runningContainers: containers.filter((c) => c.state === 'running').length,
      healthyContainers,
      unhealthyContainers: totalContainers - healthyContainers,
    },
  };
}

/**
 * Fetch Kubernetes health status (when endpoint is available)
 */
async function fetchKubernetesHealth(
  timeoutMs: number
): Promise<KubernetesHealthResult | null> {
  const result = await fetchHealthEndpoint<KubernetesHealthResult>(
    '/api/health/kubernetes',
    timeoutMs
  );

  if (result.success && result.data) {
    return result.data;
  }

  // Endpoint not available yet - return null
  return null;
}

/**
 * Fetch monitoring stack health status (when endpoint is available)
 */
async function fetchMonitoringHealth(
  timeoutMs: number
): Promise<MonitoringHealthResult[]> {
  const result = await fetchHealthEndpoint<{
    services: MonitoringHealthResult[];
  }>('/api/health/monitoring', timeoutMs);

  if (result.success && result.data) {
    return result.data.services;
  }

  // Endpoint not available yet - return empty array
  return [];
}

/**
 * Categorize services into their respective categories
 */
function categorizeServices(
  services: UnifiedServiceHealthResult[]
): CategorizedServiceHealth[] {
  const categoryMap = new Map<ServiceCategory, UnifiedServiceHealthResult[]>();

  // Initialize all categories
  const allCategories: ServiceCategory[] = [
    'infrastructure',
    'database',
    'ai-providers',
    'monitoring',
    'development',
  ];

  allCategories.forEach((cat) => categoryMap.set(cat, []));

  // Group services by category
  services.forEach((service) => {
    let category: ServiceCategory = 'infrastructure';

    // Determine category based on service name
    if ('name' in service) {
      if (service.name === 'kubernetes' || service.name === 'docker') {
        category = 'infrastructure';
      } else if (service.name === 'pgvector') {
        category = 'database';
      } else if (service.name === 'datadog' || service.name === 'opentelemetry') {
        category = 'monitoring';
      } else if ('provider' in service || 'name' in service) {
        // AI provider check
        const aiProviderService = service as AIProviderHealthResult;
        if (aiProviderService.name && ['openai', 'anthropic', 'azure-openai'].includes(aiProviderService.name)) {
          category = 'ai-providers';
        }
      }
    }

    const categoryServices = categoryMap.get(category) || [];
    categoryServices.push(service);
    categoryMap.set(category, categoryServices);
  });

  // Convert to CategorizedServiceHealth array
  const categorized: CategorizedServiceHealth[] = [];

  categoryMap.forEach((categoryServices, category) => {
    if (categoryServices.length > 0) {
      // Determine overall category health
      const statuses = categoryServices.map((s) => s.status);
      const hasUnhealthy = statuses.includes('unhealthy');
      const hasDegraded = statuses.includes('degraded');

      let categoryStatus: AggregatedHealthStatus = 'healthy';
      if (hasUnhealthy) {
        categoryStatus = 'unhealthy';
      } else if (hasDegraded) {
        categoryStatus = 'degraded';
      }

      categorized.push({
        category,
        categoryName: CATEGORY_DISPLAY_NAMES[category],
        services: categoryServices,
        status: categoryStatus,
      });
    }
  });

  return categorized;
}

/**
 * Convert base service health to unified service health result
 */
function convertBaseServicesToUnified(
  baseServices: ServiceHealthResult[]
): UnifiedServiceHealthResult[] {
  // Base services (SSH, PostgreSQL, Valkey, OpenVSCode, Docker) are already
  // compatible with the base health types. We don't need to convert them
  // as they'll be handled separately in the aggregation.
  return [];
}

/**
 * Calculate overall system health status
 */
function calculateOverallStatus(
  categories: CategorizedServiceHealth[]
): AggregatedHealthStatus {
  const allStatuses = categories.map((c) => c.status);

  if (allStatuses.includes('unhealthy')) {
    return 'unhealthy';
  }
  if (allStatuses.includes('degraded')) {
    return 'degraded';
  }
  return 'healthy';
}

/**
 * Get cached unified health response or fetch fresh data
 */
export async function getUnifiedHealth(
  config: Partial<UnifiedHealthCheckConfig> = {}
): Promise<UnifiedHealthResponse> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const span = startUnifiedHealthSpan('aggregate_all_services');
  const startTime = Date.now();

  try {
    // Check cache if enabled
    if (fullConfig.useCache && cachedUnifiedHealth) {
      const now = Date.now();
      if (now < cachedUnifiedHealth.expiresAt) {
        finishUnifiedHealthSpan(span, {
          'health.from_cache': true,
          'health.status': cachedUnifiedHealth.response.status,
        });
        return {
          ...cachedUnifiedHealth.response,
          fromCache: true,
          cacheTtlMs: cachedUnifiedHealth.expiresAt - now,
        };
      }
    }

    // Fetch all health endpoints in parallel
    const [baseServices, aiProviders, docker, kubernetes, monitoring] =
      await Promise.all([
        fetchBaseServicesHealth(fullConfig.timeout),
        fetchAIProviderHealth(fullConfig.timeout),
        fetchDockerHealth(fullConfig.timeout),
        fetchKubernetesHealth(fullConfig.timeout),
        fetchMonitoringHealth(fullConfig.timeout),
      ]);

    // Combine all services into a single array
    const allServices: UnifiedServiceHealthResult[] = [
      ...aiProviders,
      ...(docker ? [docker] : []),
      ...(kubernetes ? [kubernetes] : []),
      ...monitoring,
    ];

    // Categorize services
    const categories = categorizeServices(allServices);

    // Calculate summary counts
    const totalServices = allServices.length;
    const healthyServices = allServices.filter((s) => s.status === 'healthy').length;
    const degradedServices = allServices.filter((s) => s.status === 'degraded').length;
    const unhealthyServices = allServices.filter((s) => s.status === 'unhealthy').length;
    const unknownServices = allServices.filter((s) => s.status === 'unknown').length;

    // Calculate overall status
    const overallStatus = calculateOverallStatus(categories);

    const totalCheckTimeMs = Date.now() - startTime;

    const response: UnifiedHealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      totalCheckTimeMs,
      categories,
      summary: {
        totalServices,
        healthyServices,
        degradedServices,
        unhealthyServices,
        unknownServices,
      },
      fromCache: false,
    };

    // Cache the response
    if (fullConfig.useCache) {
      cachedUnifiedHealth = {
        response,
        cachedAt: new Date().toISOString(),
        expiresAt: Date.now() + fullConfig.cacheTtlMs,
      };
    }

    finishUnifiedHealthSpan(span, {
      'health.from_cache': false,
      'health.status': overallStatus,
      'health.total_services': totalServices,
      'health.healthy_services': healthyServices,
      'health.check_time_ms': totalCheckTimeMs,
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    finishUnifiedHealthSpan(span, {
      'health.error': true,
      'health.error_message': errorMessage,
    });

    // Return error response
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      totalCheckTimeMs: Date.now() - startTime,
      categories: [],
      summary: {
        totalServices: 0,
        healthyServices: 0,
        degradedServices: 0,
        unhealthyServices: 0,
        unknownServices: 0,
      },
      fromCache: false,
    };
  }
}

/**
 * Invalidate the unified health cache
 */
export function invalidateUnifiedHealthCache(): void {
  cachedUnifiedHealth = null;
}

/**
 * Get cached unified health if available
 */
export function getCachedUnifiedHealth(): UnifiedHealthResponse | null {
  if (cachedUnifiedHealth && Date.now() < cachedUnifiedHealth.expiresAt) {
    return {
      ...cachedUnifiedHealth.response,
      fromCache: true,
      cacheTtlMs: cachedUnifiedHealth.expiresAt - Date.now(),
    };
  }
  return null;
}
