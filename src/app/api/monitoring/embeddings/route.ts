import { NextRequest, NextResponse } from 'next/server';
import { AzureEmbeddingService } from '@/lib/ai/azureEmbeddingService';
import { DatadogIntegration } from '@/lib/monitoring/datadog-integration';

// Global service instance for monitoring
let embeddingService: AzureEmbeddingService | null = null;

function getEmbeddingService(): AzureEmbeddingService {
  if (!embeddingService) {
    embeddingService = new AzureEmbeddingService(
      process.env.AZURE_OPENAI_API_KEY || '',
      process.env.AZURE_OPENAI_ENDPOINT || '',
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'text-embedding-ada-002',
      process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
      null,
      process.env.AZURE_USE_MANAGED_IDENTITY === 'true',
      process.env.USE_CONNECTION_POOL === 'true'
    );
  }
  return embeddingService;
}

/**
 * GET /api/monitoring/embeddings
 * Returns comprehensive embedding service metrics and usage data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const detailed = searchParams.get('detailed') === 'true';

    const service = getEmbeddingService();
    
    if (detailed) {
      const usageReport = service.getUsageReport();
      
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
        ...usageReport
      });
    } else {
      // Return basic metrics
      const metrics = service.getApiMetrics();
      const recentCalls = service.getRecentCalls(10);
      
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        service: 'azure-embedding',
        status: 'active',
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
    const body = await request.json();
    const { thresholds } = body;
    
    if (!thresholds) {
      return NextResponse.json(
        { error: 'Alert thresholds are required' },
        { status: 400 }
      );
    }
    
    const service = getEmbeddingService();
    service.updateAlertThresholds(thresholds);
    
    return NextResponse.json({
      message: 'Alert thresholds updated successfully',
      thresholds,
      timestamp: new Date().toISOString()
    });
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
    const service = getEmbeddingService();
    service.resetMetrics();
    
    return NextResponse.json({
      message: 'Embedding metrics reset successfully',
      timestamp: new Date().toISOString()
    });
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