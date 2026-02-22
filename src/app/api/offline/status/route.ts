/**
 * Offline Status API Endpoint
 * Provides current offline mode status, metrics, and configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { getDefaultOfflineDetector } from '@/lib/offline-mode';
import { getOfflineConfig } from '@/lib/config/offline-config';

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute

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
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get offline detector instance
    const detector = getDefaultOfflineDetector();

    // Get current status and metrics
    const status = detector.getStatus();
    const isOnline = detector.isOnline();
    const metrics = detector.getMetrics();

    // Get offline configuration
    const config = await getOfflineConfig();

    return NextResponse.json({
      online: isOnline,
      status,
      metrics: {
        totalHealthChecks: metrics.totalHealthChecks,
        successfulHealthChecks: metrics.successfulHealthChecks,
        failedHealthChecks: metrics.failedHealthChecks,
        consecutiveFailures: metrics.consecutiveFailures,
        consecutiveSuccesses: metrics.consecutiveSuccesses,
        lastSuccessTime: metrics.lastSuccessTime,
        lastFailureTime: metrics.lastFailureTime,
        lastStatusChangeTime: metrics.lastStatusChangeTime,
        totalStatusChanges: metrics.totalStatusChanges,
        avgHealthCheckDuration: metrics.avgHealthCheckDuration,
        uptimePercentage: metrics.uptimePercentage,
        timeOnline: metrics.timeOnline,
        timeOffline: metrics.timeOffline,
      },
      config: {
        autoFallbackEnabled: config.autoFallbackEnabled,
        preferredLocalModel: config.preferredLocalModel,
        fallbackLocalModels: config.fallbackLocalModels,
        showOfflineNotifications: config.showOfflineNotifications,
        offlineCheckInterval: config.offlineCheckInterval,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Server error logged
    return NextResponse.json(
      {
        error: 'Failed to get offline status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
