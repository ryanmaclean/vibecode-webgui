// import { logger } from '@/lib/logger';

/**
 * OpenTelemetry Configuration and Setup
 * Unified implementation combining robust error handling with full feature support
 * Provides vendor-neutral observability integration with Datadog and Prometheus
 */

import { getDatadogApiKey } from './datadog-env';
import { getSamplingConfig } from './sampling-config';

// Check if we're in a Docker build environment or should skip monitoring
const isDockerBuild = (
  process.env.DOCKER_BUILD === 'true' ||
  process.env.SKIP_MONITORING === 'true' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.OTEL_ENABLED === 'false' ||
  process.env.DD_ENABLED === 'false'
);

// Conditional imports with fallbacks
let NodeSDK: any = null;
let OTLPTraceExporter: any = null;
let PrometheusExporter: any = null;
let Resource: any = null;
let SEMRESATTRS_SERVICE_NAME: any = null;
let SEMRESATTRS_SERVICE_VERSION: any = null;
let TailBasedSampler: any = null;

// Individual instrumentation imports (replacing auto-instrumentations-node)
let HttpInstrumentation: any = null;
let ExpressInstrumentation: any = null;
let FsInstrumentation: any = null;
let DnsInstrumentation: any = null;
let NetInstrumentation: any = null;

// Safe import function with error handling
function safeImport(moduleName: string, exportName?: string): any {
  try {
    const moduleExports = require(moduleName);
    return exportName ? moduleExports[exportName] : moduleExports;
  } catch (error) {
    console.warn(`⚠️ OpenTelemetry module '${moduleName}' not available:`, (error as Error).message);
    return null;
  }
}

// Initialize imports with error handling
function initializeOtelImports(): boolean {
  if (isDockerBuild) {
    return false;
  }

  try {
    // Core SDK
    NodeSDK = safeImport('@opentelemetry/sdk-node', 'NodeSDK');

    // Exporters
    OTLPTraceExporter = safeImport('@opentelemetry/exporter-trace-otlp-http', 'OTLPTraceExporter');
    PrometheusExporter = safeImport('@opentelemetry/exporter-prometheus', 'PrometheusExporter');

    // Resources
    Resource = safeImport('@opentelemetry/resources', 'Resource');
    SEMRESATTRS_SERVICE_NAME = safeImport('@opentelemetry/semantic-conventions', 'SEMRESATTRS_SERVICE_NAME');
    SEMRESATTRS_SERVICE_VERSION = safeImport('@opentelemetry/semantic-conventions', 'SEMRESATTRS_SERVICE_VERSION');

    // Tail-based sampler (custom implementation)
    TailBasedSampler = safeImport('./tail-based-sampler', 'TailBasedSampler');

    // Selective instrumentations
    HttpInstrumentation = safeImport('@opentelemetry/instrumentation-http', 'HttpInstrumentation');
    ExpressInstrumentation = safeImport('@opentelemetry/instrumentation-express', 'ExpressInstrumentation');
    FsInstrumentation = safeImport('@opentelemetry/instrumentation-fs', 'FsInstrumentation');
    DnsInstrumentation = safeImport('@opentelemetry/instrumentation-dns', 'DnsInstrumentation');
    NetInstrumentation = safeImport('@opentelemetry/instrumentation-net', 'NetInstrumentation');

    // Check if core modules are available
    return !!(NodeSDK && Resource);
  } catch (error) {
    console.warn('⚠️ Failed to initialize OpenTelemetry imports:', (error as Error).message);
    return false;
  }
}

// Service configuration
const isServer = typeof window === 'undefined';
const serviceName = 'vibecode-webgui';
const serviceVersion = process.env.npm_package_version || '0.1.0';

let otelSDK: any = null;

// Create resource with fallback
function createResource(): any {
  if (!Resource) {
    return null;
  }

  try {
    const attributes: Record<string, string> = {
      'service.name': serviceName,
      'service.version': serviceVersion,
      'service.namespace': 'vibecode',
      'deployment.environment': process.env.NODE_ENV || 'development',
    };

    // Add semantic conventions if available
    if (SEMRESATTRS_SERVICE_NAME) {
      attributes[SEMRESATTRS_SERVICE_NAME] = serviceName;
    }
    if (SEMRESATTRS_SERVICE_VERSION) {
      attributes[SEMRESATTRS_SERVICE_VERSION] = serviceVersion;
    }

    return new Resource(attributes);
  } catch (error) {
    console.warn('⚠️ Failed to create OpenTelemetry resource:', (error as Error).message);
    return null;
  }
}

// Create selective instrumentations (no auto-instrumentations-node)
function createInstrumentations(): any[] {
  const instrumentations: any[] = [];

  try {
    // HTTP instrumentation with custom request hooks
    if (HttpInstrumentation) {
      instrumentations.push(new HttpInstrumentation({
        enabled: true,
        ignoreIncomingRequestHook: (request: any) => {
          // Ignore health checks and static assets
          const url = request.url || '';
          return url.includes('/favicon.ico') ||
                 url.includes('/health') ||
                 url.includes('/api/health') ||
                 url.includes('/_next/');
        },
        requestHook: (span: any, request: any) => {
          // Add custom attributes to HTTP spans
          span.setAttributes({
            'vibecode.request.user_agent': request.headers?.['user-agent'] || 'unknown',
            'vibecode.request.method': request.method || 'unknown',
          });
        },
      }));
    }

    // Express instrumentation
    if (ExpressInstrumentation) {
      instrumentations.push(new ExpressInstrumentation({
        enabled: true,
        ignoreLayersType: ['middleware'],
      }));
    }

    // FS instrumentation (only in production to reduce noise)
    if (FsInstrumentation && process.env.NODE_ENV === 'production') {
      instrumentations.push(new FsInstrumentation({
        enabled: true,
      }));
    }

    // DNS instrumentation (only in production)
    if (DnsInstrumentation && process.env.NODE_ENV === 'production') {
      instrumentations.push(new DnsInstrumentation({
        enabled: true,
      }));
    }

    // Net instrumentation (only in production)
    if (NetInstrumentation && process.env.NODE_ENV === 'production') {
      instrumentations.push(new NetInstrumentation({
        enabled: true,
      }));
    }

    return instrumentations;
  } catch (error) {
    console.warn('⚠️ Failed to create instrumentations:', (error as Error).message);
    return [];
  }
}

// Create OTLP trace exporter with Datadog support
function createOTLPExporter(): any {
  if (!OTLPTraceExporter) {
    return null;
  }

  try {
    const ddApiKey = getDatadogApiKey();
    return new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
      headers: {
        // Support for Datadog Agent OTLP ingestion
        ...(ddApiKey && {
          'DD-API-KEY': ddApiKey,
        }),
      },
    });
  } catch (error) {
    console.warn('⚠️ Failed to create OTLP trace exporter:', (error as Error).message);
    return null;
  }
}

// Create Prometheus metrics exporter
function createPrometheusExporter(): any {
  if (!PrometheusExporter) {
    return null;
  }

  try {
    return new PrometheusExporter({
      port: parseInt(process.env.OTEL_PROMETHEUS_PORT || '9090'),
      endpoint: process.env.OTEL_PROMETHEUS_ENDPOINT || '/metrics',
    }, () => {
      // Prometheus exporter started
    });
  } catch (error) {
    console.warn('⚠️ Failed to create Prometheus exporter:', (error as Error).message);
    return null;
  }
}

// Create tail-based sampler with OTLP exporter
function createTailBasedSampler(otlpExporter: any): any {
  if (!TailBasedSampler || !otlpExporter) {
    return null;
  }

  try {
    const samplingConfig = getSamplingConfig();
    return new TailBasedSampler(otlpExporter, {
      errorSampleRate: samplingConfig.errorSampleRate,
      defaultSampleRate: samplingConfig.defaultSampleRate,
      bufferTimeout: samplingConfig.bufferTimeout,
      maxBufferSize: samplingConfig.maxBufferSize,
    });
  } catch (error) {
    console.warn('⚠️ Failed to create tail-based sampler:', (error as Error).message);
    return null;
  }
}

/**
 * Initialize OpenTelemetry instrumentation
 */
export function initializeOpenTelemetry() {
  if (!isServer || otelSDK || isDockerBuild) {
    if (isDockerBuild) {
      // Skipping in Docker build environment
    }
    return otelSDK;
  }

  // Initialize imports
  if (!initializeOtelImports()) {
    console.warn('⚠️ OpenTelemetry dependencies not available, monitoring will be limited');
    return null;
  }

  // Check if all required modules are available
  if (!NodeSDK || !Resource || !TailBasedSampler) {
    return null;
  }

  try {
    // Configure resource attributes
    const resource = createResource();
    if (!resource) {
      return null;
    }

    // Configure OTLP exporter (for Datadog and other OTLP-compatible backends)
    const otlpExporter = createOTLPExporter();
    if (!otlpExporter) {
      return null;
    }

    // Configure Prometheus metrics exporter
    const prometheusExporter = createPrometheusExporter();

    // Configure tail-based sampler with OTLP exporter
    const tailBasedSampler = createTailBasedSampler(otlpExporter);
    if (!tailBasedSampler) {
      return null;
    }

    // Create selective instrumentations
    const instrumentations = createInstrumentations();

    // Initialize SDK with auto-instrumentation
    otelSDK = new NodeSDK({
      resource,
      spanProcessor: tailBasedSampler,
      metricReader: prometheusExporter,
      instrumentations,
    });

    // Start the SDK
    otelSDK.start();

    return otelSDK;

  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', error);
    return null;
  }
}

/**
 * Gracefully shutdown OpenTelemetry
 */
export async function shutdownOpenTelemetry() {
  if (otelSDK) {
    try {
      await otelSDK.shutdown();
    } catch (error) {
      console.error('❌ Error shutting down OpenTelemetry:', error);
    }
  }
}

/**
 * Get current OpenTelemetry configuration
 */
export function getOpenTelemetryConfig() {
  return {
    initialized: !!otelSDK,
    service_name: serviceName,
    service_version: serviceVersion,
    environment: process.env.NODE_ENV || 'development',
    otlp_endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
    prometheus_port: process.env.OTEL_PROMETHEUS_PORT || '9090',
    datadog_integration: !!getDatadogApiKey(),
    database_instrumentation: {
      enabled: true,
      enhanced_reporting: true,
      query_sanitization: true,
      span_correlation: true,
    },
  };
}

/**
 * Health check function
 */
export function checkOpenTelemetryHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
} {
  const details: Record<string, any> = {};

  // Check if core modules are available
  const coreModules = {
    'NodeSDK': !!NodeSDK,
    'Resource': !!Resource,
    'TailBasedSampler': !!TailBasedSampler,
  };

  details.coreModules = coreModules;
  details.exporters = {
    'Prometheus': !!PrometheusExporter,
    'OTLP': !!OTLPTraceExporter,
  };

  details.instrumentations = {
    'HTTP': !!HttpInstrumentation,
    'Express': !!ExpressInstrumentation,
    'FS': !!FsInstrumentation,
    'DNS': !!DnsInstrumentation,
    'Net': !!NetInstrumentation,
  };

  // Add sampling configuration status
  const samplingConfig = getSamplingConfig();
  details.samplingEnabled = samplingConfig.enabled;
  details.samplingConfig = {
    errorSampleRate: samplingConfig.errorSampleRate,
    defaultSampleRate: samplingConfig.defaultSampleRate,
    bufferTimeout: samplingConfig.bufferTimeout,
    maxBufferSize: samplingConfig.maxBufferSize,
    rules: samplingConfig.rules,
  };

  // Determine health status
  const coreAvailable = Object.values(coreModules).every(Boolean);
  const hasExporter = Object.values(details.exporters).some(Boolean);

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (coreAvailable && hasExporter) {
    status = 'healthy';
  } else if (coreAvailable || hasExporter) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return { status, details };
}

// Export configuration for external use
export const otelConfig = {
  isEnabled: () => process.env.OTEL_ENABLED !== 'false',
  getEndpoint: () => process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
  getPrometheusPort: () => process.env.OTEL_PROMETHEUS_PORT || '9090',
  getResource: createResource,
  checkHealth: checkOpenTelemetryHealth,
  getSamplingConfig: getSamplingConfig,
  isSamplingEnabled: () => getSamplingConfig().enabled,
};

// Re-export span creation utilities from trace-context
export { createCustomSpan } from './trace-context';

// Export SDK instance for testing/debugging
export { otelSDK };
