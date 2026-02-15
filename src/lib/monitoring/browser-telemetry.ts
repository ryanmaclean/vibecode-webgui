/**
 * Browser OpenTelemetry Configuration and Setup
 * Provides vendor-neutral observability integration for client-side code
 */

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined'

// Check if telemetry should be disabled
const isTelemetryDisabled = (
  process.env.NEXT_PUBLIC_OTEL_ENABLED === 'false' ||
  process.env.NEXT_PUBLIC_SKIP_MONITORING === 'true'
)

// Conditional imports to prevent build-time errors
let WebTracerProvider: any = null
let BatchSpanProcessor: any = null
let OTLPTraceExporter: any = null
let Resource: any = null
let ATTR_SERVICE_NAME: any = null
let ATTR_SERVICE_VERSION: any = null
let registerInstrumentations: any = null
let getWebAutoInstrumentations: any = null
let ZoneContextManager: any = null

if (isBrowser && !isTelemetryDisabled) {
  try {
    // Dynamic imports to prevent static analysis issues
    const sdkTraceWeb = require('@opentelemetry/sdk-trace-web')
    const otlpExporter = require('@opentelemetry/exporter-trace-otlp-http')
    const resources = require('@opentelemetry/resources')
    const semanticConventions = require('@opentelemetry/semantic-conventions')
    const instrumentation = require('@opentelemetry/instrumentation')
    const autoInstrumentationsWeb = require('@opentelemetry/auto-instrumentations-web')
    const contextZone = require('@opentelemetry/context-zone')

    WebTracerProvider = sdkTraceWeb.WebTracerProvider
    BatchSpanProcessor = sdkTraceWeb.BatchSpanProcessor
    OTLPTraceExporter = otlpExporter.OTLPTraceExporter
    Resource = resources.Resource
    ATTR_SERVICE_NAME = semanticConventions.SEMRESATTRS_SERVICE_NAME || semanticConventions.ATTR_SERVICE_NAME
    ATTR_SERVICE_VERSION = semanticConventions.SEMRESATTRS_SERVICE_VERSION || semanticConventions.ATTR_SERVICE_VERSION
    registerInstrumentations = instrumentation.registerInstrumentations
    getWebAutoInstrumentations = autoInstrumentationsWeb.getWebAutoInstrumentations
    ZoneContextManager = contextZone.ZoneContextManager
  } catch (error) {
    // Silent fail during development/build
  }
}

const serviceName = 'vibecode-webgui-browser'
const serviceVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'

let tracerProvider: any = null

/**
 * Initialize browser OpenTelemetry instrumentation
 */
export function initializeBrowserTelemetry() {
  if (!isBrowser || tracerProvider || isTelemetryDisabled) {
    return tracerProvider
  }

  // Check if all required modules are available
  if (!WebTracerProvider || !BatchSpanProcessor || !OTLPTraceExporter || !Resource || !ATTR_SERVICE_NAME || !ATTR_SERVICE_VERSION || !registerInstrumentations || !getWebAutoInstrumentations || !ZoneContextManager) {
    return null
  }

  try {
    // Configure resource attributes
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      'service.namespace': 'vibecode',
      'deployment.environment': process.env.NODE_ENV || 'development',
      'browser.user_agent': navigator.userAgent,
      'browser.language': navigator.language,
      'browser.platform': navigator.platform
    })

    // Create tracer provider
    tracerProvider = new WebTracerProvider({
      resource
    })

    // Configure OTLP exporter for browser traces
    const otlpExporter = new OTLPTraceExporter({
      url: process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || '/api/telemetry/traces',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Add batch span processor
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(otlpExporter, {
      // Configure batching for performance
      maxQueueSize: 100,
      maxExportBatchSize: 10,
      scheduledDelayMillis: 5000
    }))

    // Register the provider globally
    tracerProvider.register({
      contextManager: new ZoneContextManager()
    })

    // Register auto-instrumentations for browser events
    registerInstrumentations({
      instrumentations: [
        getWebAutoInstrumentations({
          // Document load instrumentation
          '@opentelemetry/instrumentation-document-load': {
            enabled: true
          },
          // User interaction instrumentation (clicks, etc.)
          '@opentelemetry/instrumentation-user-interaction': {
            enabled: true,
            eventNames: ['click', 'submit']
          },
          // Fetch API instrumentation
          '@opentelemetry/instrumentation-fetch': {
            enabled: true,
            propagateTraceHeaderCorsUrls: [
              /localhost/,
              /vibecode/
            ],
            clearTimingResources: true,
            applyCustomAttributesOnSpan: (span: any, request: Request | RequestInit, result: Response | FetchError) => {
              if (result instanceof Response) {
                span.setAttribute('http.response.status_code', result.status)
                span.setAttribute('http.response.status_text', result.statusText)
              }
            }
          },
          // XMLHttpRequest instrumentation
          '@opentelemetry/instrumentation-xml-http-request': {
            enabled: true,
            propagateTraceHeaderCorsUrls: [
              /localhost/,
              /vibecode/
            ],
            clearTimingResources: true
          }
        })
      ]
    })

    // Expose telemetry instance for debugging and verification
    if (isBrowser) {
      (window as any).__OTEL_BROWSER__ = {
        tracerProvider,
        serviceName,
        serviceVersion,
        initialized: true,
        config: getBrowserTelemetryConfig()
      }
    }

    return tracerProvider

  } catch (error) {
    console.error('❌ Failed to initialize browser OpenTelemetry:', error)
    return null
  }
}

/**
 * Get current browser OpenTelemetry configuration
 */
export function getBrowserTelemetryConfig() {
  return {
    initialized: !!tracerProvider,
    service_name: serviceName,
    service_version: serviceVersion,
    environment: process.env.NODE_ENV || 'development',
    otlp_endpoint: process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || '/api/telemetry/traces',
    user_agent: isBrowser ? navigator.userAgent : 'N/A',
    language: isBrowser ? navigator.language : 'N/A',
    platform: isBrowser ? navigator.platform : 'N/A'
  }
}

/**
 * Create a custom browser span for manual instrumentation
 */
export function createBrowserSpan<T>(
  name: string,
  attributes: Record<string, any>,
  fn: (span: any) => Promise<T>
): Promise<T> {
  if (!isBrowser || isTelemetryDisabled) {
    // Execute function without tracing
    return fn({
      setAttribute: () => {},
      setAttributes: () => {},
      setStatus: () => {},
      recordException: () => {},
      end: () => {}
    })
  }

  // Dynamic import of OpenTelemetry API
  let trace: any = null
  let SpanStatusCode: any = null

  try {
    const otelApi = require('@opentelemetry/api')
    trace = otelApi.trace
    SpanStatusCode = otelApi.SpanStatusCode
  } catch (error) {
    // OpenTelemetry API not available, execute without tracing
    return fn({
      setAttribute: () => {},
      setAttributes: () => {},
      setStatus: () => {},
      recordException: () => {},
      end: () => {}
    })
  }

  const tracer = trace.getTracer(serviceName)

  return tracer.startActiveSpan(name, async (span: any) => {
    try {
      // Set initial attributes
      span.setAttributes({
        ...attributes,
        'vibecode.client_side': true,
        'vibecode.url': isBrowser ? window.location.href : 'N/A'
      })

      // Execute the function
      const result = await fn(span)

      // Mark span as successful
      span.setStatus({ code: SpanStatusCode.OK })

      return result
    } catch (error) {
      // Record error in span
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      })

      span.recordException(error as Error)

      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Get the active browser tracer instance
 */
export function getActiveBrowserTracer() {
  if (!isBrowser || isTelemetryDisabled) {
    // Return mock tracer
    return {
      startSpan: () => ({
        setAttribute: () => {},
        setAttributes: () => {},
        setStatus: () => {},
        recordException: () => {},
        end: () => {}
      }),
      startActiveSpan: (name: string, fn: Function) => {
        return fn({
          setAttribute: () => {},
          setAttributes: () => {},
          setStatus: () => {},
          recordException: () => {},
          end: () => {}
        })
      }
    }
  }

  try {
    const otelApi = require('@opentelemetry/api')
    return otelApi.trace.getTracer(serviceName)
  } catch (error) {
    // Return mock tracer if OpenTelemetry API is not available
    return {
      startSpan: () => ({
        setAttribute: () => {},
        setAttributes: () => {},
        setStatus: () => {},
        recordException: () => {},
        end: () => {}
      }),
      startActiveSpan: (name: string, fn: Function) => {
        return fn({
          setAttribute: () => {},
          setAttributes: () => {},
          setStatus: () => {},
          recordException: () => {},
          end: () => {}
        })
      }
    }
  }
}

// Type for fetch errors
interface FetchError extends Error {
  code?: string
  errno?: number
}

// Export tracer provider for testing/debugging
export { tracerProvider }
