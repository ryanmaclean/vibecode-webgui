/**
 * AI Costs API endpoint for VibeCode
 *
 * Handles cost tracking, estimation, and alert management:
 * - GET /api/ai/costs - Get usage stats and history
 * - GET /api/ai/costs?action=estimate - Estimate cost for input
 * - POST /api/ai/costs - Record usage or manage alerts
 *
 * @module app/api/ai/costs/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  CostApiResponse,
  CostEstimateApiResponse,
  CostAlertApiResponse,
  CostAlertRequest,
  UsageStats,
  CostSettings,
  TimePeriod,
} from '@/types/cost-estimation';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const estimateQuerySchema = z.object({
  message: z.string().min(1).max(100000, 'Message too long'),
  model: z.string().min(1),
  outputTokens: z.coerce.number().min(0).max(100000).optional(),
  compare: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});

const usageRecordSchema = z.object({
  action: z.literal('record_usage'),
  modelId: z.string().min(1),
  promptTokens: z.number().min(0),
  completionTokens: z.number().min(0),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  workspaceId: z.string().optional(),
});

const alertManagementSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'acknowledge']),
  alertId: z.string().optional(),
  config: z
    .object({
      type: z.enum([
        'budget_threshold',
        'daily_limit',
        'session_limit',
        'rate_spike',
        'unusual_usage',
      ]),
      threshold: z.number().min(0),
      enabled: z.boolean(),
      notifyOnTrigger: z.boolean(),
      notificationChannels: z.array(
        z.enum(['in_app', 'email', 'slack', 'webhook'])
      ),
      resetPeriod: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
    })
    .optional(),
});

const settingsUpdateSchema = z.object({
  action: z.literal('update_settings'),
  settings: z.object({
    monthlyBudget: z.number().min(0).optional(),
    dailyBudget: z.number().min(0).optional(),
    sessionBudget: z.number().min(0).optional(),
    displayMode: z.enum(['per_request', 'session', 'daily', 'monthly']).optional(),
    showEstimatesBeforeSend: z.boolean().optional(),
    showRealtimeCosts: z.boolean().optional(),
    enableOptimizationSuggestions: z.boolean().optional(),
  }),
});

// ============================================================================
// Server-side Cost Tracking (simplified for API)
// ============================================================================

// In a production environment, this would be backed by a database
// For now, we provide the API structure that can be consumed by the client-side tracker

interface ServerCostState {
  settings: CostSettings;
  usage: UsageStats[];
}

// Default state (in production, load from database)
const DEFAULT_SERVER_STATE: ServerCostState = {
  settings: {
    monthlyBudget: 0,
    dailyBudget: 0,
    sessionBudget: 0,
    displayMode: 'session',
    showEstimatesBeforeSend: true,
    showRealtimeCosts: true,
    alertThresholds: {
      warning: 75,
      critical: 90,
      dailyWarning: 80,
      sessionWarning: 90,
    },
    displayCurrency: 'USD',
    enableOptimizationSuggestions: true,
    preferredEconomyModels: ['gpt-3.5-turbo', 'claude-3-haiku', 'gemini-pro'],
  },
  usage: [],
};

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Log request
    logger.info('Cost API GET request', {
      action,
      requestId,
      endpoint: '/api/ai/costs',
    });

    // Handle estimate action
    if (action === 'estimate') {
      const message = searchParams.get('message');
      const model = searchParams.get('model');
      const outputTokens = searchParams.get('outputTokens');
      const compare = searchParams.get('compare');

      const validation = estimateQuerySchema.safeParse({
        message,
        model,
        outputTokens: outputTokens ? parseInt(outputTokens, 10) : undefined,
        compare,
      });

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request parameters',
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const { message: msg, model: modelId, outputTokens: estOutput, compare: shouldCompare } =
        validation.data;

      // Import cost tracker dynamically (server-side compatible)
      const { getCostTracker } = await import('@/lib/ai/cost/cost-tracker');
      const tracker = getCostTracker();

      if (shouldCompare) {
        const comparison = tracker.compareModels(msg, undefined);

        const response: CostEstimateApiResponse = {
          success: true,
          data: comparison,
          timestamp: new Date().toISOString(),
        };

        logger.info('Cost comparison completed', {
          requestId,
          modelsCompared: comparison.estimates.length,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json(response);
      } else {
        const estimate = tracker.estimateCost(msg, modelId, estOutput);

        const response: CostEstimateApiResponse = {
          success: true,
          data: estimate,
          timestamp: new Date().toISOString(),
        };

        logger.info('Cost estimate completed', {
          requestId,
          model: modelId,
          estimatedCost: estimate.estimatedCost,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json(response);
      }
    }

    // Default: Return usage stats and history
    const period = (searchParams.get('period') as TimePeriod) || 'daily';

    // Import cost tracker
    const { getCostTracker } = await import('@/lib/ai/cost/cost-tracker');
    const tracker = getCostTracker();

    const response: CostApiResponse = {
      success: true,
      data: {
        currentSession: tracker.getCurrentSession(),
        history: tracker.getUsageHistory(),
        alerts: tracker.getAlerts(),
        settings: tracker.getSettings(),
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Cost stats retrieved', {
      requestId,
      sessionRequests: response.data.currentSession.requests,
      alertCount: response.data.alerts.length,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Cost API GET error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process cost request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();
    const action = body.action;

    logger.info('Cost API POST request', {
      action,
      requestId,
      endpoint: '/api/ai/costs',
    });

    // Import cost tracker
    const { getCostTracker } = await import('@/lib/ai/cost/cost-tracker');
    const tracker = getCostTracker();

    // Handle usage recording
    if (action === 'record_usage') {
      const validation = usageRecordSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid usage data',
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const { modelId, promptTokens, completionTokens, sessionId, userId, workspaceId } =
        validation.data;

      const usage = tracker.recordUsage(modelId, promptTokens, completionTokens, {
        sessionId,
        userId,
        workspaceId,
      });

      logger.info('Usage recorded', {
        requestId,
        modelId,
        totalCost: usage.totalCost,
        tokens: promptTokens + completionTokens,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json({
        success: true,
        data: usage,
        timestamp: new Date().toISOString(),
      });
    }

    // Handle alert management
    if (['create', 'update', 'delete', 'acknowledge'].includes(action)) {
      const validation = alertManagementSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid alert configuration',
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const { action: alertAction, alertId, config } = validation.data;

      let result: CostAlertApiResponse;

      switch (alertAction) {
        case 'create':
          if (!config) {
            return NextResponse.json(
              { success: false, error: 'Config required for create action' },
              { status: 400 }
            );
          }
          const newAlert = tracker.createAlert(config);
          result = {
            success: true,
            alert: newAlert,
            message: 'Alert created successfully',
            timestamp: new Date().toISOString(),
          };
          break;

        case 'update':
          if (!alertId || !config) {
            return NextResponse.json(
              { success: false, error: 'Alert ID and config required for update' },
              { status: 400 }
            );
          }
          const updatedAlert = tracker.updateAlert(alertId, config);
          if (!updatedAlert) {
            return NextResponse.json(
              { success: false, error: 'Alert not found' },
              { status: 404 }
            );
          }
          result = {
            success: true,
            alert: updatedAlert,
            message: 'Alert updated successfully',
            timestamp: new Date().toISOString(),
          };
          break;

        case 'delete':
          if (!alertId) {
            return NextResponse.json(
              { success: false, error: 'Alert ID required for delete' },
              { status: 400 }
            );
          }
          const deleted = tracker.deleteAlert(alertId);
          if (!deleted) {
            return NextResponse.json(
              { success: false, error: 'Alert not found' },
              { status: 404 }
            );
          }
          result = {
            success: true,
            message: 'Alert deleted successfully',
            timestamp: new Date().toISOString(),
          };
          break;

        case 'acknowledge':
          if (!alertId) {
            return NextResponse.json(
              { success: false, error: 'Alert ID required for acknowledge' },
              { status: 400 }
            );
          }
          const acknowledged = tracker.acknowledgeAlert(alertId);
          if (!acknowledged) {
            return NextResponse.json(
              { success: false, error: 'Alert not found' },
              { status: 404 }
            );
          }
          result = {
            success: true,
            message: 'Alert acknowledged successfully',
            timestamp: new Date().toISOString(),
          };
          break;

        default:
          return NextResponse.json(
            { success: false, error: 'Invalid action' },
            { status: 400 }
          );
      }

      logger.info('Alert action completed', {
        requestId,
        action: alertAction,
        alertId,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json(result);
    }

    // Handle settings update
    if (action === 'update_settings') {
      const validation = settingsUpdateSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid settings',
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const { settings } = validation.data;
      const updatedSettings = tracker.updateSettings(settings);

      logger.info('Settings updated', {
        requestId,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json({
        success: true,
        data: updatedSettings,
        message: 'Settings updated successfully',
        timestamp: new Date().toISOString(),
      });
    }

    // Unknown action
    return NextResponse.json(
      {
        success: false,
        error: 'Unknown action',
        validActions: [
          'record_usage',
          'create',
          'update',
          'delete',
          'acknowledge',
          'update_settings',
        ],
      },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Cost API POST error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process cost request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
