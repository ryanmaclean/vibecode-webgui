import { NextRequest, NextResponse } from 'next/server';
import { getMetricsCollector } from '@/lib/db/database-metrics';
import { getConnectionPoolStatus } from '@/lib/db/robust-db-connection';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const collector = getMetricsCollector();
  const poolStatus = getConnectionPoolStatus();
  
  // Update connection metrics
  collector.setConnectionMetrics(
    poolStatus.size,
    poolStatus.inUse,
    poolStatus.maxSize
  );
  
  // Get current metrics
  const metrics = collector.getMetrics();
  
  return NextResponse.json({
    metrics,
    poolStatus,
    timestamp: new Date().toISOString(),
  });
}