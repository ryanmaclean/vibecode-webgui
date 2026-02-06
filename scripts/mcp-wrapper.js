#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");

/**
 * Universal MCP server wrapper with Datadog tracing support.
 * Usage: node mcp-wrapper.js <service-name> <package-name>
 * Example: node mcp-wrapper.js puppeteer @modelcontextprotocol/server-puppeteer
 */

const tracer = require('dd-trace');
const { pathToFileURL } = require('url');

// Initialize log aggregation
const logAggregation = new LogAggregation();


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

async function loadPackage() {
  const span = tracer.startSpan(`mcp.${serviceName}.main`, {
    service: `mcp-${serviceName}`,
    resource: packageName,
  });

  try {
    try {
      require(packageName);
      return;
    } catch (requireError) {
      if (!['ERR_REQUIRE_ESM', 'MODULE_NOT_FOUND'].includes(requireError.code)) {
        throw requireError;
      }

      let resolvedPath;
      try {
        resolvedPath = require.resolve(packageName);
      } catch (resolveError) {
        if (resolveError.code !== 'MODULE_NOT_FOUND') {
          throw resolveError;
        }
        // Attempt to load common bin entry if package has no default export
        resolvedPath = require.resolve(`${packageName}/dist/index.js`);
      }

      await import(pathToFileURL(resolvedPath).href);
    }
  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.message', error.message);
    span.setTag('error.stack', error.stack);
    throw error;
  } finally {
    span.finish();
  }
}

loadPackage().catch((error) => {
  console.error(`Failed to start ${serviceName} MCP server:`, error);
  process.exit(1);
});
