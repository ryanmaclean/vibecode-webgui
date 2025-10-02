/**
 * OpenTelemetry Client-Side Integration
 * Provides browser-based observability for user experience monitoring
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

// Conditional imports to prevent build-time errors in Docker
let WebTracerProvider: any = null;
let Resource: any = null;
let ATTR_SERVICE_NAME: any = null;
let ATTR_SERVICE_VERSION: any = null;
let getWebAutoInstrumentations: any = null;
let registerInstrumentations: any = null;
let BatchSpanProcessor: any = null;
let OTLPTraceExporter: any = null;

if (!isDockerBuild) {
  try {
    // Dynamic imports to prevent static analysis issues
    const sdkTraceWeb = require('@opentelemetry/sdk-trace-web');
    const resources = require('@opentelemetry/resources');
    const semanticConventions = require('@opentelemetry/semantic-conventions');
    const autoInstrumentationsWeb = require('@opentelemetry/auto-instrumentations-web');
    const instrumentation = require('@opentelemetry/instrumentation');
    const sdkTraceBase = require('@opentelemetry/sdk-trace-base');
    const otlpExporter = require('@opentelemetry/exporter-otlp-http');
    
    WebTracerProvider = sdkTraceWeb.WebTracerProvider;
    Resource = resources.Resource;
    ATTR_SERVICE_NAME = semanticConventions.ATTR_SERVICE_NAME;
    ATTR_SERVICE_VERSION = semanticConventions.ATTR_SERVICE_VERSION;
    getWebAutoInstrumentations = autoInstrumentationsWeb.getWebAutoInstrumentations;
    registerInstrumentations = instrumentation.registerInstrumentations;
    BatchSpanProcessor = sdkTraceBase.BatchSpanProcessor;
    OTLPTraceExporter = otlpExporter.OTLPTraceExporter;
  } catch (error) {
    console.log('⚠️ OpenTelemetry client modules not available, monitoring disabled');
  }
}

const isBrowser = typeof window !== 'undefined'
const serviceName = 'vibecode-webgui-client'
const serviceVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'

let webTracerProvider: any = null

/**
 * Initialize OpenTelemetry for browser/client-side
 */
export function initializeClientOpenTelemetry() {
  if (!isBrowser || webTracerProvider || isDockerBuild) {
    if (isDockerBuild) {
      console.log('🚫 Client-side OpenTelemetry disabled during Docker build');
    }
    return webTracerProvider
  }

  // Check if all required modules are available
  if (!WebTracerProvider || !Resource || !ATTR_SERVICE_NAME || !ATTR_SERVICE_VERSION || !getWebAutoInstrumentations || !registerInstrumentations || !BatchSpanProcessor || !OTLPTraceExporter) {
    console.log('⚠️ OpenTelemetry client modules not available, monitoring disabled');
    return null;
  }

  console.log('🔧 Initializing client-side OpenTelemetry...')

  try {
    // Configure resource for browser
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      'service.namespace': 'vibecode',
      'deployment.environment': process.env.NODE_ENV || 'development',
      'telemetry.sdk.language': 'javascript',
      'telemetry.sdk.name': 'opentelemetry'
    })

    // Create web tracer provider
    webTracerProvider = new WebTracerProvider({
      resource
    })

    // Configure OTLP exporter for browser
    const otlpExporter = new OTLPTraceExporter({
      url: process.env.NEXT_PUBLIC_OTEL_EXPORTER_URL || '/api/monitoring/traces',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Add batch span processor
    webTracerProvider.addSpanProcessor(
      new BatchSpanProcessor(otlpExporter, {
        maxExportBatchSize: 10,
        scheduledDelayMillis: 500,
        exportTimeoutMillis: 3000
      })
    )

    // Register the provider
    webTracerProvider.register()

    // Register auto-instrumentations for web
    registerInstrumentations({
      instrumentations: [
        getWebAutoInstrumentations({
          '@opentelemetry/instrumentation-fetch': {
            enabled: true,
            clearTimingResources: true,
            propagateTraceHeaderCorsUrls: [
              new RegExp(`^${window.location.origin}/api/.*$`)
            ]
          },
          '@opentelemetry/instrumentation-xml-http-request': {
            enabled: true,
            clearTimingResources: true
          },
          '@opentelemetry/instrumentation-user-interaction': {
            enabled: true,
            eventNames: ['click', 'submit', 'keydown']
          },
          '@opentelemetry/instrumentation-document-load': {
            enabled: true
          }
        })
      ]
    })

    console.log('✅ Client-side OpenTelemetry initialized successfully')
    return webTracerProvider

  } catch (error) {
    console.error('❌ Failed to initialize client-side OpenTelemetry:', error)
    return null
  }
}

/**
 * Create custom spans for user interactions
 */
export function createUserInteractionSpan(name: string, attributes: Record<string, string | number> = {}) {
  if (!webTracerProvider) {
    return null
  }

  const tracer = webTracerProvider.getTracer('vibecode-user-interactions')
  
  return tracer.startSpan(name, {
    attributes: {
      'span.kind': 'client',
      'user.interaction': true,
      ...attributes
    }
  })
}

/**
 * Track page navigation
 */
export function trackPageNavigation(from: string, to: string) {
  if (!webTracerProvider) {
    return
  }

  const span = createUserInteractionSpan('page.navigation', {
    'navigation.from': from,
    'navigation.to': to,
    'navigation.type': 'spa'
  })

  if (span) {
    // Add timing information if available
    if (performance && performance.navigation) {
      span.setAttributes({
        'navigation.timing.dom_content_loaded': performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        'navigation.timing.load_complete': performance.timing.loadEventEnd - performance.timing.navigationStart
      })
    }

    span.end()
  }
}

/**
 * Track API calls from client
 */
export function trackClientAPICall(endpoint: string, method: string, duration: number, status: number) {
  const span = createUserInteractionSpan('api.client_call', {
    'api.endpoint': endpoint,
    'api.method': method,
    'api.duration_ms': duration,
    'api.status_code': status,
    'api.success': status < 400 ? 1 : 0
  })

  if (span) {
    span.end()
  }
}

/**
 * Get client OpenTelemetry configuration
 */
export function getClientOpenTelemetryConfig() {
  return {
    initialized: !!webTracerProvider,
    service_name: serviceName,
    service_version: serviceVersion,
    environment: process.env.NODE_ENV || 'development',
    exporter_url: process.env.NEXT_PUBLIC_OTEL_EXPORTER_URL || '/api/monitoring/traces'
  }
}

// Auto-initialize if in browser and enabled
if (isBrowser && process.env.NEXT_PUBLIC_OTEL_ENABLED === 'true') {
  initializeClientOpenTelemetry()
}

export { webTracerProvider }