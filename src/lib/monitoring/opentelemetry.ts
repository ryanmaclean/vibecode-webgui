// import { logger } from '@/lib/logger';


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

// Conditional imports to prevent build-time errors in Docker
let NodeSDK: any = null;
let getNodeAutoInstrumentations: any = null;
let OTLPTraceExporter: any = null;
let PrometheusExporter: any = null;
let Resource: any = null;
let ATTR_SERVICE_NAME: any = null;
let ATTR_SERVICE_VERSION: any = null;
let TailBasedSampler: any = null;

if (!isDockerBuild) {
  try {
    // Dynamic imports to prevent static analysis issues
    const sdkNode = require('@opentelemetry/sdk-node');
    const autoInstrumentations = require('@opentelemetry/auto-instrumentations-node');
    const otlpExporter = require('@opentelemetry/exporter-otlp-http');
    const prometheusExporter = require('@opentelemetry/exporter-prometheus');
    const resources = require('@opentelemetry/resources');
    const semanticConventions = require('@opentelemetry/semantic-conventions');
    const tailBasedSampler = require('./tail-based-sampler');

    NodeSDK = sdkNode.NodeSDK;
    getNodeAutoInstrumentations = autoInstrumentations.getNodeAutoInstrumentations;
    OTLPTraceExporter = otlpExporter.OTLPTraceExporter;
    PrometheusExporter = prometheusExporter.PrometheusExporter;
    Resource = resources.Resource;
    ATTR_SERVICE_NAME = semanticConventions.SEMRESATTRS_SERVICE_NAME || semanticConventions.ATTR_SERVICE_NAME;
    ATTR_SERVICE_VERSION = semanticConventions.SEMRESATTRS_SERVICE_VERSION || semanticConventions.ATTR_SERVICE_VERSION;
    TailBasedSampler = tailBasedSampler.TailBasedSampler;
  } catch (error) {
    // Debug log removed
  }
}

import { getDatadogApiKey } from './datadog-env'
import { getSamplingConfig } from './sampling-config'
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
      // Debug log removed
    }
    return otelSDK
  }

  // Check if all required modules are available
  if (!NodeSDK || !getNodeAutoInstrumentations || !OTLPTraceExporter || !PrometheusExporter || !Resource || !ATTR_SERVICE_NAME || !ATTR_SERVICE_VERSION || !TailBasedSampler) {
    // Debug log removed
    return null;
  }

  // Debug log removed

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
      // Debug log removed
    })

    // Configure tail-based sampler with OTLP exporter
    const samplingConfig = getSamplingConfig()
    const tailBasedSampler = new TailBasedSampler(otlpExporter, {
      errorSampleRate: samplingConfig.errorSampleRate,
      defaultSampleRate: samplingConfig.defaultSampleRate,
      bufferTimeout: samplingConfig.bufferTimeout,
      maxBufferSize: samplingConfig.maxBufferSize
    })

    // Initialize SDK with auto-instrumentation
    otelSDK = new NodeSDK({
      resource,
      spanProcessor: tailBasedSampler,
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
    
    // Debug log removed

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
      // Debug log removed
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