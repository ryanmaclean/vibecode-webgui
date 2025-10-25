/**
 * Automated Winner Selection
 *
 * Automatically detects statistical significance and declares experiment winners.
 * Integrates with statistical engine to determine if results are conclusive.
 */

import { PrismaClient } from '@prisma/client';
import { logger, appLogger } from '@/lib/server-monitoring';
import { zTest, tTest } from './statistics';
import { experimentWarehouse } from './warehouse';
import { transitionStatus } from './lifecycle';

const prisma = new PrismaClient();

/**
 * Result of winner detection analysis
 */
export interface WinnerResult {
  hasWinner: boolean;
  winningVariant?: string;
  confidence: number; // 0-1
  reason: string;
  metrics: WinnerMetric[];
  sampleSize: number;
  timestamp: Date;
}

/**
 * Metric comparison for winner analysis
 */
export interface WinnerMetric {
  metricName: string;
  controlValue: number;
  winnerValue: number;
  improvement: number; // Percentage improvement
  pValue: number;
  significant: boolean;
  confidenceInterval?: {
    lower: number;
    upper: number;
  };
}

/**
 * Configuration for winner detection
 */
export interface WinnerDetectionConfig {
  minSampleSize: number;
  minConfidence: number; // 0-1, typically 0.95
  minImprovement?: number; // Minimum practical improvement (e.g., 0.05 for 5%)
  primaryMetric?: string; // Primary metric to optimize
}

/**
 * Determine if an experiment has a clear winner
 *
 * Analyzes experiment data to detect statistical significance and practical improvement.
 * Uses frequentist statistical tests (z-test or t-test) based on sample size.
 *
 * @param experimentKey - Unique experiment identifier
 * @param minSampleSize - Minimum samples per variant (default: 1000)
 * @param minConfidence - Minimum confidence level (default: 0.95)
 * @param minImprovement - Minimum practical improvement required (default: 0.01 = 1%)
 * @returns Winner detection result
 *
 * @example
 * const result = await detectWinner('button-test', 1000, 0.95, 0.05);
 * if (result.hasWinner) {
 *   console.log(`Winner: ${result.winningVariant} with ${result.confidence}% confidence`);
 * }
 */
export async function detectWinner(
  experimentKey: string,
  minSampleSize: number = 1000,
  minConfidence: number = 0.95,
  minImprovement: number = 0.01
): Promise<WinnerResult> {
  try {
    logger.info('Detecting winner', {
      experimentKey,
      minSampleSize,
      minConfidence,
      minImprovement
    });

    // Get experiment data
    const results = await experimentWarehouse.getExperimentResults(experimentKey);

    if (!results.experiment) {
      throw new Error(`Experiment not found: ${experimentKey}`);
    }

    // Get experiment config
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey }
    });

    const config = experiment?.config as any;
    const primaryMetric = config?.primaryMetric || 'conversion_rate';

    // Check sample size
    const totalSamples = results.totalAssignments;
    const variantCount = Object.keys(results.variantDistribution).length;
    const avgSamplesPerVariant = totalSamples / variantCount;

    if (avgSamplesPerVariant < minSampleSize) {
      return {
        hasWinner: false,
        confidence: 0,
        reason: `Insufficient sample size. Have ${Math.floor(avgSamplesPerVariant)} per variant, need ${minSampleSize}`,
        metrics: [],
        sampleSize: totalSamples,
        timestamp: new Date()
      };
    }

    // Get metrics data by variant
    const assignments = await experimentWarehouse.getAssignments(experimentKey);
    const metricsData = await experimentWarehouse.getMetrics(experimentKey);

    // Identify control variant (typically first variant or one named 'control')
    const variants = Object.keys(results.variantDistribution);
    const controlVariant = variants.find(v => v === 'control') || variants[0];
    const treatmentVariants = variants.filter(v => v !== controlVariant);

    // Analyze each metric
    const metricAnalyses: WinnerMetric[] = [];
    const uniqueMetrics = [...new Set(metricsData.map((m: any) => m.metric_name))];

    for (const metricName of uniqueMetrics) {
      // Get metric values by variant
      const controlMetrics = metricsData
        .filter((m: any) => m.variant_key === controlVariant && m.metric_name === metricName)
        .map((m: any) => m.value);

      for (const treatmentVariant of treatmentVariants) {
        const treatmentMetrics = metricsData
          .filter((m: any) => m.variant_key === treatmentVariant && m.metric_name === metricName)
          .map((m: any) => m.value);

        if (controlMetrics.length === 0 || treatmentMetrics.length === 0) {
          continue;
        }

        // Determine if metrics are binary (conversion) or continuous
        const isBinary = controlMetrics.every(v => v === 0 || v === 1) &&
                        treatmentMetrics.every(v => v === 0 || v === 1);

        // Run appropriate statistical test
        const testResult = isBinary
          ? zTest(controlMetrics, treatmentMetrics, 1 - minConfidence)
          : tTest(controlMetrics, treatmentMetrics, 1 - minConfidence);

        const controlValue = controlMetrics.reduce((sum, v) => sum + v, 0) / controlMetrics.length;
        const treatmentValue = treatmentMetrics.reduce((sum, v) => sum + v, 0) / treatmentMetrics.length;

        const improvement = controlValue === 0
          ? (treatmentValue > 0 ? 1 : 0)
          : (treatmentValue - controlValue) / controlValue;

        metricAnalyses.push({
          metricName: `${treatmentVariant}_${metricName}`,
          controlValue,
          winnerValue: treatmentValue,
          improvement: improvement * 100, // Convert to percentage
          pValue: testResult.pValue,
          significant: testResult.significant
        });
      }
    }

    // Determine winner based on primary metric
    const primaryMetricAnalysis = metricAnalyses.find(m =>
      m.metricName.includes(primaryMetric)
    );

    if (!primaryMetricAnalysis) {
      return {
        hasWinner: false,
        confidence: 0,
        reason: `No data for primary metric: ${primaryMetric}`,
        metrics: metricAnalyses,
        sampleSize: totalSamples,
        timestamp: new Date()
      };
    }

    // Check if statistically significant AND practically significant
    const isSignificant = primaryMetricAnalysis.significant;
    const isPractical = Math.abs(primaryMetricAnalysis.improvement / 100) >= minImprovement;
    const isPositive = primaryMetricAnalysis.improvement > 0;

    if (isSignificant && isPractical && isPositive) {
      const winningVariant = primaryMetricAnalysis.metricName.split('_')[0];
      const confidence = 1 - primaryMetricAnalysis.pValue;

      return {
        hasWinner: true,
        winningVariant,
        confidence,
        reason: `${winningVariant} shows ${primaryMetricAnalysis.improvement.toFixed(2)}% improvement with ${(confidence * 100).toFixed(1)}% confidence`,
        metrics: metricAnalyses,
        sampleSize: totalSamples,
        timestamp: new Date()
      };
    }

    // No clear winner
    let reason = 'No statistically significant winner detected';
    if (isSignificant && !isPractical) {
      reason = 'Statistically significant but improvement below practical threshold';
    } else if (isSignificant && !isPositive) {
      reason = 'Statistically significant but treatment performs worse';
    }

    return {
      hasWinner: false,
      confidence: primaryMetricAnalysis.pValue < 0.5 ? 1 - primaryMetricAnalysis.pValue : 0,
      reason,
      metrics: metricAnalyses,
      sampleSize: totalSamples,
      timestamp: new Date()
    };

  } catch (error) {
    logger.error('Failed to detect winner', {
      experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Automatically select winner and update experiment
 *
 * Detects winner and transitions experiment to completed status if found.
 *
 * @param experimentKey - Unique experiment identifier
 * @param config - Winner detection configuration
 * @returns Winner detection result
 *
 * @example
 * const result = await selectWinner('button-test');
 * if (result.hasWinner) {
 *   // Experiment automatically completed
 *   console.log('Winner selected:', result.winningVariant);
 * }
 */
export async function selectWinner(
  experimentKey: string,
  config?: Partial<WinnerDetectionConfig>
): Promise<WinnerResult> {
  try {
    const defaultConfig: WinnerDetectionConfig = {
      minSampleSize: 1000,
      minConfidence: 0.95,
      minImprovement: 0.01,
      ...config
    };

    const result = await detectWinner(
      experimentKey,
      defaultConfig.minSampleSize,
      defaultConfig.minConfidence,
      defaultConfig.minImprovement
    );

    if (result.hasWinner) {
      // Store winner in experiment metadata
      const experiment = await prisma.experiment.findUnique({
        where: { key: experimentKey }
      });

      if (experiment) {
        const config = experiment.config as any;
        config.winner = {
          variant: result.winningVariant,
          confidence: result.confidence,
          selectedAt: new Date(),
          metrics: result.metrics
        };

        await prisma.experiment.update({
          where: { key: experimentKey },
          data: { config }
        });
      }

      // Transition to completed
      await transitionStatus(
        experimentKey,
        'completed',
        'system',
        undefined,
        `Winner selected: ${result.winningVariant} with ${(result.confidence * 100).toFixed(1)}% confidence`
      );

      appLogger.logBusiness('experiment_winner_selected', {
        feature: 'experimentation',
        metadata: {
          experimentKey,
          winningVariant: result.winningVariant,
          confidence: result.confidence,
          improvement: result.metrics[0]?.improvement
        }
      });

      logger.info('Winner automatically selected', {
        experimentKey,
        winner: result.winningVariant,
        confidence: result.confidence
      });
    }

    return result;

  } catch (error) {
    logger.error('Failed to select winner', {
      experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Start periodic winner detection for an experiment
 *
 * Checks for winner at specified intervals until one is found.
 *
 * @param experimentKey - Unique experiment identifier
 * @param checkIntervalMs - Check interval in milliseconds (default: 86400000 = 24 hours)
 * @param config - Winner detection configuration
 * @returns Stop function to halt winner detection
 *
 * @example
 * // Check for winner daily
 * const stopChecking = startWinnerDetection('button-test', 86400000);
 *
 * // Later, stop checking
 * stopChecking();
 */
export function startWinnerDetection(
  experimentKey: string,
  checkIntervalMs: number = 86400000, // Daily by default
  config?: Partial<WinnerDetectionConfig>
): () => void {
  logger.info('Starting winner detection', {
    experimentKey,
    checkIntervalMs
  });

  const timer = setInterval(async () => {
    try {
      const result = await selectWinner(experimentKey, config);

      if (result.hasWinner) {
        logger.info('Winner detected, stopping checks', {
          experimentKey,
          winner: result.winningVariant
        });
        clearInterval(timer);
      } else {
        logger.info('No winner yet, will check again', {
          experimentKey,
          nextCheck: new Date(Date.now() + checkIntervalMs)
        });
      }
    } catch (error) {
      logger.error('Winner detection check failed', {
        experimentKey,
        error: (error as Error).message
      });
    }
  }, checkIntervalMs);

  // Ensure timer doesn't prevent process exit
  if (timer.unref) {
    timer.unref();
  }

  // Return stop function
  return () => {
    logger.info('Stopping winner detection', { experimentKey });
    clearInterval(timer);
  };
}

/**
 * Get winner detection history for an experiment
 *
 * @param experimentKey - Unique experiment identifier
 * @returns Array of historical winner checks
 */
export async function getWinnerHistory(
  experimentKey: string
): Promise<WinnerResult[]> {
  try {
    const results = await prisma.$queryRaw<any[]>`
      SELECT * FROM experiment_winner_checks
      WHERE experiment_key = ${experimentKey}
      ORDER BY timestamp DESC
    `;

    return results.map(r => ({
      hasWinner: r.has_winner,
      winningVariant: r.winning_variant,
      confidence: r.confidence,
      reason: r.reason,
      metrics: r.metrics,
      sampleSize: r.sample_size,
      timestamp: r.timestamp
    }));

  } catch (error) {
    // Table might not exist, return empty array
    return [];
  }
}

/**
 * Store winner detection result for historical tracking
 */
export async function storeWinnerCheck(
  experimentKey: string,
  result: WinnerResult
): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO experiment_winner_checks
        (experiment_key, has_winner, winning_variant, confidence, reason, metrics, sample_size, timestamp)
      VALUES
        (${experimentKey}, ${result.hasWinner}, ${result.winningVariant || null},
         ${result.confidence}, ${result.reason}, ${JSON.stringify(result.metrics)}::jsonb,
         ${result.sampleSize}, ${result.timestamp})
    `;
  } catch (error) {
    logger.warn('Failed to store winner check', {
      experimentKey,
      error: (error as Error).message
    });
    // Don't throw - this is optional logging
  }
}

/**
 * Calculate expected time to winner
 *
 * Estimates when experiment will have enough data to declare a winner
 * based on current metric rates and sample size requirements.
 *
 * @param experimentKey - Unique experiment identifier
 * @param config - Winner detection configuration
 * @returns Estimated date when winner can be determined, or null if cannot estimate
 */
export async function estimateTimeToWinner(
  experimentKey: string,
  config?: Partial<WinnerDetectionConfig>
): Promise<Date | null> {
  try {
    const defaultConfig: WinnerDetectionConfig = {
      minSampleSize: 1000,
      minConfidence: 0.95,
      ...config
    };

    const results = await experimentWarehouse.getExperimentResults(experimentKey);
    const variantCount = Object.keys(results.variantDistribution).length;

    // Calculate current sample rate (samples per hour)
    const assignments = await experimentWarehouse.getAssignments(experimentKey);
    if (assignments.length < 2) {
      return null; // Not enough data
    }

    const oldestAssignment = new Date(assignments[assignments.length - 1].timestamp);
    const newestAssignment = new Date(assignments[0].timestamp);
    const durationMs = newestAssignment.getTime() - oldestAssignment.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    if (durationHours === 0) {
      return null;
    }

    const samplesPerHour = assignments.length / durationHours;

    // Calculate samples needed
    const samplesNeeded = defaultConfig.minSampleSize * variantCount;
    const currentSamples = assignments.length;
    const remainingSamples = Math.max(0, samplesNeeded - currentSamples);

    if (remainingSamples === 0) {
      return new Date(); // Already have enough samples
    }

    // Estimate hours remaining
    const hoursRemaining = remainingSamples / samplesPerHour;
    const estimatedDate = new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);

    logger.info('Estimated time to winner', {
      experimentKey,
      samplesNeeded,
      currentSamples,
      samplesPerHour: samplesPerHour.toFixed(2),
      hoursRemaining: hoursRemaining.toFixed(1),
      estimatedDate: estimatedDate.toISOString()
    });

    return estimatedDate;

  } catch (error) {
    logger.error('Failed to estimate time to winner', {
      experimentKey,
      error: (error as Error).message
    });
    return null;
  }
}
