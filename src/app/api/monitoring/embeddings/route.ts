import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { AzureEmbeddingService } from '@/lib/ai/azureEmbeddingService';
import { EmbeddingService } from '@/lib/ai/embeddingService';
import { EmbeddingServiceFactory, EmbeddingServiceType } from '@/lib/ai/embeddingServiceFactory';
import { DatadogIntegration } from '@/lib/monitoring/datadog-integration';
import { PrismaClient } from '@prisma/client';
// import { logger } from '@/lib/logger';
// Global service instance for monitoring
let embeddingService: EmbeddingServiceType | null = null;
let serviceReleaseFunction: (() => Promise<void>) | null = null;

async function getEmbeddingService(): Promise<EmbeddingServiceType> {
  if (!embeddingService) {
    try {
      const { service, releaseConnection } = await EmbeddingServiceFactory.createEmbeddingServiceWithRobustConnection();
      embeddingService = service;
      serviceReleaseFunction = releaseConnection;
    } catch (error) {
      console.error('Failed to create embedding service:', error);
      throw new Error('Embedding service not available');
    }
  }
  return embeddingService;
}

// Clean up function for graceful shutdown
export async function cleanup() {
  if (serviceReleaseFunction) {
    await serviceReleaseFunction();
    serviceReleaseFunction = null;
  }
  embeddingService = null;
}

/**
 * GET /api/monitoring/embeddings
 * Returns comprehensive embedding service metrics and usage data
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const detailed = searchParams.get('detailed') === 'true';

    const service = await getEmbeddingService();
    
    // Check if service has monitoring capabilities (Azure service)
    const hasMonitoring = 'getUsageReport' in service && 'getApiMetrics' in service;
    
    if (hasMonitoring) {
      // Azure service with monitoring
      const azureService = service as AzureEmbeddingService;
      
      if (detailed) {
        const usageReport = azureService.getUsageReport();
        
        if (format === 'prometheus') {
          // Return Prometheus format metrics
          const prometheusMetrics = convertToPrometheusFormat(usageReport);
          return new NextResponse(prometheusMetrics, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8'
            }
          });
        }
        
        return NextResponse.json({
          timestamp: new Date().toISOString(),
          service: 'azure-embedding',
          status: 'active',
          monitoringEnabled: true,
          ...usageReport
        });
      } else {
        // Return basic metrics
        const metrics = azureService.getApiMetrics();
        const recentCalls = azureService.getRecentCalls(10);
        
        return NextResponse.json({
          timestamp: new Date().toISOString(),
          service: 'azure-embedding',
          status: 'active',
          monitoringEnabled: true,
          metrics,
          recentCalls: recentCalls.map(call => ({
            timestamp: call.timestamp,
            duration: call.duration,
            success: call.success,
            tokens: call.tokens,
            cost: call.cost,
            errorType: call.errorType
          }))
        });
      }
    } else {
      // OpenAI or other service without built-in monitoring
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        service: 'openai-embedding',
        status: 'active',
        monitoringEnabled: false,
        message: 'This service does not have built-in monitoring capabilities',
        suggestion: 'Consider switching to Azure embedding service for comprehensive monitoring'
      });
    }
  } catch (error: any) {
    console.error('Error fetching embedding metrics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch embedding metrics',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/embeddings/alerts
 * Configure alert thresholds
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { thresholds } = body;
    
    if (!thresholds) {
      return NextResponse.json(
        { error: 'Alert thresholds are required' },
        { status: 400 }
      );
    }
    
    const service = await getEmbeddingService();
    
    // Check if service has monitoring capabilities
    if ('updateAlertThresholds' in service) {
      const azureService = service as AzureEmbeddingService;
      azureService.updateAlertThresholds(thresholds);
      
      return NextResponse.json({
        message: 'Alert thresholds updated successfully',
        thresholds,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { error: 'Alert configuration not supported for this embedding service' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error updating alert thresholds:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update alert thresholds',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/monitoring/embeddings/metrics
 * Reset metrics (useful for testing or clean slate)
 */
export async function DELETE() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const service = await getEmbeddingService();
    
    // Check if service has monitoring capabilities
    if ('resetMetrics' in service) {
      const azureService = service as AzureEmbeddingService;
      azureService.resetMetrics();
      
      return NextResponse.json({
        message: 'Embedding metrics reset successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { error: 'Metrics reset not supported for this embedding service' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error resetting embedding metrics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to reset embedding metrics',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Convert usage report to Prometheus format
 */
function convertToPrometheusFormat(report: any): string {
  const lines: string[] = [];
  const timestamp = Date.now();
  
  // Summary metrics
  lines.push(`# HELP azure_embedding_requests_total Total number of embedding requests`);
  lines.push(`# TYPE azure_embedding_requests_total counter`);
  lines.push(`azure_embedding_requests_total{service="azure-embedding"} ${report.summary.requestCount} ${timestamp}`);
  
  lines.push(`# HELP azure_embedding_tokens_total Total number of tokens used`);
  lines.push(`# TYPE azure_embedding_tokens_total counter`);
  lines.push(`azure_embedding_tokens_total{service="azure-embedding"} ${report.summary.totalTokens} ${timestamp}`);
  
  lines.push(`# HELP azure_embedding_cost_total Total cost in USD`);
  lines.push(`# TYPE azure_embedding_cost_total counter`);
  lines.push(`azure_embedding_cost_total{service="azure-embedding"} ${report.summary.totalCost} ${timestamp}`);
  
  lines.push(`# HELP azure_embedding_errors_total Total number of errors`);
  lines.push(`# TYPE azure_embedding_errors_total counter`);
  lines.push(`azure_embedding_errors_total{service="azure-embedding"} ${report.summary.errorCount} ${timestamp}`);
  
  lines.push(`# HELP azure_embedding_latency_avg_ms Average latency in milliseconds`);
  lines.push(`# TYPE azure_embedding_latency_avg_ms gauge`);
  lines.push(`azure_embedding_latency_avg_ms{service="azure-embedding"} ${report.summary.avgLatency} ${timestamp}`);
  
  // Error breakdown
  lines.push(`# HELP azure_embedding_errors_by_type Errors broken down by type`);
  lines.push(`# TYPE azure_embedding_errors_by_type counter`);
  Object.entries(report.errorBreakdown as Record<string, number>).forEach(([errorType, count]) => {
    lines.push(`azure_embedding_errors_by_type{service="azure-embedding",error_type="${errorType}"} ${count} ${timestamp}`);
  });
  
  // Hourly breakdown
  lines.push(`# HELP azure_embedding_hourly_requests Requests per hour`);
  lines.push(`# TYPE azure_embedding_hourly_requests gauge`);
  report.hourlyBreakdown.forEach((hour: any) => {
    const hourTimestamp = new Date(hour.hour).getTime();
    lines.push(`azure_embedding_hourly_requests{service="azure-embedding",hour="${hour.hour}"} ${hour.requests} ${hourTimestamp}`);
    lines.push(`azure_embedding_hourly_tokens{service="azure-embedding",hour="${hour.hour}"} ${hour.tokens} ${hourTimestamp}`);
    lines.push(`azure_embedding_hourly_cost{service="azure-embedding",hour="${hour.hour}"} ${hour.cost} ${hourTimestamp}`);
    lines.push(`azure_embedding_hourly_errors{service="azure-embedding",hour="${hour.hour}"} ${hour.errors} ${hourTimestamp}`);
  });
  
  return lines.join('\n') + '\n';
}