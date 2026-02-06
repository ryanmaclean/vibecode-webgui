#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * Verify Datadog Metrics Integration
 * 
 * This script checks if metrics are being correctly sent to Datadog
 * and validates that PostgreSQL monitoring is properly configured.
 */

const https = require('https');
const { ArgumentParser } = require('argparse');

// Initialize log aggregation
const logAggregation = new LogAggregation();


// Parse command line arguments
const parser = new ArgumentParser({
  description: 'Verify Datadog metrics integration for PostgreSQL monitoring'
});

parser.add_argument('--metric-prefix', {
  help: 'Metric prefix to check for (e.g., postgresql)',
  default: 'postgresql'
});

parser.add_argument('--minutes', {
  help: 'Time window in minutes to check for metrics',
  type: 'int',
  default: 30
});

parser.add_argument('--environment', {
  help: 'Environment tag to filter metrics by',
  default: 'development'
});

parser.add_argument('--timeout', {
  help: 'Timeout in seconds for each request',
  type: 'int',
  default: 30
});

const args = parser.parse_args();

// Configuration
const config = {
  metricPrefix: args.metric_prefix,
  minutes: args.minutes,
  environment: args.environment,
  timeout: args.timeout * 1000,
  apiKey: process.env.DD_API_KEY,
  appKey: process.env.DD_APP_KEY,
  site: process.env.DD_SITE || 'datadoghq.com'
};

if (!config.apiKey || !config.appKey) {
  console.error('❌ Error: Datadog API and application keys must be provided via environment variables DD_API_KEY and DD_APP_KEY');
  process.exit(1);
}

/**
 * Make a request to the Datadog API
 */
function makeDatadogRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: `api.${config.site}`,
      port: 443,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': config.apiKey,
        'DD-APPLICATION-KEY': config.appKey
      },
      timeout: config.timeout
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${config.timeout}ms`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Check if metrics are being reported to Datadog
 */
async function checkMetrics() {
  console.log(`Checking for ${config.metricPrefix} metrics in Datadog...`);
  
  const now = Math.floor(Date.now() / 1000);
  const fromTime = now - (config.minutes * 60);
  
  try {
    // Get list of metrics for the specified prefix
    const metricsResult = await makeDatadogRequest(`/api/v1/metrics?q=${config.metricPrefix}`);
    
    if (!metricsResult.metrics || metricsResult.metrics.length === 0) {
      console.error(`❌ No metrics found with prefix '${config.metricPrefix}'`);
      return false;
    }
    
    console.log(`Found ${metricsResult.metrics.length} metrics with prefix '${config.metricPrefix}':`);
    const topMetrics = metricsResult.metrics.slice(0, 10);
    topMetrics.forEach(metric => console.log(`- ${metric}`));
    
    if (metricsResult.metrics.length > 10) {
      console.log(`... and ${metricsResult.metrics.length - 10} more`);
    }
    
    // Check for specific PostgreSQL monitoring metrics
    const requiredMetrics = [
      `${config.metricPrefix}.connections`,
      `${config.metricPrefix}.queries`,
      `${config.metricPrefix}.disk`
    ];
    
    const missingMetrics = requiredMetrics.filter(required => 
      !metricsResult.metrics.some(metric => metric.startsWith(required))
    );
    
    if (missingMetrics.length > 0) {
      console.warn(`⚠️ Warning: The following important metrics are missing: ${missingMetrics.join(', ')}`);
    }
    
    // Check if metrics have data in the specified time window
    console.log(`\nChecking for data in the last ${config.minutes} minutes...`);
    let hasData = false;
    
    // Use the first available metric to check for data
    const testMetric = metricsResult.metrics[0];
    const queryResult = await makeDatadogRequest(
      `/api/v1/query?query=${testMetric}{env:${config.environment}}&from=${fromTime}&to=${now}`
    );
    
    if (queryResult.series && queryResult.series.length > 0 && queryResult.series[0].pointlist.length > 0) {
      hasData = true;
      console.log(`✅ Found data for metric '${testMetric}'`);
      console.log(`  Points: ${queryResult.series[0].pointlist.length}`);
      console.log(`  Scope: ${queryResult.series[0].scope}`);
      console.log(`  Tags: ${JSON.stringify(queryResult.series[0].tag_set)}`);
    } else {
      console.error(`❌ No data found for metric '${testMetric}' in the last ${config.minutes} minutes`);
    }
    
    return hasData;
  } catch (error) {
    console.error('❌ Error checking metrics:', error.message);
    return false;
  }
}

/**
 * Check PostgreSQL monitor configuration
 */
async function checkMonitors() {
  console.log('\nChecking for PostgreSQL monitors in Datadog...');
  
  try {
    const monitorsResult = await makeDatadogRequest(`/api/v1/monitor/search?query=${config.metricPrefix}`);
    
    if (!monitorsResult.monitors || monitorsResult.monitors.length === 0) {
      console.warn(`⚠️ Warning: No monitors found for '${config.metricPrefix}'`);
      return false;
    }
    
    console.log(`Found ${monitorsResult.monitors.length} monitors for '${config.metricPrefix}':`);
    monitorsResult.monitors.forEach(monitor => {
      console.log(`- ${monitor.name} (${monitor.status})`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error checking monitors:', error.message);
    return false;
  }
}

/**
 * Check for dashboards with PostgreSQL metrics
 */
async function checkDashboards() {
  console.log('\nChecking for PostgreSQL dashboards in Datadog...');
  
  try {
    const dashboardsResult = await makeDatadogRequest(`/api/v1/dashboard?filter=${config.metricPrefix}`);
    
    if (!dashboardsResult.dashboards || dashboardsResult.dashboards.length === 0) {
      console.warn(`⚠️ Warning: No dashboards found for '${config.metricPrefix}'`);
      return false;
    }
    
    console.log(`Found ${dashboardsResult.dashboards.length} dashboards for '${config.metricPrefix}':`);
    dashboardsResult.dashboards.forEach(dashboard => {
      console.log(`- ${dashboard.title} (${dashboard.id})`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error checking dashboards:', error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Verifying Datadog integration for PostgreSQL monitoring...');
  console.log(`Environment: ${config.environment}`);
  console.log(`Metric prefix: ${config.metricPrefix}`);
  console.log(`Time window: ${config.minutes} minutes`);
  
  let success = true;
  
  // Check metrics
  const metricsOk = await checkMetrics();
  success = success && metricsOk;
  
  // Check monitors
  const monitorsOk = await checkMonitors();
  success = success && monitorsOk;
  
  // Check dashboards
  const dashboardsOk = await checkDashboards();
  success = success && dashboardsOk;
  
  console.log('\nVerification summary:');
  console.log(`- Metrics: ${metricsOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`- Monitors: ${monitorsOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`- Dashboards: ${dashboardsOk ? '✅ OK' : '❌ Failed'}`);
  
  if (success) {
    console.log('\n✅ Datadog integration for PostgreSQL monitoring is properly configured!');
    process.exit(0);
  } else {
    console.error('\n❌ Datadog integration for PostgreSQL monitoring has issues. Please check the logs above.');
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});