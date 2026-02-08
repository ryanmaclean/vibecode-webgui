'use strict';

/**
 * Shared dd-trace configuration for Kafka DSM services
 * Properly configures span naming and tags for APM visibility
 */

const tracer = require('dd-trace');

/**
 * Normalize environment to standard values: dev, hme, prd, stg
 * @param {string} env - Raw environment value
 * @returns {string} - Normalized environment tag
 */
function normalizeEnv(env) {
  const lower = String(env).toLowerCase();
  const envMap = {
    'local': 'dev',
    'development': 'dev',
    'dev': 'dev',
    'home': 'hme',
    'hme': 'hme',
    'production': 'prd',
    'prod': 'prd',
    'prd': 'prd',
    'staging': 'stg',
    'stage': 'stg',
    'stg': 'stg',
    'ci': 'dev',
    'test': 'dev'
  };
  return envMap[lower] || 'dev';
}

function initTracer(options = {}) {
  const serviceName = options.service || process.env.DD_SERVICE || 'kafka-dsm';
  // Use standard env tags: dev, hme (home), prd (production), stg (staging)
  const rawEnv = options.env || process.env.DD_ENV || 'dev';
  const env = normalizeEnv(rawEnv);
  const version = options.version || process.env.DD_VERSION || '0.1.0';

  tracer.init({
    service: serviceName,
    env: env,
    version: version,
    logInjection: true,
    // Configure kafkajs plugin for better span naming
    plugins: false // Disable auto-config, we'll configure manually
  });

  // Configure kafkajs with proper resource naming
  tracer.use('kafkajs', {
    enabled: true,
    service: serviceName,
    // Use topic name as resource instead of broker hostname
    hooks: {
      produce: (span, { topic }) => {
        if (topic) {
          span.setTag('resource.name', topic);
          span.setTag('kafka.topic', topic);
        }
        span.setTag('span.kind', 'producer');
        span.setTag('messaging.system', 'kafka');
      },
      consume: (span, { topic, partition }) => {
        if (topic) {
          span.setTag('resource.name', topic);
          span.setTag('kafka.topic', topic);
        }
        if (partition !== undefined) {
          span.setTag('kafka.partition', partition);
        }
        span.setTag('span.kind', 'consumer');
        span.setTag('messaging.system', 'kafka');
      }
    }
  });

  // Configure http for outbound calls
  tracer.use('http', {
    enabled: true,
    service: `${serviceName}-http`,
    hooks: {
      request: (span, req) => {
        // Use path as resource instead of full URL with hostname
        if (req && req.path) {
          const path = req.path.split('?')[0]; // Remove query string
          span.setTag('resource.name', `${req.method || 'GET'} ${path}`);
        }
      }
    }
  });

  // Configure dns to avoid localhost noise
  tracer.use('dns', {
    enabled: false // Disable dns tracing to reduce noise
  });

  // Configure net to avoid localhost:9092 resource names
  tracer.use('net', {
    enabled: false // Disable low-level net tracing
  });

  return tracer;
}

module.exports = { initTracer, normalizeEnv, tracer };
