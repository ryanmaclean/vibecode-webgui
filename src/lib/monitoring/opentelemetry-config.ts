/**
 * OpenTelemetry Configuration with Dependency Error Handling
 * 
 * This module provides a robust OpenTelemetry setup that gracefully handles
 * missing dependencies and version conflicts.
 */

// Conditional imports with fallbacks
let NodeSDK: any = null;
let getNodeAutoInstrumentations: any = null;
let PeriodicExportingMetricReader: any = null;
let PrometheusExporter: any = null;
let OTLPTraceExporter: any = null;
let OTLPMetricExporter: any = null;
let Resource: any = null;
let SEMRESATTRS_SERVICE_NAME: any = null;
let SEMRESATTRS_SERVICE_VERSION: any = null;

// Safe import function
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
  try {
    NodeSDK = safeImport('@opentelemetry/sdk-node', 'NodeSDK');
    getNodeAutoInstrumentations = safeImport('@opentelemetry/auto-instrumentations-node', 'getNodeAutoInstrumentations');
    
    // Metrics
    PeriodicExportingMetricReader = safeImport('@opentelemetry/sdk-metrics', 'PeriodicExportingMetricReader');
    PrometheusExporter = safeImport('@opentelemetry/exporter-prometheus', 'PrometheusExporter');
    
    // Exporters
    OTLPTraceExporter = safeImport('@opentelemetry/exporter-otlp-http', 'OTLPTraceExporter');
    OTLPMetricExporter = safeImport('@opentelemetry/exporter-otlp-http', 'OTLPMetricExporter');
    
    // Resources
    Resource = safeImport('@opentelemetry/resources', 'Resource');
    SEMRESATTRS_SERVICE_NAME = safeImport('@opentelemetry/semantic-conventions', 'SEMRESATTRS_SERVICE_NAME');
    SEMRESATTRS_SERVICE_VERSION = safeImport('@opentelemetry/semantic-conventions', 'SEMRESATTRS_SERVICE_VERSION');
    
    // Check if core modules are available
    return !!(NodeSDK && Resource);
  } catch (error) {
    console.warn('⚠️ Failed to initialize OpenTelemetry imports:', (error as Error).message);
    return false;
  }
}

// Create resource with fallback
function createResource(): any {
  if (!Resource) {
    return null;
  }
  
  try {
    const attributes: Record<string, string> = {
      'service.name': 'vibecode-webgui',
      'service.version': process.env.npm_package_version || '1.0.0',
      'service.environment': process.env.NODE_ENV || 'development',
    };
    
    // Add semantic conventions if available
    if (SEMRESATTRS_SERVICE_NAME) {
      attributes[SEMRESATTRS_SERVICE_NAME] = 'vibecode-webgui';
    }
    if (SEMRESATTRS_SERVICE_VERSION) {
      attributes[SEMRESATTRS_SERVICE_VERSION] = process.env.npm_package_version || '1.0.0';
    }
    
    return new Resource(attributes);
  } catch (error) {
    console.warn('⚠️ Failed to create OpenTelemetry resource:', (error as Error).message);
    return null;
  }
}

// Create instrumentations with fallback
function createInstrumentations(): any[] {
  if (!getNodeAutoInstrumentations) {
    console.warn('⚠️ Auto-instrumentations not available, using empty array');
    return [];
  }
  
  try {
    return getNodeAutoInstrumentations({
      // Disable problematic instrumentations
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Can be noisy in development
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: process.env.NODE_ENV === 'production',
      },
      // Configure HTTP instrumentation
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoringUrls: [
          /^\/favicon\.ico/,
          /^\/health/,
          /^\/api\/health/,
          /^\/_next/,
        ],
      },
      // Configure Express instrumentation
      '@opentelemetry/instrumentation-express': {
        enabled: true,
        ignoredRoutes: [/^\/_next/, /^\/api\/health/],
      },
    });
  } catch (error) {
    console.warn('⚠️ Failed to create auto-instrumentations:', (error as Error).message);
    return [];
  }
}

// Create metric readers with fallback
function createMetricReaders(): any[] {
  const readers: any[] = [];
  
  // Prometheus exporter
  if (PrometheusExporter) {
    try {
      readers.push(new PrometheusExporter({
        port: Number(process.env.PROMETHEUS_PORT) || 9090,
        endpoint: '/metrics',
      }));
      // Debug log removed
    } catch (error) {
      console.warn('⚠️ Failed to create Prometheus exporter:', (error as Error).message);
    }
  }
  
  // OTLP exporter (if configured)
  if (OTLPMetricExporter && PeriodicExportingMetricReader && process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    try {
      readers.push(new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
          headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? 
            JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {},
        }),
        exportIntervalMillis: 30000, // 30 seconds
      }));
      // Debug log removed
    } catch (error) {
      console.warn('⚠️ Failed to create OTLP metrics exporter:', (error as Error).message);
    }
  }
  
  return readers;
}

// Create trace exporter
function createTraceExporter(): any {
  // Use OTLP if configured
  if (OTLPTraceExporter && process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    try {
      return new OTLPTraceExporter({
        url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
        headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? 
          JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {},
      });
    } catch (error) {
      console.warn('⚠️ Failed to create OTLP trace exporter:', (error as Error).message);
    }
  }
  
  // Fallback to console exporter for development
  if (process.env.NODE_ENV === 'development') {
    try {
      const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-node');
      return new ConsoleSpanExporter();
    } catch (error) {
      console.warn('⚠️ Console span exporter not available');
    }
  }
  
  return null;
}

// Main initialization function
export function initializeOpenTelemetry(): boolean {
  // Skip initialization in certain environments
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.OTEL_ENABLED === 'false' ||
    process.env.SKIP_MONITORING === 'true'
  ) {
    // Debug log removed
    return false;
  }
  
  // Debug log removed
  
  // Initialize imports
  if (!initializeOtelImports()) {
    console.warn('⚠️ OpenTelemetry dependencies not available, monitoring will be limited');
    return false;
  }
  
  try {
    const resource = createResource();
    const instrumentations = createInstrumentations();
    const metricReaders = createMetricReaders();
    const traceExporter = createTraceExporter();
    
    if (!NodeSDK) {
      console.warn('⚠️ NodeSDK not available, cannot initialize OpenTelemetry');
      return false;
    }
    
    // Create SDK configuration
    const sdkConfig: any = {
      resource,
      instrumentations,
    };
    
    // Add metric readers if available
    if (metricReaders.length > 0) {
      sdkConfig.metricReader = metricReaders[0]; // Use first available reader
    }
    
    // Add trace exporter if available
    if (traceExporter) {
      sdkConfig.traceExporter = traceExporter;
    }
    
    // Initialize SDK
    const sdk = new NodeSDK(sdkConfig);
    
    // Start the SDK
    sdk.start();
    
    // Debug log removed
    
    // Register shutdown handlers
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => {
          // OpenTelemetry terminated  
        })
        .catch((error) => console.error('❌ Error terminating OpenTelemetry', error))
        .finally(() => process.exit(0));
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', (error as Error).message);
    return false;
  }
}

// Health check function
export function checkOpenTelemetryHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
} {
  const details: Record<string, any> = {};
  
  // Check if core modules are available
  const coreModules = {
    'NodeSDK': !!NodeSDK,
    'Resource': !!Resource,
    'Auto-instrumentations': !!getNodeAutoInstrumentations,
  };
  
  details.coreModules = coreModules;
  details.exporters = {
    'Prometheus': !!PrometheusExporter,
    'OTLP': !!OTLPTraceExporter,
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
  isEnabled: () => process.env.OTEL_ENABLED === 'true',
  getEndpoint: () => process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  getHeaders: () => {
    try {
      return process.env.OTEL_EXPORTER_OTLP_HEADERS ? 
        JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {};
    } catch {
      return {};
    }
  },
  getResource: createResource,
  checkHealth: checkOpenTelemetryHealth,
};