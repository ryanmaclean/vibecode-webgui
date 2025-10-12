import { logger } from '@/lib/logger';


export function initializeOpenTelemetry() {
  logger.info('🛠️ OpenTelemetry stub active (development mode)')
  return null
}

export async function shutdownOpenTelemetry() {
  return
}

export function getOpenTelemetryConfig() {
  return {
    initialized: false,
    service_name: 'vibecode-webgui',
    service_version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    otlp_endpoint: null,
    prometheus_port: null,
    datadog_integration: false,
  }
}

export const otelSDK = null
