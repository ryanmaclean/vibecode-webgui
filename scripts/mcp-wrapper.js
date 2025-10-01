#!/usr/bin/env node
/**
 * Universal MCP server wrapper with Datadog tracing support.
 * Usage: node mcp-wrapper.js <service-name> <package-name>
 * Example: node mcp-wrapper.js puppeteer @modelcontextprotocol/server-puppeteer
 */

const tracer = require('dd-trace');

// Get service name and package from args
const [,, serviceName, packageName] = process.argv;

if (!serviceName || !packageName) {
  console.error('Usage: node mcp-wrapper.js <service-name> <package-name>');
  process.exit(1);
}

// Initialize Datadog tracer
try {
  tracer.init({
    service: `mcp-${serviceName}`,
    env: process.env.DD_ENV || 'development',
    version: process.env.DD_VERSION || '1.0.0',
    hostname: process.env.DD_AGENT_HOST || 'localhost',
    port: process.env.DD_TRACE_AGENT_PORT || '8126',
    logInjection: true,
    runtimeMetrics: true,
  });
  
  console.error(`Datadog tracing enabled for ${serviceName} MCP server`);
} catch (error) {
  console.error(`Warning: Failed to initialize Datadog tracing: ${error.message}`);
}

// Import and run the MCP server
const span = tracer.startSpan(`mcp.${serviceName}.main`, {
  service: `mcp-${serviceName}`,
  resource: packageName,
});

try {
  // Dynamic import of the package
  require(packageName);
} catch (error) {
  span.setTag('error', true);
  span.setTag('error.message', error.message);
  span.setTag('error.stack', error.stack);
  throw error;
} finally {
  span.finish();
}
