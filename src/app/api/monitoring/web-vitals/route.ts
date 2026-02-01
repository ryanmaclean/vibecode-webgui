/**
 * Web Vitals Monitoring API
 * 
 * Collects and stores Core Web Vitals metrics from browsers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAPIRateLimit } from '@/lib/rate-limiting';

const apiRateLimit = createAPIRateLimit(120); // 120 requests per minute - monitoring data

export const dynamic = 'force-dynamic';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
  navigationType?: string;
  timestamp?: number;
}

// In-memory storage for metrics (replace with database in production)
const metricsStore: WebVitalMetric[] = [];
const MAX_METRICS = 10000; // Keep last 10k metrics

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    );
  }

  try {
    const metric: WebVitalMetric = await request.json();

    // Validate metric
    if (!metric.name || typeof metric.value !== 'number') {
      return NextResponse.json(
        { error: 'Invalid metric data' },
        { status: 400 }
      );
    }

    // Store metric
    metricsStore.push({
      ...metric,
      timestamp: Date.now()
    });

    // Keep only recent metrics
    if (metricsStore.length > MAX_METRICS) {
      metricsStore.shift();
    }

    // Send to Datadog if configured
    if (process.env.DD_API_KEY) {
      await sendToDatadog(metric);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing web vital:', error);
    return NextResponse.json(
      { error: 'Failed to store metric' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const metricName = searchParams.get('name');
    const since = searchParams.get('since');

    let filteredMetrics = metricsStore;

    // Filter by metric name
    if (metricName) {
      filteredMetrics = filteredMetrics.filter(m => m.name === metricName);
    }

    // Filter by time
    if (since) {
      const sinceTime = parseInt(since);
      filteredMetrics = filteredMetrics.filter((m) => (m.timestamp ?? 0) >= sinceTime);
    }

    // Calculate aggregates
    const aggregates = calculateAggregates(filteredMetrics);

    return NextResponse.json({
      count: filteredMetrics.length,
      metrics: filteredMetrics.slice(-100), // Return last 100 for display
      aggregates
    });
  } catch (error) {
    console.error('Error retrieving web vitals:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    );
  }
}

interface MetricAggregate {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

function calculateAggregates(metrics: WebVitalMetric[]): Record<string, MetricAggregate> | null {
  if (metrics.length === 0) return null;

  const byName: Record<string, number[]> = {};

  metrics.forEach(m => {
    if (!byName[m.name]) byName[m.name] = [];
    byName[m.name].push(m.value);
  });

  const aggregates: Record<string, MetricAggregate> = {};

  Object.keys(byName).forEach(name => {
    const values = byName[name].sort((a, b) => a - b);
    const len = values.length;

    aggregates[name] = {
      count: len,
      min: values[0],
      max: values[len - 1],
      avg: values.reduce((a, b) => a + b, 0) / len,
      p50: values[Math.floor(len * 0.5)],
      p75: values[Math.floor(len * 0.75)],
      p90: values[Math.floor(len * 0.9)],
      p95: values[Math.floor(len * 0.95)],
      p99: values[Math.floor(len * 0.99)]
    };
  });

  return aggregates;
}

async function sendToDatadog(metric: WebVitalMetric) {
  // Send metric to Datadog
  const datadogMetric = {
    series: [{
      metric: `vibecode.rum.${metric.name.toLowerCase()}`,
      points: [[Math.floor(Date.now() / 1000), metric.value]],
      type: 'gauge',
      tags: [
        `rating:${metric.rating}`,
        `navigation_type:${metric.navigationType || 'unknown'}`
      ]
    }]
  };

  try {
    await fetch('https://api.datadoghq.com/api/v1/series', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': process.env.DD_API_KEY!
      },
      body: JSON.stringify(datadogMetric)
    });
  } catch (error) {
    console.error('Failed to send metric to Datadog:', error);
  }
}
