#!/usr/bin/env npx tsx
/**
 * Verify OpenTelemetry OTLP Configuration
 * This script verifies that OTLP exporter configuration is properly set up
 */

async function verifyOtelConfig() {
  try {
    // Import the configuration function
    const { getOpenTelemetryConfig } = await import('../src/lib/monitoring/opentelemetry-setup');

    // Get configuration
    const config = getOpenTelemetryConfig();

    // Verify required fields exist
    const requiredFields = [
      'initialized',
      'service_name',
      'service_version',
      'environment',
      'otlp_endpoint',
      'prometheus_port',
      'datadog_integration'
    ];

    const missingFields = requiredFields.filter(field => !(field in config));

    if (missingFields.length > 0) {
      console.error('❌ Configuration missing fields:', missingFields);
      process.exit(1);
    }

    // Verify OTLP endpoint is configured
    if (!config.otlp_endpoint) {
      console.error('❌ OTLP endpoint is not configured');
      process.exit(1);
    }

    // Status messages to stderr
    console.error(`✅ OTLP endpoint configured: ${config.otlp_endpoint}`);

    // Additional validation
    if (config.otlp_endpoint === 'http://localhost:4318/v1/traces') {
      console.error('ℹ️  Using default OTLP endpoint');
    }

    if (config.datadog_integration) {
      console.error('✅ Datadog integration enabled');
    } else {
      console.error('ℹ️  Datadog integration not configured');
    }

    // Output configuration as JSON to stdout for piping to jq
    console.log(JSON.stringify(config, null, 2));

    process.exit(0);

  } catch (error) {
    console.error('❌ Failed to verify OTLP configuration:', error);
    process.exit(1);
  }
}

verifyOtelConfig();
