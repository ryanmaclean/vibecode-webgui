/**
 * AI Cost Tracking Module
 *
 * Exports all cost tracking functionality for VibeCode AI.
 *
 * @module lib/ai/cost
 */

export {
  CostTracker,
  getCostTracker,
  estimateCost,
  recordUsage,
  MODEL_PRICING,
} from './cost-tracker';

export type {
  CostTrackerOptions,
} from './cost-tracker';

// Re-export types from the types module for convenience
export type {
  ModelPricing,
  ExtendedModelPricing,
  ModelCapability,
  ModelTier,
  RequestUsage,
  UsageStats,
  AggregatedUsageStats,
  ModelUsageBreakdown,
  ProviderUsageBreakdown,
  EstimateConfidence,
  CostEstimate,
  CostBreakdown,
  CostComparison,
  ModelCostEstimate,
  TimePeriod,
  UsageDataPoint,
  UsageHistory,
  SessionUsage,
  AllTimeUsage,
  AlertSeverity,
  AlertType,
  CostAlert,
  NotificationChannel,
  CostAlertConfig,
  CostDisplayMode,
  CostSettings,
  BudgetAlertThresholds,
  CostApiResponse,
  CostEstimateApiResponse,
  CostAlertRequest,
  CostAlertApiResponse,
  CostEvent,
  CostEventCallback,
  TokenEstimator,
  CostCalculator,
  ExportFormat,
  ExportOptions,
} from '@/types/cost-estimation';

export { DEFAULT_COST_SETTINGS } from '@/types/cost-estimation';
