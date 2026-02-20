/**
 * Quality Report Generator
 *
 * Generates comprehensive quality reports comparing AI models based on:
 * - Acceptance/rejection rates
 * - Edit distance metrics
 * - User ratings
 * - Quality scores
 * - Time series trends
 *
 * @example
 * ```typescript
 * const generator = new QualityReportGenerator(prisma);
 *
 * // Generate weekly report
 * const report = await generator.generateReport({
 *   timePeriod: {
 *     start: '2024-01-01',
 *     end: '2024-01-07'
 *   },
 *   modelIds: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4'],
 *   includeDetails: true
 * });
 * ```
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';
import type {
  QualityReport,
  QualityReportOptions,
  QualityStatistics,
  QualityRanking,
  QualityTimeSeries,
  QualityComparison,
  QualityDataPoint,
  QualityMetrics,
  ScoreDistribution,
  QualityBand,
  TrendDirection,
  EvaluationMethod,
} from '@/types/ai-quality-metrics';
import { getQualityBand, DEFAULT_QUALITY_THRESHOLDS } from '@/types/ai-quality-metrics';

// =============================================================================
// Database Query Result Types
// =============================================================================

interface ModelMetricsResult {
  modelId: string;
  totalSuggestions: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  avgEditDistance: number | null;
  avgSimilarity: number | null;
  avgTimeToAccept: number | null;
  avgRating: number | null;
  ratingCount: number;
}

interface QualityMetricRecord {
  modelId: string;
  score: number;
  relevance: number;
  completeness: number;
  accuracy: number;
  coherence: number;
  method: string;
  timestamp: Date;
}

interface TimeSeriesBucket {
  modelId: string;
  timeBucket: Date;
  avgScore: number;
  sampleCount: number;
}

interface WeeklyAggregation {
  modelId: string;
  weekStart: string;
  weekEnd: string;
  sampleCount: number;
  averageScore: number;
  medianScore: number;
  minScore: number;
  maxScore: number;
  standardDeviation: number;
  distribution: ScoreDistribution;
  averageMetrics: QualityMetrics;
}

interface WeekOverWeekTrend {
  modelId: string;
  currentWeek: {
    start: string;
    end: string;
    averageScore: number;
    sampleCount: number;
  };
  previousWeek: {
    start: string;
    end: string;
    averageScore: number;
    sampleCount: number;
  };
  scoreChange: number;
  percentageChange: number;
  direction: TrendDirection;
  sampleSizeChange: number;
}

// =============================================================================
// Quality Report Generator
// =============================================================================

export class QualityReportGenerator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a comprehensive quality report
   */
  async generateReport(options: Partial<QualityReportOptions>): Promise<QualityReport> {
    const opts = this.normalizeOptions(options);
    logger.info('[QualityReportGenerator] Generating report', { options: opts });

    const startTime = Date.now();

    // Gather all data in parallel
    const [modelMetrics, qualityMetrics, timeSeries] = await Promise.all([
      this.getModelMetrics(opts.timePeriod, opts.modelIds),
      this.getQualityMetrics(opts.timePeriod, opts.modelIds),
      this.getTimeSeries(opts.timePeriod, opts.modelIds),
    ]);

    // Calculate statistics per model
    const modelStatistics: Record<string, QualityStatistics> = {};
    const modelIds = new Set<string>();

    // Collect all unique model IDs
    modelMetrics.forEach(m => modelIds.add(m.modelId));
    qualityMetrics.forEach(m => modelIds.add(m.modelId));

    // Calculate statistics for each model
    for (const modelId of modelIds) {
      const metrics = qualityMetrics.filter(m => m.modelId === modelId);
      const metadata = modelMetrics.find(m => m.modelId === modelId);

      modelStatistics[modelId] = this.calculateStatistics(metrics, metadata);
    }

    // Calculate overall statistics (across all models)
    const overallStatistics = this.calculateStatistics(qualityMetrics);

    // Generate rankings
    const rankings = this.generateRankings(modelStatistics, opts.timePeriod);

    // Generate time series
    const timeSeriesData: Record<string, QualityTimeSeries> = {};
    for (const modelId of modelIds) {
      const modelTimeSeries = timeSeries.filter(t => t.modelId === modelId);
      if (modelTimeSeries.length > 0) {
        timeSeriesData[modelId] = this.generateTimeSeries(modelId, modelTimeSeries);
      }
    }

    const report: QualityReport = {
      id: this.generateReportId(),
      title: this.generateReportTitle(opts.timePeriod),
      generatedAt: new Date().toISOString(),
      timePeriod: opts.timePeriod,
      overallStatistics,
      modelStatistics,
      rankings,
      timeSeries: opts.includeCharts ? timeSeriesData : undefined,
      format: opts.format,
    };

    const duration = Date.now() - startTime;
    logger.info('[QualityReportGenerator] Report generated', {
      reportId: report.id,
      modelCount: modelIds.size,
      duration,
    });

    return report;
  }

  /**
   * Generate a comparison between two models
   */
  async generateComparison(
    baselineModelId: string,
    comparisonModelId: string,
    timePeriod: { start: string; end: string }
  ): Promise<QualityComparison> {
    logger.info('[QualityReportGenerator] Generating comparison', {
      baselineModelId,
      comparisonModelId,
      timePeriod,
    });

    const [baselineMetrics, comparisonMetrics] = await Promise.all([
      this.getQualityMetrics(timePeriod, [baselineModelId]),
      this.getQualityMetrics(timePeriod, [comparisonModelId]),
    ]);

    const baselineStats = this.calculateStatistics(baselineMetrics);
    const comparisonStats = this.calculateStatistics(comparisonMetrics);

    const baselineScore = baselineStats.averageScore;
    const comparisonScore = comparisonStats.averageScore;
    const improvement = ((comparisonScore - baselineScore) / baselineScore) * 100;

    // Calculate metric-by-metric comparison
    const metricComparison = {
      relevance: comparisonStats.averageMetrics.relevance - baselineStats.averageMetrics.relevance,
      completeness:
        comparisonStats.averageMetrics.completeness - baselineStats.averageMetrics.completeness,
      accuracy: comparisonStats.averageMetrics.accuracy - baselineStats.averageMetrics.accuracy,
      coherence: comparisonStats.averageMetrics.coherence - baselineStats.averageMetrics.coherence,
    };

    // Calculate statistical significance (simplified t-test approximation)
    const sampleSize = Math.min(baselineStats.totalEvaluations, comparisonStats.totalEvaluations);
    const pooledStdDev = Math.sqrt(
      (baselineStats.standardDeviation ** 2 + comparisonStats.standardDeviation ** 2) / 2
    );
    const standardError = pooledStdDev / Math.sqrt(sampleSize);
    const tStatistic = Math.abs(comparisonScore - baselineScore) / standardError;
    const significanceLevel = this.tStatisticToPValue(tStatistic);
    const isSignificant = significanceLevel < 0.05 && sampleSize >= 30;

    return {
      baselineModelId,
      comparisonModelId,
      baselineScore,
      comparisonScore,
      improvement,
      significanceLevel,
      sampleSize,
      metricComparison,
      isSignificant,
    };
  }

  /**
   * Get weekly aggregated report
   */
  async getWeeklyReport(modelIds?: string[]): Promise<QualityReport> {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return this.generateReport({
      format: 'json',
      timePeriod: {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      },
      modelIds,
      includeDetails: false,
      includeCharts: true,
    });
  }

  /**
   * Get weekly aggregated statistics for models
   */
  async getWeeklyAggregation(
    timePeriod: { start: string; end: string },
    modelIds?: string[]
  ): Promise<WeeklyAggregation[]> {
    logger.info('[QualityReportGenerator] Generating weekly aggregation', {
      timePeriod,
      modelIds,
    });

    const metrics = await this.getQualityMetrics(timePeriod, modelIds);

    if (metrics.length === 0) {
      return [];
    }

    // Group by week and model
    const weeklyBuckets = new Map<string, QualityMetricRecord[]>();

    for (const metric of metrics) {
      const weekStart = this.getWeekStart(metric.timestamp);
      const bucketKey = `${metric.modelId}_${weekStart.toISOString()}`;

      if (!weeklyBuckets.has(bucketKey)) {
        weeklyBuckets.set(bucketKey, []);
      }

      weeklyBuckets.get(bucketKey)!.push(metric);
    }

    // Calculate statistics for each week
    const aggregations: WeeklyAggregation[] = [];

    for (const [bucketKey, weekMetrics] of weeklyBuckets.entries()) {
      const [modelId, weekStartStr] = bucketKey.split(/_(.+)/);
      const weekStart = new Date(weekStartStr ?? '');
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const scores = weekMetrics.map(m => m.score);
      const sorted = scores.slice().sort((a, b) => a - b);

      // Calculate distribution
      const distribution: ScoreDistribution = {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
      };

      for (const score of scores) {
        const band = getQualityBand(score);
        distribution[band]++;
      }

      aggregations.push({
        modelId: modelId ?? '',
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        sampleCount: weekMetrics.length,
        averageScore: this.average(scores),
        medianScore: this.median(scores),
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores),
        standardDeviation: this.standardDeviation(scores),
        distribution,
        averageMetrics: {
          relevance: this.average(weekMetrics.map(m => m.relevance)),
          completeness: this.average(weekMetrics.map(m => m.completeness)),
          accuracy: this.average(weekMetrics.map(m => m.accuracy)),
          coherence: this.average(weekMetrics.map(m => m.coherence)),
        },
      });
    }

    // Sort by model and week
    return aggregations.sort((a, b) => {
      const modelCompare = a.modelId.localeCompare(b.modelId);
      if (modelCompare !== 0) return modelCompare;
      return a.weekStart.localeCompare(b.weekStart);
    });
  }

  /**
   * Analyze week-over-week trends for models
   */
  async analyzeWeekOverWeekTrends(
    timePeriod: { start: string; end: string },
    modelIds?: string[]
  ): Promise<WeekOverWeekTrend[]> {
    logger.info('[QualityReportGenerator] Analyzing week-over-week trends', {
      timePeriod,
      modelIds,
    });

    const weeklyAggs = await this.getWeeklyAggregation(timePeriod, modelIds);

    if (weeklyAggs.length < 2) {
      return [];
    }

    // Group by model
    const byModel = weeklyAggs.reduce<Record<string, WeeklyAggregation[]>>((acc, agg) => {
      if (!acc[agg.modelId]) acc[agg.modelId] = [];
      acc[agg.modelId].push(agg);
      return acc;
    }, {});

    const trends: WeekOverWeekTrend[] = [];

    for (const [modelId, weeks] of Object.entries(byModel)) {
      if (weeks.length < 2) continue;

      // Sort by week
      weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

      // Calculate week-over-week changes
      for (let i = 1; i < weeks.length; i++) {
        const currentWeek = weeks[i];
        const previousWeek = weeks[i - 1];

        const scoreChange = currentWeek.averageScore - previousWeek.averageScore;
        const percentageChange =
          previousWeek.averageScore === 0
            ? 0
            : (scoreChange / previousWeek.averageScore) * 100;

        // Determine trend direction
        const threshold = 0.02; // 2% change threshold
        let direction: TrendDirection;
        if (Math.abs(percentageChange) < threshold * 100) {
          direction = 'stable';
        } else if (scoreChange > 0) {
          direction = 'improving';
        } else {
          direction = 'declining';
        }

        trends.push({
          modelId,
          currentWeek: {
            start: currentWeek.weekStart,
            end: currentWeek.weekEnd,
            averageScore: currentWeek.averageScore,
            sampleCount: currentWeek.sampleCount,
          },
          previousWeek: {
            start: previousWeek.weekStart,
            end: previousWeek.weekEnd,
            averageScore: previousWeek.averageScore,
            sampleCount: previousWeek.sampleCount,
          },
          scoreChange,
          percentageChange,
          direction,
          sampleSizeChange: currentWeek.sampleCount - previousWeek.sampleCount,
        });
      }
    }

    return trends;
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Query model metrics from database
   */
  private async getModelMetrics(
    timePeriod: { start: string; end: string },
    modelIds?: string[]
  ): Promise<ModelMetricsResult[]> {
    // Build where clause
    const where: any = {
      timestamp: {
        gte: new Date(timePeriod.start),
        lte: new Date(timePeriod.end),
      },
    };

    if (modelIds && modelIds.length > 0) {
      where.modelId = { in: modelIds };
    }

    // Query suggestions
    const suggestions = await this.prisma.aISuggestion.findMany({
      where,
      include: {
        events: true,
        ratings: true,
      },
    });

    // Aggregate by model
    const modelMap = new Map<string, ModelMetricsResult>();

    for (const suggestion of suggestions) {
      const modelId = suggestion.modelId;

      if (!modelMap.has(modelId)) {
        modelMap.set(modelId, {
          modelId,
          totalSuggestions: 0,
          acceptedSuggestions: 0,
          rejectedSuggestions: 0,
          avgEditDistance: null,
          avgSimilarity: null,
          avgTimeToAccept: null,
          avgRating: null,
          ratingCount: 0,
        });
      }

      const metrics = modelMap.get(modelId)!;
      metrics.totalSuggestions++;

      // Count events
      const acceptedEvents = suggestion.events.filter(e => e.eventType === 'accepted');
      const rejectedEvents = suggestion.events.filter(e => e.eventType === 'rejected');

      if (acceptedEvents.length > 0) {
        metrics.acceptedSuggestions++;

        // Aggregate edit distance and similarity
        const editDistances: number[] = [];
        const similarities: number[] = [];
        const timesToAccept: number[] = [];

        for (const event of acceptedEvents) {
          if (event.editDistance !== null) editDistances.push(event.editDistance);
          if (event.similarity !== null) similarities.push(event.similarity);
          if (event.timeToEvent !== null) timesToAccept.push(event.timeToEvent);
        }

        if (editDistances.length > 0) {
          metrics.avgEditDistance = this.average(editDistances);
        }
        if (similarities.length > 0) {
          metrics.avgSimilarity = this.average(similarities);
        }
        if (timesToAccept.length > 0) {
          metrics.avgTimeToAccept = this.average(timesToAccept);
        }
      }

      if (rejectedEvents.length > 0) {
        metrics.rejectedSuggestions++;
      }

      // Aggregate ratings
      if (suggestion.ratings.length > 0) {
        const ratings = suggestion.ratings.map(r => r.rating);
        metrics.avgRating = this.average(ratings);
        metrics.ratingCount += ratings.length;
      }
    }

    return Array.from(modelMap.values());
  }

  /**
   * Query quality metrics from database
   */
  private async getQualityMetrics(
    timePeriod: { start: string; end: string },
    modelIds?: string[]
  ): Promise<QualityMetricRecord[]> {
    const where: any = {
      timestamp: {
        gte: new Date(timePeriod.start),
        lte: new Date(timePeriod.end),
      },
    };

    if (modelIds && modelIds.length > 0) {
      where.modelId = { in: modelIds };
    }

    const metrics = await this.prisma.aIQualityMetric.findMany({
      where,
      select: {
        modelId: true,
        score: true,
        relevance: true,
        completeness: true,
        accuracy: true,
        coherence: true,
        method: true,
        timestamp: true,
      },
    });

    return metrics as QualityMetricRecord[];
  }

  /**
   * Query time series data
   */
  private async getTimeSeries(
    timePeriod: { start: string; end: string },
    modelIds?: string[],
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<TimeSeriesBucket[]> {
    const where: any = {
      timestamp: {
        gte: new Date(timePeriod.start),
        lte: new Date(timePeriod.end),
      },
    };

    if (modelIds && modelIds.length > 0) {
      where.modelId = { in: modelIds };
    }

    const metrics = await this.prisma.aIQualityMetric.findMany({
      where,
      select: {
        modelId: true,
        score: true,
        timestamp: true,
      },
    });

    // Bucket by granularity
    const bucketMap = new Map<string, TimeSeriesBucket>();

    for (const metric of metrics) {
      const timestamp = new Date(metric.timestamp);
      let bucketTime: Date;

      if (granularity === 'hour') {
        timestamp.setMinutes(0, 0, 0);
        bucketTime = timestamp;
      } else if (granularity === 'week') {
        bucketTime = this.getWeekStart(timestamp);
      } else {
        // day
        timestamp.setHours(0, 0, 0, 0);
        bucketTime = timestamp;
      }

      const bucketKey = `${metric.modelId}_${bucketTime.toISOString()}`;

      if (!bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, {
          modelId: metric.modelId,
          timeBucket: bucketTime,
          avgScore: 0,
          sampleCount: 0,
        });
      }

      const bucket = bucketMap.get(bucketKey)!;
      bucket.avgScore = (bucket.avgScore * bucket.sampleCount + metric.score) / (bucket.sampleCount + 1);
      bucket.sampleCount++;
    }

    return Array.from(bucketMap.values());
  }

  /**
   * Calculate statistics from quality metrics
   */
  private calculateStatistics(
    metrics: QualityMetricRecord[],
    metadata?: ModelMetricsResult
  ): QualityStatistics {
    if (metrics.length === 0) {
      return {
        totalEvaluations: 0,
        averageScore: 0,
        averageMetrics: {
          relevance: 0,
          completeness: 0,
          accuracy: 0,
          coherence: 0,
        },
        distribution: {
          excellent: 0,
          good: 0,
          fair: 0,
          poor: 0,
        },
        methodBreakdown: {},
        minScore: 0,
        maxScore: 0,
        standardDeviation: 0,
        medianScore: 0,
      };
    }

    const scores = metrics.map(m => m.score);
    const relevanceScores = metrics.map(m => m.relevance);
    const completenessScores = metrics.map(m => m.completeness);
    const accuracyScores = metrics.map(m => m.accuracy);
    const coherenceScores = metrics.map(m => m.coherence);

    // Calculate distribution
    const distribution: ScoreDistribution = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
    };

    for (const score of scores) {
      const band = getQualityBand(score);
      distribution[band]++;
    }

    // Calculate method breakdown
    const methodBreakdown: Partial<Record<EvaluationMethod, number>> = {};
    for (const metric of metrics) {
      const method = metric.method as EvaluationMethod;
      methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
    }

    return {
      totalEvaluations: metrics.length,
      averageScore: this.average(scores),
      averageMetrics: {
        relevance: this.average(relevanceScores),
        completeness: this.average(completenessScores),
        accuracy: this.average(accuracyScores),
        coherence: this.average(coherenceScores),
      },
      distribution,
      methodBreakdown,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      standardDeviation: this.standardDeviation(scores),
      medianScore: this.median(scores),
    };
  }

  /**
   * Generate model rankings
   */
  private generateRankings(
    modelStatistics: Record<string, QualityStatistics>,
    timePeriod: { start: string; end: string }
  ): QualityRanking {
    const rankings = Object.entries(modelStatistics)
      .map(([modelId, stats]) => ({
        modelId,
        score: stats.averageScore,
        rank: 0, // Will be set below
        band: getQualityBand(stats.averageScore),
        sampleSize: stats.totalEvaluations,
      }))
      .sort((a, b) => b.score - a.score);

    // Assign ranks
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    return {
      rankings,
      timePeriod,
      criteria: 'Average quality score',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate time series data
   */
  private generateTimeSeries(modelId: string, buckets: TimeSeriesBucket[]): QualityTimeSeries {
    // Sort by time
    const sorted = buckets.sort((a, b) => a.timeBucket.getTime() - b.timeBucket.getTime());

    const dataPoints: QualityDataPoint[] = sorted.map(bucket => ({
      timestamp: bucket.timeBucket.toISOString(),
      score: bucket.avgScore,
      sampleSize: bucket.sampleCount,
    }));

    // Calculate trend
    const { trend, confidence } = this.calculateTrend(dataPoints);

    // Calculate percentage change
    const percentageChange =
      dataPoints.length >= 2
        ? ((dataPoints[dataPoints.length - 1].score - dataPoints[0].score) / dataPoints[0].score) * 100
        : 0;

    return {
      modelId,
      dataPoints,
      trend,
      trendConfidence: confidence,
      percentageChange,
      granularity: 'daily',
    };
  }

  /**
   * Calculate trend direction from data points
   */
  private calculateTrend(dataPoints: QualityDataPoint[]): {
    trend: TrendDirection;
    confidence: number;
  } {
    if (dataPoints.length < 2) {
      return { trend: 'stable', confidence: 0 };
    }

    // Simple linear regression
    const n = dataPoints.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = dataPoints.map(d => d.score);

    const xMean = this.average(x);
    const yMean = this.average(y);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += (x[i] - xMean) ** 2;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;

    // Calculate R-squared for confidence
    const yPredicted = x.map(xi => yMean + slope * (xi - xMean));
    const ssResidual = y.reduce((sum, yi, i) => sum + (yi - yPredicted[i]) ** 2, 0);
    const ssTotal = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
    const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

    // Determine trend direction
    const threshold = 0.01; // 1% change threshold
    let trend: TrendDirection;
    if (Math.abs(slope) < threshold) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'improving';
    } else {
      trend = 'declining';
    }

    return {
      trend,
      confidence: Math.max(0, Math.min(1, rSquared)),
    };
  }

  /**
   * Convert t-statistic to approximate p-value
   */
  private tStatisticToPValue(t: number): number {
    // Simplified approximation for large samples
    // For more accuracy, use a proper t-distribution library
    const z = Math.abs(t);

    if (z > 6) return 0.000001;
    if (z > 5) return 0.00001;
    if (z > 4) return 0.0001;
    if (z > 3) return 0.001;
    if (z > 2.58) return 0.01;
    if (z > 1.96) return 0.05;
    if (z > 1.65) return 0.1;

    return 0.5;
  }

  /**
   * Normalize report options
   */
  private normalizeOptions(options: Partial<QualityReportOptions>): QualityReportOptions {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return {
      format: options.format || 'json',
      timePeriod: options.timePeriod || {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      },
      modelIds: options.modelIds,
      includeDetails: options.includeDetails ?? false,
      includeCharts: options.includeCharts ?? true,
      groupBy: options.groupBy,
    };
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate report title
   */
  private generateReportTitle(timePeriod: { start: string; end: string }): string {
    const start = new Date(timePeriod.start);
    const end = new Date(timePeriod.end);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    return `AI Quality Report: ${startStr} to ${endStr}`;
  }

  // =============================================================================
  // Statistical Utilities
  // =============================================================================

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private median(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private standardDeviation(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const avg = this.average(numbers);
    const squaredDiffs = numbers.map(n => (n - avg) ** 2);
    const variance = this.average(squaredDiffs);
    return Math.sqrt(variance);
  }

  /**
   * Get the start of the week (Monday) for a given date
   */
  private getWeekStart(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Adjust when day is Sunday
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalGenerator: QualityReportGenerator | null = null;

/**
 * Get the global quality report generator instance
 */
export function getQualityReportGenerator(prisma?: PrismaClient): QualityReportGenerator {
  if (!globalGenerator) {
    const client = prisma || new PrismaClient();
    globalGenerator = new QualityReportGenerator(client);
  }
  return globalGenerator;
}

/**
 * Create a new quality report generator instance
 */
export function createQualityReportGenerator(prisma: PrismaClient): QualityReportGenerator {
  return new QualityReportGenerator(prisma);
}

/**
 * Reset the global generator (mainly for testing)
 */
export function resetQualityReportGenerator(): void {
  globalGenerator = null;
}

// =============================================================================
// Type Exports
// =============================================================================

export type { WeeklyAggregation, WeekOverWeekTrend };
