/**
 * OpenTelemetry Configuration and Setup
 * Provides vendor-neutral observability integration
 */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

const isServer = typeof window === 'undefined'
const serviceName = 'vibecode-webgui'
const serviceVersion = process.env.npm_package_version || '0.1.0'

let otelSDK: NodeSDK | null = null

/**
 * Initialize OpenTelemetry instrumentation
 */
export function initializeOpenTelemetry() {
  if (!isServer || otelSDK) {
    return otelSDK
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
    const otlpExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
      headers: {
        // Support for Datadog Agent OTLP ingestion
        ...(process.env.DD_API_KEY && {
          'DD-API-KEY': process.env.DD_API_KEY
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
            requestHook: (span, request) => {
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
    datadog_integration: !!process.env.DD_API_KEY
  }
}

// Export SDK instance for testing/debugging
export { otelSDK }