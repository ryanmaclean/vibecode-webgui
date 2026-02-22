/**
 * AI Quality Metrics Types for VibeCode
 *
 * Comprehensive type definitions for tracking and analyzing AI model response
 * quality across experiments, comparisons, and production usage.
 */

// ============================================================================
// Core Quality Metric Types
// ============================================================================

/**
 * Individual quality metric dimensions (0-1 scale)
 */
export interface QualityMetrics {
  /** How well the response addresses the question */
  relevance: number;
  /** Whether all aspects of the question are covered */
  completeness: number;
  /** Factual correctness of the information */
  accuracy: number;
  /** Structure, clarity, and readability */
  coherence: number;
}

/**
 * Quality evaluation method
 */
export type EvaluationMethod =
  | 'user_rating'
  | 'llm_judge'
  | 'similarity'
  | 'heuristic'
  | 'hybrid';

/**
 * Complete quality evaluation record
 */
export interface QualityEvaluation {
  /** Unique evaluation ID */
  id: string;
  /** Model that generated the response */
  modelId: string;
  /** Question or prompt ID */
  questionId: string;
  /** Overall quality score (0-1) */
  score: number;
  /** Breakdown of quality dimensions */
  metrics: QualityMetrics;
  /** Evaluation method used */
  method: EvaluationMethod;
  /** Explanation of the evaluation */
  reasoning?: string;
  /** When evaluation was performed */
  evaluatedAt: string;
  /** Time taken to evaluate (ms) */
  evaluationDuration?: number;
  /** User ID if user-rated */
  userId?: string;
  /** Judge model ID if LLM-judged */
  judgeModelId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Quality Score Bands
// ============================================================================

/**
 * Quality score categories
 */
export type QualityBand = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Score band thresholds
 */
export interface QualityBandThresholds {
  /** Minimum score for excellent (default: 0.9) */
  excellent: number;
  /** Minimum score for good (default: 0.7) */
  good: number;
  /** Minimum score for fair (default: 0.5) */
  fair: number;
  /** Below fair is considered poor */
}

/**
 * Default quality band thresholds
 */
export const DEFAULT_QUALITY_THRESHOLDS: QualityBandThresholds = {
  excellent: 0.9,
  good: 0.7,
  fair: 0.5,
};

/**
 * Get quality band for a score
 *
 * @param score - Quality score (0-1)
 * @param thresholds - Custom thresholds (optional)
 * @returns Quality band classification
 */
export function getQualityBand(
  score: number,
  thresholds: QualityBandThresholds = DEFAULT_QUALITY_THRESHOLDS
): QualityBand {
  if (score >= thresholds.excellent) return 'excellent';
  if (score >= thresholds.good) return 'good';
  if (score >= thresholds.fair) return 'fair';
  return 'poor';
}

// ============================================================================
// Aggregated Statistics
// ============================================================================

/**
 * Score distribution across quality bands
 */
export interface ScoreDistribution {
  /** Count in excellent band (0.9-1.0) */
  excellent: number;
  /** Count in good band (0.7-0.9) */
  good: number;
  /** Count in fair band (0.5-0.7) */
  fair: number;
  /** Count in poor band (0-0.5) */
  poor: number;
}

/**
 * Aggregated quality statistics
 */
export interface QualityStatistics {
  /** Total number of evaluations */
  totalEvaluations: number;
  /** Average overall score */
  averageScore: number;
  /** Average scores by dimension */
  averageMetrics: QualityMetrics;
  /** Distribution across quality bands */
  distribution: ScoreDistribution;
  /** Breakdown by evaluation method */
  methodBreakdown: Partial<Record<EvaluationMethod, number>>;
  /** Minimum score observed */
  minScore: number;
  /** Maximum score observed */
  maxScore: number;
  /** Standard deviation of scores */
  standardDeviation: number;
  /** Median score */
  medianScore: number;
  /** Time period for these statistics */
  timePeriod?: {
    start: string;
    end: string;
  };
}

// ============================================================================
// Time Series Tracking
// ============================================================================

/**
 * Single data point in quality time series
 */
export interface QualityDataPoint {
  /** Timestamp of measurement */
  timestamp: string;
  /** Average score at this point */
  score: number;
  /** Number of samples in this measurement */
  sampleSize: number;
  /** Average metrics at this point */
  metrics?: QualityMetrics;
}

/**
 * Trend direction
 */
export type TrendDirection = 'improving' | 'declining' | 'stable';

/**
 * Quality metrics over time
 */
export interface QualityTimeSeries {
  /** Model being tracked */
  modelId: string;
  /** Time series data points */
  dataPoints: QualityDataPoint[];
  /** Overall trend direction */
  trend: TrendDirection;
  /** Confidence in trend analysis (0-1) */
  trendConfidence: number;
  /** Percentage change from first to last point */
  percentageChange: number;
  /** Time granularity (e.g., 'hourly', 'daily', 'weekly') */
  granularity: string;
}

// ============================================================================
// Model Comparison
// ============================================================================

/**
 * Quality comparison between two models
 */
export interface QualityComparison {
  /** Baseline model ID */
  baselineModelId: string;
  /** Comparison model ID */
  comparisonModelId: string;
  /** Baseline average score */
  baselineScore: number;
  /** Comparison average score */
  comparisonScore: number;
  /** Percentage improvement (positive) or decline (negative) */
  improvement: number;
  /** Statistical significance level (0-1) */
  significanceLevel: number;
  /** Number of samples compared */
  sampleSize: number;
  /** Metric-by-metric comparison */
  metricComparison: {
    relevance: number;
    completeness: number;
    accuracy: number;
    coherence: number;
  };
  /** Whether improvement is statistically significant */
  isSignificant: boolean;
}

/**
 * Multi-model quality ranking
 */
export interface QualityRanking {
  /** Models ranked by quality */
  rankings: Array<{
    /** Model ID */
    modelId: string;
    /** Average quality score */
    score: number;
    /** Rank position (1-based) */
    rank: number;
    /** Quality band */
    band: QualityBand;
    /** Sample size */
    sampleSize: number;
  }>;
  /** Time period for ranking */
  timePeriod?: {
    start: string;
    end: string;
  };
  /** Ranking criteria */
  criteria: string;
  /** When ranking was generated */
  generatedAt: string;
}

// ============================================================================
// Quality Tracking Configuration
// ============================================================================

/**
 * Configuration for quality tracking
 */
export interface QualityTrackingConfig {
  /** Whether to enable quality tracking */
  enabled: boolean;
  /** Default evaluation method */
  defaultMethod: EvaluationMethod;
  /** Whether to use LLM-as-judge (costs money) */
  useLLMJudge: boolean;
  /** Judge model ID for LLM-as-judge */
  judgeModelId?: string;
  /** Sampling rate (0-1, 1 = track all) */
  samplingRate: number;
  /** Custom quality band thresholds */
  thresholds?: QualityBandThresholds;
  /** Minimum sample size for statistics */
  minSampleSize: number;
  /** Time window for trends (in days) */
  trendWindowDays: number;
}

/**
 * Default quality tracking configuration
 */
export const DEFAULT_QUALITY_TRACKING_CONFIG: QualityTrackingConfig = {
  enabled: true,
  defaultMethod: 'heuristic',
  useLLMJudge: false,
  samplingRate: 1.0,
  minSampleSize: 10,
  trendWindowDays: 7,
};

// ============================================================================
// User Feedback
// ============================================================================

/**
 * User rating (1-5 stars)
 */
export type UserRating = 1 | 2 | 3 | 4 | 5;

/**
 * User feedback on response quality
 */
export interface UserFeedback {
  /** Unique feedback ID */
  id: string;
  /** Evaluation this feedback is for */
  evaluationId: string;
  /** User who provided feedback */
  userId: string;
  /** Star rating (1-5) */
  rating: UserRating;
  /** Optional text feedback */
  comment?: string;
  /** Specific issues flagged */
  issues?: Array<
    | 'irrelevant'
    | 'incomplete'
    | 'inaccurate'
    | 'unclear'
    | 'too_long'
    | 'too_short'
    | 'other'
  >;
  /** When feedback was provided */
  providedAt: string;
}

/**
 * Aggregated user feedback statistics
 */
export interface UserFeedbackStatistics {
  /** Total feedback count */
  totalFeedback: number;
  /** Average rating */
  averageRating: number;
  /** Rating distribution */
  ratingDistribution: Record<UserRating, number>;
  /** Most common issues */
  topIssues: Array<{
    issue: string;
    count: number;
    percentage: number;
  }>;
  /** Correlation between rating and quality score */
  ratingScoreCorrelation: number;
}

// ============================================================================
// Quality Alerts and Monitoring
// ============================================================================

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Quality alert condition types
 */
export type AlertCondition =
  | 'score_below_threshold'
  | 'sudden_drop'
  | 'high_variance'
  | 'low_sample_size';

/**
 * Quality monitoring alert
 */
export interface QualityAlert {
  /** Alert ID */
  id: string;
  /** Alert severity */
  severity: AlertSeverity;
  /** Condition that triggered alert */
  condition: AlertCondition;
  /** Model this alert is for */
  modelId: string;
  /** Alert message */
  message: string;
  /** Current score or value */
  currentValue: number;
  /** Expected or threshold value */
  thresholdValue: number;
  /** When alert was triggered */
  triggeredAt: string;
  /** Whether alert is acknowledged */
  acknowledged: boolean;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Alert rule configuration
 */
export interface QualityAlertRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Alert condition */
  condition: AlertCondition;
  /** Threshold value */
  threshold: number;
  /** Severity level */
  severity: AlertSeverity;
  /** Models to monitor (empty = all) */
  modelIds: string[];
  /** Notification channels */
  notificationChannels?: string[];
}

// ============================================================================
// Export and Reporting
// ============================================================================

/**
 * Quality report format
 */
export type ReportFormat = 'json' | 'csv' | 'html' | 'pdf';

/**
 * Quality report options
 */
export interface QualityReportOptions {
  /** Report format */
  format: ReportFormat;
  /** Time period for report */
  timePeriod: {
    start: string;
    end: string;
  };
  /** Models to include (empty = all) */
  modelIds?: string[];
  /** Include individual evaluations */
  includeDetails: boolean;
  /** Include charts and visualizations */
  includeCharts: boolean;
  /** Group by (e.g., 'model', 'day', 'method') */
  groupBy?: string;
}

/**
 * Generated quality report
 */
export interface QualityReport {
  /** Report ID */
  id: string;
  /** Report title */
  title: string;
  /** When report was generated */
  generatedAt: string;
  /** Time period covered */
  timePeriod: {
    start: string;
    end: string;
  };
  /** Overall statistics */
  overallStatistics: QualityStatistics;
  /** Per-model statistics */
  modelStatistics: Record<string, QualityStatistics>;
  /** Rankings */
  rankings: QualityRanking;
  /** Time series data */
  timeSeries?: Record<string, QualityTimeSeries>;
  /** Active alerts */
  alerts?: QualityAlert[];
  /** Report format */
  format: ReportFormat;
  /** Download URL if applicable */
  downloadUrl?: string;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Quality dashboard state
 */
export interface QualityDashboardState {
  /** Selected model IDs for viewing */
  selectedModels: string[];
  /** Selected time range */
  timeRange: {
    start: string;
    end: string;
    preset?: 'today' | '7days' | '30days' | '90days' | 'custom';
  };
  /** Active filters */
  filters: {
    minScore?: number;
    maxScore?: number;
    methods?: EvaluationMethod[];
    bands?: QualityBand[];
  };
  /** Statistics for current view */
  statistics?: QualityStatistics;
  /** Time series for current view */
  timeSeries?: QualityTimeSeries[];
  /** Active alerts */
  alerts?: QualityAlert[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error?: string;
}

/**
 * Quality comparison view state
 */
export interface QualityComparisonViewState {
  /** Models being compared */
  comparisonModelIds: [string, string];
  /** Comparison result */
  comparison?: QualityComparison;
  /** Time range for comparison */
  timeRange: {
    start: string;
    end: string;
  };
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Quality evaluation completed event
 */
export interface QualityEvaluationEvent {
  /** Event type */
  type: 'evaluation_completed';
  /** Evaluation result */
  evaluation: QualityEvaluation;
  /** Timestamp */
  timestamp: string;
}

/**
 * Quality alert triggered event
 */
export interface QualityAlertEvent {
  /** Event type */
  type: 'alert_triggered';
  /** Alert details */
  alert: QualityAlert;
  /** Timestamp */
  timestamp: string;
}

/**
 * Quality metrics event union
 */
export type QualityMetricEvent = QualityEvaluationEvent | QualityAlertEvent;
