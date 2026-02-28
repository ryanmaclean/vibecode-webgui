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
import { OfflineFeatureManager } from '@/lib/offline-features';

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

    // Get feature availability status
    const featureManager = OfflineFeatureManager.getInstance();
    const featureStatus = await featureManager.checkAllFeatures();

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
      features: {
        ai: {
          status: featureStatus.ai.status,
          available: featureStatus.ai.available,
          ollamaAvailable: featureStatus.ai.ollamaAvailable,
          installedModels: featureStatus.ai.installedModels,
          recommendedModels: featureStatus.ai.recommendedModels,
          missingModels: featureStatus.ai.missingModels,
          hasRecommendedModel: featureStatus.ai.hasRecommendedModel,
          modelCount: featureStatus.ai.modelCount,
        },
        vectorDb: {
          status: featureStatus.vectorDb.status,
          available: featureStatus.vectorDb.available,
          connected: featureStatus.vectorDb.connected,
          pgVectorInstalled: featureStatus.vectorDb.pgVectorInstalled,
          provider: featureStatus.vectorDb.provider,
        },
        cache: {
          status: featureStatus.cache.status,
          available: featureStatus.cache.available,
          enabled: featureStatus.cache.enabled,
          backend: featureStatus.cache.backend,
        },
        templates: {
          status: featureStatus.templates.status,
          available: featureStatus.templates.available,
          templateCount: featureStatus.templates.templateCount,
          localOnly: featureStatus.templates.localOnly,
        },
        offlineReady: featureStatus.offlineReady,
        availableFeatures: featureStatus.availableFeatures,
        unavailableFeatures: featureStatus.unavailableFeatures,
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
