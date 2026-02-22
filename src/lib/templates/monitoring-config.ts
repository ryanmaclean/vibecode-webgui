/**
 * Monitoring Configuration Templates
 * Provides pre-configured monitoring setups for Datadog, Prometheus, and other monitoring systems
 */

/**
 * Supported monitoring systems
 */
export type MonitoringProvider = 'datadog' | 'prometheus' | 'grafana' | 'newrelic' | 'custom';

/**
 * Monitoring metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Base monitoring configuration interface
 */
export interface MonitoringConfig {
  provider: MonitoringProvider;
  enabled: boolean;
  environment: string;
  serviceName: string;
  tags?: Record<string, string>;
  samplingRate?: number;
}

/**
 * Datadog specific configuration
 */
export interface DatadogConfig extends MonitoringConfig {
  provider: 'datadog';
  apiKey?: string;
  appKey?: string;
  host?: string;
  port?: number;
  agentHost?: string;
  statsdPort?: number;
  traceEnabled?: boolean;
  profilingEnabled?: boolean;
  logInjection?: boolean;
}

/**
 * Prometheus specific configuration
 */
export interface PrometheusConfig extends MonitoringConfig {
  provider: 'prometheus';
  metricsPath?: string;
  metricsPort?: number;
  scrapeInterval?: string;
  scrapeTimeout?: string;
  labels?: Record<string, string>;
}

/**
 * Grafana specific configuration
 */
export interface GrafanaConfig extends MonitoringConfig {
  provider: 'grafana';
  apiUrl?: string;
  apiKey?: string;
  orgId?: number;
  dashboardId?: string;
  datasource?: string;
}

/**
 * New Relic specific configuration
 */
export interface NewRelicConfig extends MonitoringConfig {
  provider: 'newrelic';
  licenseKey?: string;
  appName?: string;
  region?: 'us' | 'eu';
  distributedTracingEnabled?: boolean;
}

/**
 * Monitoring metric definition
 */
export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  tags?: string[];
}

/**
 * Template-specific monitoring configuration
 */
export interface TemplateMonitoringConfig {
  defaultProvider: MonitoringProvider;
  configs: {
    datadog?: Partial<DatadogConfig>;
    prometheus?: Partial<PrometheusConfig>;
    grafana?: Partial<GrafanaConfig>;
    newrelic?: Partial<NewRelicConfig>;
  };
  metrics: MetricDefinition[];
  dashboards?: string[];
  alerts?: AlertDefinition[];
}

/**
 * Alert definition for monitoring systems
 */
export interface AlertDefinition {
  name: string;
  description: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notificationChannels?: string[];
}

/**
 * Default Datadog configuration template
 */
export const DEFAULT_DATADOG_CONFIG: DatadogConfig = {
  provider: 'datadog',
  enabled: true,
  environment: process.env.NODE_ENV || 'development',
  serviceName: 'vibecode-service',
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: parseInt(process.env.DD_DOGSTATSD_PORT || '8125'),
  statsdPort: 8125,
  traceEnabled: true,
  profilingEnabled: false,
  logInjection: true,
  samplingRate: 1.0,
  tags: {
    env: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  },
};

/**
 * Default Prometheus configuration template
 */
export const DEFAULT_PROMETHEUS_CONFIG: PrometheusConfig = {
  provider: 'prometheus',
  enabled: true,
  environment: process.env.NODE_ENV || 'development',
  serviceName: 'vibecode-service',
  metricsPath: '/metrics',
  metricsPort: 9090,
  scrapeInterval: '15s',
  scrapeTimeout: '10s',
  labels: {
    job: 'vibecode',
    environment: process.env.NODE_ENV || 'development',
  },
};

/**
 * Default Grafana configuration template
 */
export const DEFAULT_GRAFANA_CONFIG: GrafanaConfig = {
  provider: 'grafana',
  enabled: true,
  environment: process.env.NODE_ENV || 'development',
  serviceName: 'vibecode-service',
  apiUrl: process.env.GRAFANA_API_URL || 'http://localhost:3000',
  datasource: 'Prometheus',
};

/**
 * Default New Relic configuration template
 */
export const DEFAULT_NEWRELIC_CONFIG: NewRelicConfig = {
  provider: 'newrelic',
  enabled: true,
  environment: process.env.NODE_ENV || 'development',
  serviceName: 'vibecode-service',
  region: 'us',
  distributedTracingEnabled: true,
  samplingRate: 1.0,
};

/**
 * Common metrics for web applications
 */
export const WEB_APPLICATION_METRICS: MetricDefinition[] = [
  {
    name: 'http.requests.total',
    type: 'counter',
    description: 'Total number of HTTP requests',
    tags: ['method', 'status', 'endpoint'],
  },
  {
    name: 'http.request.duration',
    type: 'histogram',
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
    tags: ['method', 'endpoint'],
  },
  {
    name: 'http.response.size',
    type: 'histogram',
    description: 'HTTP response size in bytes',
    unit: 'bytes',
    tags: ['endpoint'],
  },
  {
    name: 'http.errors.total',
    type: 'counter',
    description: 'Total number of HTTP errors',
    tags: ['status', 'endpoint'],
  },
  {
    name: 'app.active.users',
    type: 'gauge',
    description: 'Number of active users',
  },
];

/**
 * Common metrics for database operations
 */
export const DATABASE_METRICS: MetricDefinition[] = [
  {
    name: 'db.queries.total',
    type: 'counter',
    description: 'Total number of database queries',
    tags: ['operation', 'table'],
  },
  {
    name: 'db.query.duration',
    type: 'histogram',
    description: 'Database query duration in milliseconds',
    unit: 'ms',
    tags: ['operation', 'table'],
  },
  {
    name: 'db.connections.active',
    type: 'gauge',
    description: 'Number of active database connections',
  },
  {
    name: 'db.connections.idle',
    type: 'gauge',
    description: 'Number of idle database connections',
  },
  {
    name: 'db.errors.total',
    type: 'counter',
    description: 'Total number of database errors',
    tags: ['operation', 'error_type'],
  },
];

/**
 * Common metrics for AI/ML operations
 */
export const AI_ML_METRICS: MetricDefinition[] = [
  {
    name: 'ai.inference.duration',
    type: 'histogram',
    description: 'AI model inference duration in milliseconds',
    unit: 'ms',
    tags: ['model', 'operation'],
  },
  {
    name: 'ai.tokens.total',
    type: 'counter',
    description: 'Total number of tokens processed',
    tags: ['model', 'operation'],
  },
  {
    name: 'ai.cost.total',
    type: 'counter',
    description: 'Total AI API cost',
    unit: 'usd',
    tags: ['model', 'provider'],
  },
  {
    name: 'ai.errors.total',
    type: 'counter',
    description: 'Total number of AI operation errors',
    tags: ['model', 'error_type'],
  },
];

/**
 * Generate monitoring configuration for a specific provider
 */
export function generateMonitoringConfig(
  provider: MonitoringProvider,
  options?: Partial<MonitoringConfig>
): MonitoringConfig {
  const baseConfig = {
    enabled: true,
    environment: process.env.NODE_ENV || 'development',
    serviceName: 'vibecode-service',
    ...options,
  };

  switch (provider) {
    case 'datadog':
      return { ...DEFAULT_DATADOG_CONFIG, ...baseConfig };
    case 'prometheus':
      return { ...DEFAULT_PROMETHEUS_CONFIG, ...baseConfig };
    case 'grafana':
      return { ...DEFAULT_GRAFANA_CONFIG, ...baseConfig };
    case 'newrelic':
      return { ...DEFAULT_NEWRELIC_CONFIG, ...baseConfig };
    default:
      return {
        provider: 'custom',
        ...baseConfig,
      };
  }
}

/**
 * Get metrics for a specific template category
 */
export function getMetricsForCategory(category: string): MetricDefinition[] {
  const baseMetrics = [...WEB_APPLICATION_METRICS];

  switch (category) {
    case 'backend':
    case 'fullstack':
      return [...baseMetrics, ...DATABASE_METRICS];
    case 'data':
      return [...baseMetrics, ...AI_ML_METRICS, ...DATABASE_METRICS];
    case 'frontend':
      return baseMetrics.filter((m) =>
        m.name.startsWith('http.') || m.name.startsWith('app.')
      );
    default:
      return baseMetrics;
  }
}

/**
 * Generate environment variables for monitoring configuration
 */
export function generateMonitoringEnvVars(provider: MonitoringProvider): Array<{
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  example?: string;
}> {
  switch (provider) {
    case 'datadog':
      return [
        {
          name: 'DD_AGENT_HOST',
          description: 'Datadog agent host',
          required: true,
          defaultValue: 'localhost',
          example: 'localhost',
        },
        {
          name: 'DD_DOGSTATSD_PORT',
          description: 'Datadog StatsD port',
          required: false,
          defaultValue: '8125',
          example: '8125',
        },
        {
          name: 'DD_API_KEY',
          description: 'Datadog API key',
          required: true,
          example: 'your-datadog-api-key',
        },
        {
          name: 'DD_TRACE_ENABLED',
          description: 'Enable Datadog tracing',
          required: false,
          defaultValue: 'true',
          example: 'true',
        },
      ];
    case 'prometheus':
      return [
        {
          name: 'PROMETHEUS_METRICS_PORT',
          description: 'Port for Prometheus metrics endpoint',
          required: false,
          defaultValue: '9090',
          example: '9090',
        },
        {
          name: 'PROMETHEUS_METRICS_PATH',
          description: 'Path for Prometheus metrics endpoint',
          required: false,
          defaultValue: '/metrics',
          example: '/metrics',
        },
      ];
    case 'grafana':
      return [
        {
          name: 'GRAFANA_API_URL',
          description: 'Grafana API URL',
          required: true,
          example: 'http://localhost:3000',
        },
        {
          name: 'GRAFANA_API_KEY',
          description: 'Grafana API key',
          required: true,
          example: 'your-grafana-api-key',
        },
      ];
    case 'newrelic':
      return [
        {
          name: 'NEW_RELIC_LICENSE_KEY',
          description: 'New Relic license key',
          required: true,
          example: 'your-newrelic-license-key',
        },
        {
          name: 'NEW_RELIC_APP_NAME',
          description: 'New Relic application name',
          required: true,
          example: 'vibecode-service',
        },
      ];
    default:
      return [];
  }
}

/**
 * Validate monitoring configuration
 */
export function validateMonitoringConfig(
  config: MonitoringConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.provider) {
    errors.push('Monitoring provider is required');
  }

  if (!config.serviceName) {
    errors.push('Service name is required');
  }

  if (!config.environment) {
    errors.push('Environment is required');
  }

  if (config.samplingRate !== undefined) {
    if (config.samplingRate < 0 || config.samplingRate > 1) {
      errors.push('Sampling rate must be between 0 and 1');
    }
  }

  // Provider-specific validation
  if (config.provider === 'datadog') {
    const ddConfig = config as DatadogConfig;
    if (ddConfig.enabled && !ddConfig.apiKey && !process.env.DD_API_KEY) {
      errors.push('Datadog API key is required when monitoring is enabled');
    }
  }

  if (config.provider === 'newrelic') {
    const nrConfig = config as NewRelicConfig;
    if (nrConfig.enabled && !nrConfig.licenseKey && !process.env.NEW_RELIC_LICENSE_KEY) {
      errors.push('New Relic license key is required when monitoring is enabled');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a complete template monitoring configuration
 */
export function createTemplateMonitoringConfig(
  provider: MonitoringProvider,
  category: string,
  options?: Partial<TemplateMonitoringConfig>
): TemplateMonitoringConfig {
  const baseConfig = generateMonitoringConfig(provider);
  const metrics = getMetricsForCategory(category);

  return {
    defaultProvider: provider,
    configs: {
      [provider]: baseConfig,
    },
    metrics,
    dashboards: options?.dashboards || [],
    alerts: options?.alerts || [],
    ...options,
  };
}
