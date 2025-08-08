/**
 * K6 Load Testing Suite for VibeCode Platform
 * Tests performance under various load conditions
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const customTrend = new Trend('custom_trend');
const apiRequests = new Counter('api_requests_total');

export const options = {
  scenarios: {
    // Baseline test - normal load
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 5 },
        { duration: '2m', target: 5 },
        { duration: '1m', target: 0 },
      ],
      tags: { test_type: 'baseline' },
    },

    // Spike test - sudden load increase
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '30s', target: 25 }, // Spike
        { duration: '30s', target: 5 },
        { duration: '30s', target: 0 },
      ],
      tags: { test_type: 'spike' },
      startTime: '5m',
    },

    // Stress test - high sustained load
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 15 },
        { duration: '5m', target: 15 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
      startTime: '10m',
    },
  },

  thresholds: {
    // Overall performance thresholds
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'], // Error rate under 5%
    
    // Custom thresholds per scenario
    'http_req_duration{test_type:baseline}': ['p(90)<1000'],
    'http_req_duration{test_type:spike}': ['p(90)<3000'],
    'http_req_duration{test_type:stress}': ['p(90)<2500'],
    
    // API-specific thresholds
    'http_req_duration{endpoint:monitoring}': ['p(95)<500'],
    'http_req_duration{endpoint:api}': ['p(95)<1000'],
    
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test endpoints and their expected responses
const endpoints = [
  { name: 'homepage', path: '/', expected: 200, tag: 'frontend' },
  { name: 'monitoring-dashboard', path: '/api/monitoring/dashboard', expected: 200, tag: 'monitoring' },
  { name: 'monitoring-metrics', path: '/api/monitoring/metrics', expected: 200, tag: 'monitoring' },
  { name: 'health-check', path: '/api/health', expected: 200, tag: 'api' },
];

export function setup() {
  console.log(`Starting performance tests against: ${BASE_URL}`);
  
  // Verify service is running
  const res = http.get(BASE_URL);
  if (res.status !== 200) {
    throw new Error(`Service not available at ${BASE_URL}. Status: ${res.status}`);
  }
  
  console.log('✅ Service is running, starting load tests...');
  return { startTime: Date.now() };
}

export default function (data) {
  // Select random endpoint for this iteration
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const url = `${BASE_URL}${endpoint.path}`;
  
  const params = {
    headers: {
      'User-Agent': 'k6-load-test/1.0',
      'Accept': 'application/json, text/html',
    },
    tags: {
      endpoint: endpoint.tag,
      name: endpoint.name,
    },
  };

  // Make the request
  const response = http.get(url, params);
  
  // Increment API request counter
  apiRequests.add(1);
  
  // Check response
  const success = check(response, {
    [`${endpoint.name} status is ${endpoint.expected}`]: (r) => r.status === endpoint.expected,
    [`${endpoint.name} response time < 2s`]: (r) => r.timings.duration < 2000,
    [`${endpoint.name} has body`]: (r) => r.body.length > 0,
  });

  // Record custom metrics
  customTrend.add(response.timings.duration);
  errorRate.add(!success);

  // Special handling for API endpoints
  if (endpoint.tag === 'monitoring') {
    check(response, {
      'monitoring endpoint returns JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      },
    });
  }

  // Think time between requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Performance tests completed in ${duration}s`);
  
  // Log final metrics
  console.log('Final metrics summary:');
  console.log(`- Total API requests: ${apiRequests.value}`);
  console.log(`- Error rate: ${errorRate.rate * 100}%`);
  console.log(`- Average response time: ${customTrend.avg}ms`);
}