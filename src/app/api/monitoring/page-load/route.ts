/**
 * Page Load Metrics API
 * 
 * Collects detailed page load performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(120) // 120 requests per minute - monitoring data

interface PageLoadMetrics {
  url: string;
  timestamp: number;
  metrics: {
    dns: number;
    tcp: number;
    ttfb: number;
    download: number;
    domInteractive: number;
    domComplete: number;
    loadComplete: number;
  };
}

// In-memory storage (replace with database in production)
const pageLoadMetrics: PageLoadMetrics[] = [];
const MAX_METRICS = 10000;

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
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
    )
  }

  try {
    const data: PageLoadMetrics = await request.json();

    // Validate data
    if (!data.url || !data.metrics) {
      return NextResponse.json(
        { error: 'Invalid page load data' },
        { status: 400 }
      );
    }

    // Store metrics
    pageLoadMetrics.push(data);

    // Keep only recent metrics
    if (pageLoadMetrics.length > MAX_METRICS) {
      pageLoadMetrics.shift();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing page load metrics:', error);
    return NextResponse.json(
      { error: 'Failed to store metrics' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
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
    )
  }

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const since = searchParams.get('since');

    let filteredMetrics = pageLoadMetrics;

    // Filter by URL
    if (url) {
      filteredMetrics = filteredMetrics.filter(m => m.url === url);
    }

    // Filter by time
    if (since) {
      const sinceTime = parseInt(since);
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= sinceTime);
    }

    // Calculate aggregates
    const aggregates = calculatePageLoadAggregates(filteredMetrics);

    return NextResponse.json({
      count: filteredMetrics.length,
      metrics: filteredMetrics.slice(-50),
      aggregates
    });
  } catch (error) {
    console.error('Error retrieving page load metrics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    );
  }
}

function calculatePageLoadAggregates(metrics: PageLoadMetrics[]) {
  if (metrics.length === 0) return null;

  const metricKeys = ['dns', 'tcp', 'ttfb', 'download', 'domInteractive', 'domComplete', 'loadComplete'];
  const aggregates: Record<string, any> = {};

  metricKeys.forEach(key => {
    const values = metrics
      .map(m => m.metrics[key as keyof typeof m.metrics])
      .filter(v => typeof v === 'number')
      .sort((a, b) => a - b);

    if (values.length > 0) {
      const len = values.length;
      aggregates[key] = {
        count: len,
        min: values[0],
        max: values[len - 1],
        avg: values.reduce((a, b) => a + b, 0) / len,
        p50: values[Math.floor(len * 0.5)],
        p75: values[Math.floor(len * 0.75)],
        p90: values[Math.floor(len * 0.9)],
        p95: values[Math.floor(len * 0.95)]
      };
    }
  });

  return aggregates;
}
