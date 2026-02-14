/**
 * Cost Estimation Types for VibeCode AI
 *
 * Type definitions for AI cost tracking, estimation, and management.
 * Supports 340+ AI models through OpenRouter and direct providers.
 *
 * @module types/cost-estimation
 */

// ============================================================================
// Model Pricing Types
// ============================================================================

/**
 * Pricing information for an AI model
 */
export interface ModelPricing {
  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus') */
  modelId: string;
  /** Display name for the model */
  displayName: string;
  /** Provider name (e.g., 'openai', 'anthropic', 'openrouter') */
  provider: string;
  /** Cost per 1,000 input tokens (in USD) */
  inputCostPer1K: number;
  /** Cost per 1,000 output tokens (in USD) */
  outputCostPer1K: number;
  /** Maximum context window size in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Whether pricing is estimated (vs confirmed from provider) */
  isEstimated?: boolean;
  /** Last updated timestamp for pricing data */
  lastUpdated?: string;
  /** Currency code (default: USD) */
  currency?: string;
}

/**
 * Extended pricing with additional metadata
 */
export interface ExtendedModelPricing extends ModelPricing {
  /** Model family (e.g., 'gpt-4', 'claude-3') */
  family: string;
  /** Model capabilities */
  capabilities: ModelCapability[];
  /** Model tier (e.g., 'economy', 'standard', 'premium') */
  tier: ModelTier;
  /** Speed rating (1-5, higher is faster) */
  speedRating: number;
  /** Quality rating (1-5, higher is better) */
  qualityRating: number;
}

/**
 * Model capability flags
 */
export type ModelCapability =
  | 'chat'
  | 'completion'
  | 'code'
  | 'vision'
  | 'function_calling'
  | 'json_mode'
  | 'streaming'
  | 'embeddings';

/**
 * Model tier classification
 */
export type ModelTier = 'economy' | 'standard' | 'premium' | 'enterprise';

// ============================================================================
// Usage Statistics Types
// ============================================================================

/**
 * Token usage statistics for a single request
 */
export interface RequestUsage {
  /** Number of tokens in the prompt/input */
  promptTokens: number;
  /** Number of tokens in the completion/output */
  completionTokens: number;
  /** Total tokens (promptTokens + completionTokens) */
  totalTokens: number;
}

/**
 * Comprehensive usage statistics with cost calculation
 */
export interface UsageStats {
  /** Number of tokens in the prompt/input */
  promptTokens: number;
  /** Number of tokens in the completion/output */
  completionTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Number of API requests */
  requests: number;
  /** Model used for this usage */
  modelId: string;
  /** Provider name */
  provider: string;
  /** Timestamp of the usage */
  timestamp: string;
  /** Session ID if applicable */
  sessionId?: string;
  /** User ID if applicable */
  userId?: string;
  /** Workspace ID if applicable */
  workspaceId?: string;
}

/**
 * Aggregated usage statistics over a time period
 */
export interface AggregatedUsageStats {
  /** Total prompt tokens across all requests */
  totalPromptTokens: number;
  /** Total completion tokens across all requests */
  totalCompletionTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Total number of requests */
  totalRequests: number;
  /** Average cost per request */
  averageCostPerRequest: number;
  /** Average tokens per request */
  averageTokensPerRequest: number;
  /** Time period start */
  periodStart: string;
  /** Time period end */
  periodEnd: string;
  /** Breakdown by model */
  byModel: Record<string, ModelUsageBreakdown>;
  /** Breakdown by provider */
  byProvider: Record<string, ProviderUsageBreakdown>;
}

/**
 * Usage breakdown for a specific model
 */
export interface ModelUsageBreakdown {
  modelId: string;
  displayName: string;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  requests: number;
  percentage: number;
}

/**
 * Usage breakdown for a specific provider
 */
export interface ProviderUsageBreakdown {
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  requests: number;
  percentage: number;
}

// ============================================================================
// Cost Estimation Types
// ============================================================================

/**
 * Confidence level for cost estimates
 */
export type EstimateConfidence = 'high' | 'medium' | 'low';

/**
 * Cost estimate for a potential request
 */
export interface CostEstimate {
  /** Estimated total cost in USD */
  estimatedCost: number;
  /** Detailed cost breakdown */
  breakdown: CostBreakdown;
  /** Confidence level of the estimate */
  confidence: EstimateConfidence;
  /** Model used for estimation */
  modelId: string;
  /** Estimated input tokens */
  estimatedInputTokens: number;
  /** Estimated output tokens */
  estimatedOutputTokens: number;
  /** Minimum possible cost */
  minCost: number;
  /** Maximum possible cost */
  maxCost: number;
  /** Warnings or notes about the estimate */
  warnings?: string[];
}

/**
 * Detailed cost breakdown
 */
export interface CostBreakdown {
  /** Cost for input/prompt tokens */
  inputCost: number;
  /** Cost for output/completion tokens */
  outputCost: number;
  /** Any additional fees (e.g., image processing) */
  additionalFees: number;
  /** Total cost */
  total: number;
  /** Input tokens used in calculation */
  inputTokens: number;
  /** Output tokens used in calculation */
  outputTokens: number;
  /** Rate per 1K input tokens */
  inputRate: number;
  /** Rate per 1K output tokens */
  outputRate: number;
}

/**
 * Cost comparison across multiple models
 */
export interface CostComparison {
  /** The message or prompt being estimated */
  input: string;
  /** Estimated input tokens */
  estimatedInputTokens: number;
  /** Estimates for each model */
  estimates: ModelCostEstimate[];
  /** Most cost-effective model */
  cheapestModel: string;
  /** Best value model (considering quality/cost ratio) */
  bestValueModel: string;
  /** Timestamp of comparison */
  timestamp: string;
}

/**
 * Cost estimate for a specific model in a comparison
 */
export interface ModelCostEstimate {
  modelId: string;
  displayName: string;
  provider: string;
  estimatedCost: number;
  inputCost: number;
  outputCost: number;
  tier: ModelTier;
  savings: number; // Compared to most expensive option
  savingsPercentage: number;
}

// ============================================================================
// Usage History Types
// ============================================================================

/**
 * Time period for aggregation
 */
export type TimePeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Single data point in usage history
 */
export interface UsageDataPoint {
  /** Timestamp for this data point */
  timestamp: string;
  /** Total cost for this period */
  cost: number;
  /** Total tokens for this period */
  tokens: number;
  /** Number of requests */
  requests: number;
  /** Prompt tokens */
  promptTokens: number;
  /** Completion tokens */
  completionTokens: number;
}

/**
 * Usage history with multiple time aggregations
 */
export interface UsageHistory {
  /** Hourly data points (last 24 hours) */
  hourly: UsageDataPoint[];
  /** Daily data points (last 30 days) */
  daily: UsageDataPoint[];
  /** Weekly data points (last 12 weeks) */
  weekly: UsageDataPoint[];
  /** Monthly data points (last 12 months) */
  monthly: UsageDataPoint[];
  /** Current session usage */
  currentSession: SessionUsage;
  /** All-time totals */
  allTime: AllTimeUsage;
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Current session usage tracking
 */
export interface SessionUsage {
  /** Session start time */
  startTime: string;
  /** Total cost this session */
  totalCost: number;
  /** Total tokens this session */
  totalTokens: number;
  /** Number of requests */
  requests: number;
  /** Usage by model */
  byModel: Record<string, UsageStats>;
}

/**
 * All-time usage totals
 */
export interface AllTimeUsage {
  /** Total cost ever */
  totalCost: number;
  /** Total tokens ever */
  totalTokens: number;
  /** Total requests ever */
  totalRequests: number;
  /** First usage date */
  firstUsageDate: string;
  /** Most used model */
  mostUsedModel: string;
  /** Most expensive model */
  mostExpensiveModel: string;
}

// ============================================================================
// Cost Alert Types
// ============================================================================

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert type classification
 */
export type AlertType =
  | 'budget_threshold'
  | 'daily_limit'
  | 'session_limit'
  | 'rate_spike'
  | 'unusual_usage';

/**
 * Cost alert configuration and state
 */
export interface CostAlert {
  /** Unique alert ID */
  id: string;
  /** Alert type */
  type: AlertType;
  /** Alert severity */
  severity: AlertSeverity;
  /** Threshold value that triggers the alert (in USD) */
  threshold: number;
  /** Current value being tracked */
  current: number;
  /** Whether the alert has been triggered */
  triggered: boolean;
  /** When the alert was triggered (if applicable) */
  triggeredAt?: string;
  /** Alert message */
  message: string;
  /** Whether the alert is enabled */
  enabled: boolean;
  /** Whether to send notifications */
  notifyOnTrigger: boolean;
  /** Notification channels */
  notificationChannels: NotificationChannel[];
  /** Reset period for the alert */
  resetPeriod?: TimePeriod;
  /** Last reset timestamp */
  lastReset?: string;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

/**
 * Notification channel for alerts
 */
export type NotificationChannel = 'in_app' | 'email' | 'slack' | 'webhook';

/**
 * Alert configuration for creating/updating alerts
 */
export interface CostAlertConfig {
  type: AlertType;
  threshold: number;
  enabled: boolean;
  notifyOnTrigger: boolean;
  notificationChannels: NotificationChannel[];
  resetPeriod?: TimePeriod;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Cost display preferences
 */
export type CostDisplayMode = 'per_request' | 'session' | 'daily' | 'monthly';

/**
 * Cost-related settings
 */
export interface CostSettings {
  /** Monthly budget limit in USD (0 = unlimited) */
  monthlyBudget: number;
  /** Daily budget limit in USD (0 = unlimited) */
  dailyBudget: number;
  /** Session budget limit in USD (0 = unlimited) */
  sessionBudget: number;
  /** Preferred cost display mode */
  displayMode: CostDisplayMode;
  /** Show cost estimates before sending */
  showEstimatesBeforeSend: boolean;
  /** Show real-time cost tracking */
  showRealtimeCosts: boolean;
  /** Alert thresholds as percentage of budget */
  alertThresholds: BudgetAlertThresholds;
  /** Currency for display (default: USD) */
  displayCurrency: string;
  /** Enable cost optimization suggestions */
  enableOptimizationSuggestions: boolean;
  /** Preferred models for cost optimization */
  preferredEconomyModels: string[];
}

/**
 * Budget alert thresholds
 */
export interface BudgetAlertThresholds {
  /** Warning threshold (percentage of budget) */
  warning: number;
  /** Critical threshold (percentage of budget) */
  critical: number;
  /** Daily warning threshold */
  dailyWarning: number;
  /** Session warning threshold */
  sessionWarning: number;
}

/**
 * Default cost settings
 */
export const DEFAULT_COST_SETTINGS: CostSettings = {
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
};

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from GET /api/ai/costs
 */
export interface CostApiResponse {
  success: boolean;
  data: {
    currentSession: SessionUsage;
    history: UsageHistory;
    alerts: CostAlert[];
    settings: CostSettings;
  };
  timestamp: string;
}

/**
 * Response from GET /api/ai/costs/estimate
 */
export interface CostEstimateApiResponse {
  success: boolean;
  data: CostEstimate | CostComparison;
  timestamp: string;
}

/**
 * Request body for POST /api/ai/costs/alert
 */
export interface CostAlertRequest {
  action: 'create' | 'update' | 'delete' | 'acknowledge';
  alertId?: string;
  config?: CostAlertConfig;
}

/**
 * Response from POST /api/ai/costs/alert
 */
export interface CostAlertApiResponse {
  success: boolean;
  alert?: CostAlert;
  message: string;
  timestamp: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Cost tracking event
 */
export interface CostEvent {
  type: 'usage_recorded' | 'alert_triggered' | 'budget_exceeded' | 'settings_updated';
  payload: UsageStats | CostAlert | CostSettings;
  timestamp: string;
}

/**
 * Cost event callback
 */
export type CostEventCallback = (event: CostEvent) => void;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Token estimation function type
 */
export type TokenEstimator = (text: string) => number;

/**
 * Cost calculator function type
 */
export type CostCalculator = (
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing
) => number;

/**
 * Export data format
 */
export type ExportFormat = 'csv' | 'json' | 'xlsx';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  period: TimePeriod;
  startDate?: string;
  endDate?: string;
  includeBreakdown: boolean;
  includeModels: boolean;
  includeProviders: boolean;
}
