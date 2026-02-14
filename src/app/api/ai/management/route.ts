/**
 * AI Model Management and Monitoring API
 * Provides comprehensive AI model usage, cost tracking, and performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken, JWT } from 'next-auth/jwt';
import { litellmClient, ModelInfo } from '../../../../lib/ai/litellm-client';
import { prisma } from '../../../../lib/prisma';
import { cache, CacheTTL } from '../../../../lib/cache/unified-cache-client';
import { validateQueryParams } from '@/lib/api/validation/middleware';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { z } from 'zod';
import {
  MAX_PAGE_SIZE,
  clampLimit,
} from '@/lib/api/pagination';

export const dynamic = 'force-dynamic'

// Define inline schema since schemas-phase4-batch2 doesn't exist
const aiManagementActionSchema = z.object({
  action: z.enum(['overview', 'models', 'usage', 'costs', 'health', 'performance', 'users']),
  timeframe: z.string().optional().default('24h')
});

export const runtime = 'nodejs';

const apiRateLimit = createAPIRateLimit(60) // 60 req/min

// Type Definitions
interface AIRequestData {
  id: number;
  user_id: number;
  project_id: number | null;
  request_type: string;
  model: string;
  provider: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
  duration_ms: number | null;
  status: string;
  created_at: Date;
  user?: {
    id: number;
    name: string | null;
    email: string;
  } | null;
  project?: {
    id: number;
    name: string;
  } | null;
}

interface ModelData {
  name: string;
  provider: string;
  category: string;
  quality: string;
  costPerInputToken: number;
  costPerOutputToken: number;
  status?: string;
}

interface FieldAggregation {
  requests: number;
  tokens: {
    input: number;
    output: number;
  };
  cost: number;
}

// Usage stats model type from LiteLLM
interface UsageModelStats {
  requests: number;
  tokens: number;
  cost: number;
}

interface UserAnalysisData {
  userId: number;
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  requests: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  averageLatency: number;
}

interface LatencyStats {
  average: number;
  p95: number;
  count: number;
}

interface PerformanceRequest {
  model: string;
  provider: string;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  status: string;
}

// Database record types for queries
interface AIRequestRecord {
  model: string;
  provider: string;
  request_type: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
  duration_ms: number | null;
  status: string;
  created_at: Date;
  user_id?: number;
}

interface CostRecord {
  model: string;
  provider: string;
  cost: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: Date;
  user_id: number;
}

// Extended JWT type for test mode
interface ExtendedJWT extends Omit<JWT, 'role'> {
  role?: string;
  id?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitResult = await apiRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      })
    }

    // Validate query parameters
    const queryValidation = validateQueryParams(request, aiManagementActionSchema);
    if (!queryValidation.success) {
      return queryValidation.error as NextResponse;
    }

    const { action, timeframe } = queryValidation.data;

    let token: ExtendedJWT | null = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    }) as ExtendedJWT | null;

    // Development testing bypass
    const isTestMode = request.headers.get('x-test-mode') === 'true';
    const testUserId = request.headers.get('x-test-user-id') || 'test1';
    const testRole = request.headers.get('x-test-user-role') || 'developer';

    if (isTestMode) {
      token = {
        sub: testUserId,
        id: testUserId,
        role: testRole,
        email: `${testUserId}@test.com`,
        name: `Test User ${testUserId}`
      } as ExtendedJWT;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'overview':
        return handleOverview(token.sub || undefined, timeframe);

      case 'models':
        return handleModels();

      case 'usage':
        return handleUsageStats(token.sub || undefined, token.role === 'admin' ? undefined : (token.sub || undefined), timeframe);

      case 'costs':
        return handleCostAnalysis(token.sub || undefined, token.role === 'admin' ? undefined : (token.sub || undefined), timeframe);

      case 'health':
        return handleHealthCheck();

      case 'performance':
        return handlePerformanceMetrics(timeframe);

      case 'users':
        // Admin-only endpoint
        if (token.role !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }
        return handleUserAnalysis(timeframe);

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    // Server error logged
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleOverview(userId?: string, timeframe = '24h') {
  const cacheKey = `ai:overview:${userId}:${timeframe}`;
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    return NextResponse.json(cached);
  }

  const [models, health, usage] = await Promise.all([
    litellmClient.getModels(),
    litellmClient.healthCheck(),
    litellmClient.getUsageStats(userId, timeframe)
  ]);

  // Get recent AI requests from database (limited for overview)
  const RECENT_REQUESTS_LIMIT = 10;
  const recentRequests = await prisma.aIRequest.findMany({
    where: {
      ...(userId && { user_id: parseInt(userId) }),
      created_at: {
        gte: getTimeframeStart(timeframe)
      }
    },
    orderBy: { created_at: 'desc' },
    take: RECENT_REQUESTS_LIMIT,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      project: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  const overview = {
    timestamp: new Date().toISOString(),
    timeframe,
    summary: {
      totalModels: models.length,
      healthyModels: Object.values(health.models).filter((status) => status === 'healthy').length,
      totalRequests: usage.requests,
      totalTokens: usage.tokens.total,
      totalCost: usage.cost,
      proxyLatency: health.latency,
      proxyStatus: health.status
    },
    models: {
      byProvider: groupModelsByProvider(models),
      byCategory: groupModelsByCategory(models),
      byQuality: groupModelsByQuality(models)
    },
    usage: {
      requests: usage.requests,
      tokens: usage.tokens,
      cost: usage.cost,
      topModels: Object.entries(usage.models)
        .sort(([,a], [,b]) => (b as UsageModelStats).requests - (a as UsageModelStats).requests)
        .slice(0, 5)
        .map(([model, stats]) => ({ model, ...(stats as UsageModelStats) }))
    },
    recentActivity: recentRequests.map((req: AIRequestData) => ({
      id: req.id,
      timestamp: req.created_at,
      user: req.user?.name || req.user?.email,
      project: req.project?.name,
      model: req.model,
      provider: req.provider,
      type: req.request_type,
      tokens: {
        input: req.input_tokens,
        output: req.output_tokens,
        total: (req.input_tokens || 0) + (req.output_tokens || 0)
      },
      cost: req.cost,
      duration: req.duration_ms,
      status: req.status
    }))
  };

  await cache.set(cacheKey, overview, CacheTTL.SHORT);
  return NextResponse.json(overview);
}

async function handleModels() {
  const cacheKey = 'ai:models:list';
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    return NextResponse.json(cached);
  }

  const [models, health] = await Promise.all([
    litellmClient.getModels(),
    litellmClient.healthCheck()
  ]);

  const modelsWithHealth = models.map((model: ModelInfo) => ({
    ...model,
    status: health.models[model.name] || 'unknown',
    lastChecked: new Date().toISOString()
  }));

  const response = {
    timestamp: new Date().toISOString(),
    total: modelsWithHealth.length,
    models: modelsWithHealth,
    summary: {
      byProvider: groupModelsByProvider(modelsWithHealth),
      byCategory: groupModelsByCategory(modelsWithHealth),
      byStatus: groupModelsByStatus(modelsWithHealth),
      healthyCount: modelsWithHealth.filter((m) => m.status === 'healthy').length,
      averageCostPerToken: calculateAverageCost(modelsWithHealth)
    }
  };

  await cache.set(cacheKey, response, CacheTTL.MEDIUM);
  return NextResponse.json(response);
}

async function handleUsageStats(requestUserId?: string, filterUserId?: string, timeframe = '24h') {
  const cacheKey = `ai:usage:${filterUserId || 'all'}:${timeframe}`;
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    return NextResponse.json(cached);
  }

  // Get usage from LiteLLM proxy
  const proxyUsage = await litellmClient.getUsageStats(filterUserId, timeframe);

  // Get detailed usage from database (with pagination limit to prevent resource exhaustion)
  const usageQueryLimit = clampLimit(MAX_PAGE_SIZE.AI_REQUESTS * 10, MAX_PAGE_SIZE.METRICS);
  const dbRequests: AIRequestRecord[] = await prisma.aIRequest.findMany({
    where: {
      ...(filterUserId && { user_id: parseInt(filterUserId) }),
      created_at: {
        gte: getTimeframeStart(timeframe)
      }
    },
    select: {
      model: true,
      provider: true,
      request_type: true,
      input_tokens: true,
      output_tokens: true,
      cost: true,
      duration_ms: true,
      status: true,
      created_at: true
    },
    take: usageQueryLimit,
    orderBy: { created_at: 'desc' }
  });

  // Aggregate database statistics
  const dbStats = {
    totalRequests: dbRequests.length,
    successfulRequests: (dbRequests as AIRequestData[]).filter((r) => r.status === 'completed').length,
    failedRequests: (dbRequests as AIRequestData[]).filter((r) => r.status === 'failed').length,
    totalTokens: {
      input: (dbRequests as AIRequestData[]).reduce((sum, r) => sum + (r.input_tokens || 0), 0),
      output: (dbRequests as AIRequestData[]).reduce((sum, r) => sum + (r.output_tokens || 0), 0)
    },
    totalCost: (dbRequests as AIRequestData[]).reduce((sum, r) => sum + (r.cost || 0), 0),
    averageLatency: dbRequests.length > 0
      ? (dbRequests as AIRequestData[]).reduce((sum, r) => sum + (r.duration_ms || 0), 0) / dbRequests.length 
      : 0,
    byModel: aggregateByField(dbRequests, 'model'),
    byProvider: aggregateByField(dbRequests, 'provider'),
    byType: aggregateByField(dbRequests, 'request_type'),
    timeline: generateTimeline(dbRequests, timeframe)
  };

  const response = {
    timestamp: new Date().toISOString(),
    timeframe,
    proxy: proxyUsage,
    database: dbStats,
    combined: {
      requests: Math.max(proxyUsage.requests, dbStats.totalRequests),
      tokens: {
        input: Math.max(proxyUsage.tokens.input, dbStats.totalTokens.input),
        output: Math.max(proxyUsage.tokens.output, dbStats.totalTokens.output),
        total: Math.max(proxyUsage.tokens.total, dbStats.totalTokens.input + dbStats.totalTokens.output)
      },
      cost: Math.max(proxyUsage.cost, dbStats.totalCost),
      successRate: dbStats.totalRequests > 0 ? (dbStats.successfulRequests / dbStats.totalRequests) * 100 : 100,
      averageLatency: dbStats.averageLatency
    }
  };

  await cache.set(cacheKey, response, CacheTTL.SHORT);
  return NextResponse.json(response);
}

async function handleCostAnalysis(requestUserId?: string, filterUserId?: string, timeframe = '24h') {
  // Apply pagination limit to prevent resource exhaustion
  const costQueryLimit = clampLimit(MAX_PAGE_SIZE.AI_REQUESTS * 10, MAX_PAGE_SIZE.METRICS);
  const dbRequests: CostRecord[] = await prisma.aIRequest.findMany({
    where: {
      ...(filterUserId && { user_id: parseInt(filterUserId) }),
      created_at: {
        gte: getTimeframeStart(timeframe)
      },
      cost: {
        not: null
      }
    },
    select: {
      model: true,
      provider: true,
      cost: true,
      input_tokens: true,
      output_tokens: true,
      created_at: true,
      user_id: true
    },
    take: costQueryLimit,
    orderBy: { created_at: 'desc' }
  });

  const totalCost = dbRequests.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalTokens = dbRequests.reduce((sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0), 0);

  const costAnalysis: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    timeframe,
    total: {
      cost: totalCost,
      requests: dbRequests.length,
      tokens: totalTokens
    },
    byModel: aggregateCostByField(dbRequests, 'model'),
    byProvider: aggregateCostByField(dbRequests, 'provider'),
    timeline: generateCostTimeline(dbRequests, timeframe),
    efficiency: {
      costPerToken: dbRequests.length > 0 && totalTokens > 0
        ? totalCost / totalTokens
        : 0,
      costPerRequest: dbRequests.length > 0
        ? totalCost / dbRequests.length
        : 0
    }
  };

  if (requestUserId && requestUserId === 'admin') {
    (costAnalysis as { byUser?: ReturnType<typeof aggregateCostByField> }).byUser = aggregateCostByField(dbRequests, 'user_id');
  }

  return NextResponse.json(costAnalysis);
}

async function handleHealthCheck() {
  const health = await litellmClient.healthCheck();
  
  const response = {
    timestamp: new Date().toISOString(),
    proxy: health,
    models: Object.entries(health.models).map(([model, status]) => ({
      model,
      status,
      lastChecked: new Date().toISOString()
    })),
    summary: {
      overallStatus: health.status,
      healthyModels: Object.values(health.models).filter((s) => s === 'healthy').length,
      totalModels: Object.keys(health.models).length,
      latency: health.latency
    }
  };

  return NextResponse.json(response);
}

async function handlePerformanceMetrics(timeframe = '24h') {
  // Apply pagination limit to prevent resource exhaustion
  const performanceQueryLimit = clampLimit(MAX_PAGE_SIZE.AI_REQUESTS * 10, MAX_PAGE_SIZE.METRICS);
  const requests: PerformanceRequest[] = await prisma.aIRequest.findMany({
    where: {
      created_at: {
        gte: getTimeframeStart(timeframe)
      },
      duration_ms: {
        not: null
      }
    },
    select: {
      model: true,
      provider: true,
      duration_ms: true,
      input_tokens: true,
      output_tokens: true,
      status: true
    },
    take: performanceQueryLimit,
    orderBy: { created_at: 'desc' }
  });

  const performance = {
    timestamp: new Date().toISOString(),
    timeframe,
    latency: {
      average: requests.length > 0
        ? requests.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / requests.length
        : 0,
      p95: calculatePercentile(requests.map((r) => r.duration_ms || 0), 95),
      p99: calculatePercentile(requests.map((r) => r.duration_ms || 0), 99),
      byModel: aggregateLatencyByField(requests, 'model'),
      byProvider: aggregateLatencyByField(requests, 'provider')
    },
    throughput: {
      requestsPerSecond: requests.length / getTimeframeSeconds(timeframe),
      tokensPerSecond: requests.reduce((sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0), 0) / getTimeframeSeconds(timeframe)
    },
    reliability: {
      successRate: requests.length > 0
        ? (requests.filter((r) => r.status === 'completed').length / requests.length) * 100
        : 100,
      errorRate: requests.length > 0
        ? (requests.filter((r) => r.status === 'failed').length / requests.length) * 100
        : 0
    }
  };

  return NextResponse.json(performance);
}

async function handleUserAnalysis(timeframe = '24h') {
  const userStats = await prisma.aIRequest.groupBy({
    by: ['user_id'],
    where: {
      created_at: {
        gte: getTimeframeStart(timeframe)
      }
    },
    _count: {
      id: true
    },
    _sum: {
      input_tokens: true,
      output_tokens: true,
      cost: true,
      duration_ms: true
    }
  });

  const userIds = userStats.map((s) => s.user_id);
  const userDetails = await prisma.user.findMany({
    where: {
      id: {
        in: userIds
      }
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  });

  const analysis: UserAnalysisData[] = userStats.map((stats) => {
    const user = userDetails.find((u) => u.id === stats.user_id);
    return {
      userId: stats.user_id,
      userName: user?.name,
      userEmail: user?.email,
      requests: stats._count.id,
      tokens: {
        input: stats._sum.input_tokens || 0,
        output: stats._sum.output_tokens || 0,
        total: (stats._sum.input_tokens || 0) + (stats._sum.output_tokens || 0)
      },
      cost: stats._sum.cost || 0,
      averageLatency: stats._count.id > 0 ? (stats._sum.duration_ms || 0) / stats._count.id : 0
    };
  }).sort((a, b) => b.cost - a.cost);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    timeframe,
    totalUsers: analysis.length,
    users: analysis,
    aggregates: {
      totalRequests: analysis.reduce((sum, u) => sum + u.requests, 0),
      totalTokens: analysis.reduce((sum, u) => sum + u.tokens.total, 0),
      totalCost: analysis.reduce((sum, u) => sum + u.cost, 0),
      topUsers: analysis.slice(0, 10)
    }
  });
}

// Helper functions

function getTimeframeStart(timeframe: string): Date {
  const now = new Date();
  const hours = timeframe.endsWith('h') ? parseInt(timeframe) : 24;
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

function getTimeframeSeconds(timeframe: string): number {
  const hours = timeframe.endsWith('h') ? parseInt(timeframe) : 24;
  return hours * 60 * 60;
}

function groupModelsByProvider(models: ModelInfo[]): Record<string, number> {
  return models.reduce((acc: Record<string, number>, model) => {
    acc[model.provider] = (acc[model.provider] || 0) + 1;
    return acc;
  }, {});
}

function groupModelsByCategory(models: ModelInfo[]): Record<string, number> {
  return models.reduce((acc: Record<string, number>, model) => {
    acc[model.category] = (acc[model.category] || 0) + 1;
    return acc;
  }, {});
}

function groupModelsByQuality(models: ModelInfo[]): Record<string, number> {
  return models.reduce((acc: Record<string, number>, model) => {
    acc[model.quality] = (acc[model.quality] || 0) + 1;
    return acc;
  }, {});
}

function groupModelsByStatus(models: (ModelInfo & { status: string })[]): Record<string, number> {
  return models.reduce((acc: Record<string, number>, model) => {
    acc[model.status] = (acc[model.status] || 0) + 1;
    return acc;
  }, {});
}

function calculateAverageCost(models: ModelInfo[]): number {
  if (models.length === 0) return 0;
  const totalCost = models.reduce((sum, m) => sum + m.costPerInputToken + m.costPerOutputToken, 0);
  return totalCost / models.length;
}

function aggregateByField(requests: AIRequestRecord[], field: keyof AIRequestRecord): Record<string, FieldAggregation> {
  return requests.reduce((acc: Record<string, FieldAggregation>, req) => {
    const key = String(req[field] || 'unknown');
    if (!acc[key]) {
      acc[key] = { requests: 0, tokens: { input: 0, output: 0 }, cost: 0 };
    }
    acc[key].requests += 1;
    acc[key].tokens.input += req.input_tokens || 0;
    acc[key].tokens.output += req.output_tokens || 0;
    acc[key].cost += req.cost || 0;
    return acc;
  }, {});
}

function aggregateCostByField(requests: CostRecord[], field: keyof CostRecord): Record<string, number> {
  return requests.reduce((acc: Record<string, number>, req) => {
    const key = String(req[field] || 'unknown');
    acc[key] = (acc[key] || 0) + (req.cost || 0);
    return acc;
  }, {});
}

function aggregateLatencyByField(requests: PerformanceRequest[], field: keyof PerformanceRequest): Record<string, LatencyStats> {
  const grouped = requests.reduce((acc: Record<string, number[]>, req) => {
    const key = String(req[field] || 'unknown');
    if (!acc[key]) acc[key] = [];
    acc[key].push(req.duration_ms || 0);
    return acc;
  }, {});

  return Object.entries(grouped).reduce((acc: Record<string, LatencyStats>, [key, latencies]) => {
    acc[key] = {
      average: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      p95: calculatePercentile(latencies, 95),
      count: latencies.length
    };
    return acc;
  }, {});
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

function generateTimeline(_requests: AIRequestRecord[], _timeframe: string): unknown[] {
  // Implementation for generating timeline data
  // This would create hourly/daily buckets based on timeframe
  return [];
}

function generateCostTimeline(_requests: CostRecord[], _timeframe: string): unknown[] {
  // Implementation for generating cost timeline
  return [];
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitResult = await apiRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      })
    }

    // Implementation for administrative actions like model configuration
    return NextResponse.json({ message: 'POST endpoint not implemented' }, { status: 501 });
  } catch (error) {
    // Server error logged
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
