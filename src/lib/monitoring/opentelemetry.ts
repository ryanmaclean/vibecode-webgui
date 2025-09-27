/**
 * OpenTelemetry Configuration and Setup
 * Provides vendor-neutral observability integration with fixed import issues
 */

import { getDatadogApiKey } from './datadog-env'

// Check if we're in a Docker build environment or explicitly disabling monitoring
const isDockerBuild = (
  process.env.DOCKER_BUILD === 'true' ||
  process.env.SKIP_MONITORING === 'true' ||
  // Only disable in CI if explicitly requested via OTEL_ENABLED=false  
  (process.env.CI === 'true' && process.env.OTEL_ENABLED === 'false') ||
  process.env.OTEL_ENABLED === 'false' ||
  process.env.DD_ENABLED === 'false'
);

// Conditional imports to prevent build-time errors in Docker
let NodeSDK: any = null;
let getNodeAutoInstrumentations: any = null;
let OTLPTraceExporter: any = null;
let PrometheusExporter: any = null;
let Resource: any = null;
let ATTR_SERVICE_NAME: any = null;
let ATTR_SERVICE_VERSION: any = null;

if (!isDockerBuild) {
  try {
    // Dynamic imports to prevent static analysis issues
    const sdkNode = require('@opentelemetry/sdk-node');
    const autoInstrumentations = require('@opentelemetry/auto-instrumentations-node');
    const otlpExporter = require('@opentelemetry/exporter-otlp-http');
    const prometheusExporter = require('@opentelemetry/exporter-prometheus');
    const resources = require('@opentelemetry/resources');
    const semanticConventions = require('@opentelemetry/semantic-conventions');
    
    NodeSDK = sdkNode.NodeSDK;
    getNodeAutoInstrumentations = autoInstrumentations.getNodeAutoInstrumentations;
    OTLPTraceExporter = otlpExporter.OTLPTraceExporter;
    PrometheusExporter = prometheusExporter.PrometheusExporter;
    Resource = resources.Resource;
    
    // Fixed semantic conventions compatibility - use nullish coalescing and proper fallback
    ATTR_SERVICE_NAME = semanticConventions.SEMRESATTRS_SERVICE_NAME ?? 
                       semanticConventions.ATTR_SERVICE_NAME ?? 
                       'service.name';
    ATTR_SERVICE_VERSION = semanticConventions.SEMRESATTRS_SERVICE_VERSION ?? 
                          semanticConventions.ATTR_SERVICE_VERSION ?? 
                          'service.version';
                          
    console.log('✅ OpenTelemetry modules loaded successfully');
    console.log(`   Service name attribute: ${ATTR_SERVICE_NAME}`);
    console.log(`   Service version attribute: ${ATTR_SERVICE_VERSION}`);
    
  } catch (error) {
    console.log('⚠️ OpenTelemetry modules not available, monitoring disabled:', (error as Error).message);
  }
}

const isServer = typeof window === 'undefined'
const serviceName = 'vibecode-webgui'
const serviceVersion = process.env.npm_package_version || '0.1.0'

let otelSDK: any = null

/**
 * Initialize OpenTelemetry instrumentation
 */
export function initializeOpenTelemetry() {
  if (!isServer || otelSDK || isDockerBuild) {
    if (isDockerBuild) {
      console.log('🚫 OpenTelemetry disabled during Docker build');
    }
    return otelSDK
  }

  // Check if all required modules are available
  if (!NodeSDK || !getNodeAutoInstrumentations || !OTLPTraceExporter || !PrometheusExporter || !Resource || !ATTR_SERVICE_NAME || !ATTR_SERVICE_VERSION) {
    console.log('⚠️ OpenTelemetry modules not available, monitoring disabled');
    return null;
  }

  console.log('🔧 Initializing OpenTelemetry...')

  try {
    // Configure resource attributes with proper fallback handling
    const resourceAttributes: Record<string, string> = {
      'service.namespace': 'vibecode',
      'deployment.environment': process.env.NODE_ENV || 'development'
    };
    
    // Use the dynamically determined attribute names
    resourceAttributes[ATTR_SERVICE_NAME] = serviceName;
    resourceAttributes[ATTR_SERVICE_VERSION] = serviceVersion;

    const resource = new Resource(resourceAttributes)

    // Configure OTLP exporter (for Datadog and other OTLP-compatible backends)
    const ddApiKey = getDatadogApiKey()
    const otlpExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
      headers: {
        // Support for Datadog Agent OTLP ingestion
        ...(ddApiKey && {
          'DD-API-KEY': ddApiKey
        })
      }
    })

    // Configure Prometheus metrics exporter
    const prometheusExporter = new PrometheusExporter({
      port: parseInt(process.env.OTEL_PROMETHEUS_PORT || '9090'),
      endpoint: process.env.OTEL_PROMETHEUS_ENDPOINT || '/metrics'
    }, () => {
      console.log('📊 Prometheus metrics available at http://localhost:9090/metrics')
    })

    // Initialize SDK with auto-instrumentation
    otelSDK = new NodeSDK({
      resource,
      traceExporter: otlpExporter,
      metricReader: prometheusExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable some instrumentations that might be noisy in development
          '@opentelemetry/instrumentation-dns': {
            enabled: process.env.NODE_ENV === 'production'
          },
          '@opentelemetry/instrumentation-net': {
            enabled: process.env.NODE_ENV === 'production'
          },
          // Enable key instrumentations
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: (span: any, request: any) => {
              // Add custom attributes to HTTP spans
              span.setAttributes({
                'vibecode.request.user_agent': request.headers['user-agent'] || 'unknown',
                'vibecode.request.method': request.method || 'unknown'
              })
            }
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true
          },
          '@opentelemetry/instrumentation-fs': {
            enabled: process.env.NODE_ENV === 'production'
          }
        })
      ]
    })

    // Start the SDK
    otelSDK.start()
    
    console.log('✅ OpenTelemetry initialized successfully')
    console.log(`   Service: ${serviceName} v${serviceVersion}`)
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`   OTLP endpoint: ${process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces'}`)

    return otelSDK

  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', error)
    return null
  }
}

/**
 * Gracefully shutdown OpenTelemetry
 */
export async function shutdownOpenTelemetry() {
  if (otelSDK) {
    try {
      await otelSDK.shutdown()
      console.log('✅ OpenTelemetry shutdown complete')
    } catch (error) {
      console.error('❌ Error shutting down OpenTelemetry:', error)
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
    // Add status information
    modules_loaded: {
      NodeSDK: !!NodeSDK,
      getNodeAutoInstrumentations: !!getNodeAutoInstrumentations,
      OTLPTraceExporter: !!OTLPTraceExporter,
      PrometheusExporter: !!PrometheusExporter,
      Resource: !!Resource,
    },
    semantic_conventions: {
      service_name_attr: ATTR_SERVICE_NAME,
      service_version_attr: ATTR_SERVICE_VERSION,
    }
  }
}

/**
 * Check if OpenTelemetry is available and properly configured
 */
export function checkOpenTelemetryHealth() {
  const modulesAvailable = !!(NodeSDK && Resource && getNodeAutoInstrumentations);
  const exportersAvailable = !!(OTLPTraceExporter && PrometheusExporter);
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  
  if (modulesAvailable && exportersAvailable) {
    status = 'healthy';
  } else if (modulesAvailable || exportersAvailable) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }
  
  return {
    status,
    details: {
      modules_available: modulesAvailable,
      exporters_available: exportersAvailable,
      sdk_initialized: !!otelSDK,
      docker_build: isDockerBuild,
    }
  };
}

// Export SDK instance for testing/debugging
export { otelSDK }