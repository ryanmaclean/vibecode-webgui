/**
 * OpenTelemetry Configuration and Setup
 * Provides vendor-neutral observability integration
 */

// Check if we're in a Docker build environment
const isDockerBuild = (
  process.env.DOCKER_BUILD === 'true' ||
  process.env.SKIP_MONITORING === 'true' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.OTEL_ENABLED === 'false' ||
  process.env.DD_ENABLED === 'false'
);

const isLocalDev = process.env.NODE_ENV !== 'production'

// Shareable type alias for dynamic require fallback
type NodeRequireFn = typeof require

// Type aliases for OpenTelemetry modules (loaded dynamically)
type NodeSDKConstructor = new (config: unknown) => { start: () => void; shutdown: () => Promise<void> }
type NodeSDKType = ReturnType<NodeSDKConstructor['prototype']['constructor']> | null

// Conditional imports to prevent build-time errors in Docker
let NodeSDK: NodeSDKConstructor | null = null;
let getNodeAutoInstrumentations: ((config?: unknown) => unknown[]) | null = null;
let OTLPTraceExporter: (new (config?: unknown) => unknown) | null = null;
let PrometheusExporter: (new (config?: unknown, callback?: () => void) => unknown) | null = null;
let Resource: (new (attributes: Record<string, string>) => unknown) | null = null;
let ATTR_SERVICE_NAME: string | null = null;
let ATTR_SERVICE_VERSION: string | null = null;

if (!isDockerBuild && !isLocalDev) {
  try {
    // Dynamic imports to prevent static analysis issues and keep dev builds lightweight
     
    const dynamicRequire = eval('require') as NodeRequireFn;
    const sdkNode = dynamicRequire('@opentelemetry/sdk-node');
    const autoInstrumentations = dynamicRequire('@opentelemetry/auto-instrumentations-node');
    const otlpExporter = dynamicRequire('@opentelemetry/exporter-otlp-http');
    const prometheusExporter = dynamicRequire('@opentelemetry/exporter-prometheus');
    const resources = dynamicRequire('@opentelemetry/resources');
    const semanticConventions = dynamicRequire('@opentelemetry/semantic-conventions');
    
    NodeSDK = sdkNode.NodeSDK;
    getNodeAutoInstrumentations = autoInstrumentations.getNodeAutoInstrumentations;
    OTLPTraceExporter = otlpExporter.OTLPTraceExporter;
    PrometheusExporter = prometheusExporter.PrometheusExporter;
    Resource = resources.Resource;
    ATTR_SERVICE_NAME = semanticConventions.SEMRESATTRS_SERVICE_NAME || semanticConventions.ATTR_SERVICE_NAME;
    ATTR_SERVICE_VERSION = semanticConventions.SEMRESATTRS_SERVICE_VERSION || semanticConventions.ATTR_SERVICE_VERSION;
  } catch (error) {
    console.log('⚠️ OpenTelemetry modules not available, monitoring disabled');
  }
}

import { getDatadogApiKey } from './datadog-env'

const isServer = typeof window === 'undefined'
const serviceName = 'vibecode-webgui'
const serviceVersion = process.env.npm_package_version || '0.1.0'

let otelSDK: NodeSDKType = null

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
    // Configure resource attributes
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      'service.namespace': 'vibecode',
      'deployment.environment': process.env.NODE_ENV || 'development'
    })

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
            requestHook: (span: { setAttributes: (attrs: Record<string, string>) => void }, request: { headers: Record<string, string>; method?: string }) => {
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
    datadog_integration: !!getDatadogApiKey()
  }
}

// Export SDK instance for testing/debugging
export { otelSDK }
